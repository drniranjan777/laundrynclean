const { Op } = require('sequelize');
const { Booking } = require('../models/booking.model');
const Address = require('../models/address.model');
const User = require('../models/user.model');
const { sequelize } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { isUuid } = require('../utils/location-scope');
const { generateOrderNumber } = require('../utils/helpers');
const { findLocationByPincode } = require('../services/location.service');
const { getSettings, listDates, listSlots, assertBookable, addDays, isDay } = require('../services/pickup-availability.service');
const { ruleFor, summarise, describe } = require('../services/delivery-charge.service');
const { memberBenefits } = require('../services/subscription.service');
const paymentService = require('../services/payment.service');

/**
 * Schedule Pickup (bulk): the customer picks a date and a time slot and the store collects the clothes; they are
 * counted and billed at the store after pickup (PUT /admin/bookings/:id/bill), then paid on delivery or online.
 */

/** The customer's address (by ?addressId / body.addressId, else their default) and the store serving it */
const addressAndStore = async (req, addressId, transaction) => {
  const where = isUuid(addressId) ? { id: addressId, userId: req.user.id } : { userId: req.user.id, isDefault: true };
  const address = await Address.findOne({ where, transaction });
  const location = address ? await findLocationByPincode(address.pincode, transaction) : null;
  return { address, location };
};

const storeSummary = (location) => (location ? { id: location.id, name: location.name, city: location.city, phone: location.phone } : null);

/**
 * GET /api/v1/pickups/config[?addressId=]
 * What the Schedule Pickup screens need: switches, booking window, instructions and policies, the store serving the
 * address and its pickup & delivery charge rule.
 */
const getConfig = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const { address, location } = await addressAndStore(req, req.query.addressId);
    const rule = await ruleFor(location?.id);
    const membership = await memberBenefits(req.user.id);
    return sendSuccess(res, 200, 'Pickup settings fetched', {
      enabled: settings.enabled,
      bulkEnabled: settings.bulkEnabled,
      minAdvanceDays: settings.minAdvanceDays,
      maxAdvanceDays: location?.maxAdvanceDays || settings.maxAdvanceDays,
      timezone: settings.timezone,
      instructions: settings.instructions,
      policies: settings.policies,
      addressId: address?.id || null,
      store: storeSummary(location),
      storeAcceptsPickups: !!location && location.pickupEnabled !== false,
      charges: { ...summarise(rule), description: describe(rule) },
      membership: membership ? { planName: membership.planName, freeDelivery: membership.freeDelivery, discountPercent: membership.discountPercent } : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/pickups/dates[?addressId=]
 * Dates from tomorrow to the end of the booking window, each { date, weekday, dayOfMonth, month, available, reason }.
 */
const getDates = async (req, res, next) => {
  try {
    const { location } = await addressAndStore(req, req.query.addressId);
    const { dates, window } = await listDates(location);
    return sendSuccess(res, 200, 'Pickup dates fetched', { dates, firstBookable: window.first, lastBookable: window.last });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/pickups/slots?date=YYYY-MM-DD[&addressId=]
 * Slots offered on the date at the address's store: { id, label, startTime, endTime, status, remaining, reason }.
 * status: available | full | closed. An unbookable date returns no slots and the reason.
 */
const getSlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!isDay(date)) return sendError(res, 422, 'date must be YYYY-MM-DD');
    const { location } = await addressAndStore(req, req.query.addressId);
    const { dates, window } = await listDates(location);
    const day = dates.find(d => d.date === date);
    if (!day || !day.available) {
      const reason = day?.reason
        || (date === window.today ? 'Same-day pickup is not available' : date < window.today ? 'This date has passed' : 'Beyond the booking window');
      return sendSuccess(res, 200, 'No slots on this date', { date, available: false, reason, slots: [] });
    }
    const slots = (await listSlots(date, location)).map(({ slot, capacity, booked, ...s }) => s);
    return sendSuccess(res, 200, 'Pickup slots fetched', { date, available: true, reason: null, slots });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/pickups/quote  Body: { addressId }
 * The price breakdown we can give before pickup: the store's pickup & delivery charge rule (with any membership
 * waiver). The order amount is worked out when the clothes are counted at the store.
 */
const getQuote = async (req, res, next) => {
  try {
    const { address, location } = await addressAndStore(req, req.body.addressId);
    if (!address) return sendError(res, 404, 'Address not found');
    if (!location) return sendError(res, 400, 'We don\'t pick up from this pincode yet');
    const rule = await ruleFor(location.id);
    const membership = await memberBenefits(req.user.id);
    const r = summarise(rule);
    return sendSuccess(res, 200, 'Pickup quote', {
      store: storeSummary(location),
      orderType: 'bulk_pickup',
      estimatedAmount: null,
      charges: {
        ...r,
        description: describe(rule),
        waivedByMembership: !!membership?.freeDelivery && r.charge > 0,
        chargeIfBelowThreshold: membership?.freeDelivery ? 0 : r.charge,
      },
      memberDiscountPercent: membership?.discountPercent || 0,
      payableNow: 0,
      note: 'Your clothes are counted and billed at the store after pickup. You pay the final amount on delivery, or online in the app once the bill is ready.',
    });
  } catch (error) {
    next(error);
  }
};

/** The booking as the confirmation screen shows it */
const bookingSummary = (booking, location, slotLabel, rule) => ({
  id: booking.id,
  orderNumber: booking.orderNumber,
  bookingType: booking.bookingType,
  status: booking.status,
  pickupDate: booking.pickupDate,
  timeSlot: slotLabel,
  location: storeSummary(location),
  paymentMethod: booking.paymentMethod,
  paymentStatus: booking.paymentStatus,
  total: Number(booking.total),
  billed: Number(booking.total) > 0,
  charges: rule ? { ...summarise(rule), description: describe(rule) } : null,
  estimatedDeliveryDate: booking.estimatedDeliveryDate,
});

/**
 * POST /api/v1/pickups
 * Body: { addressId, pickupDate, timeSlotId, paymentMethod: 'cod' | 'online', notes?, idempotencyKey? }
 * Books a bulk pickup: checks the switches, the address's store, the date and the slot (with its capacity lock),
 * then creates the order with no items (billed after pickup). It is queued for the store to assign a pickup
 * partner, like any new order. The same idempotencyKey returns the same booking; a second active booking for the
 * same slot and address is refused.
 */
const createPickup = async (req, res, next) => {
  const { addressId, pickupDate, timeSlotId, paymentMethod, notes } = req.body;
  const idempotencyKey = typeof req.body.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
  if (!isUuid(addressId)) return sendError(res, 422, 'Choose a pickup address');
  if (!isDay(pickupDate)) return sendError(res, 422, 'Choose a pickup date');
  if (!isUuid(timeSlotId)) return sendError(res, 422, 'Choose a time slot');
  if (!['cod', 'online'].includes(paymentMethod)) return sendError(res, 422, 'Choose cash on delivery or online payment');
  if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 80)) return sendError(res, 422, 'Invalid request key');
  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 500)) return sendError(res, 422, 'Instructions can be at most 500 characters');

  // A repeated tap or a retry with the same key gets the booking that was already made
  if (idempotencyKey) {
    try {
      const existing = await Booking.findOne({ where: { userId: req.user.id, idempotencyKey } });
      if (existing) return replay(res, existing);
    } catch (error) {
      return next(error);
    }
  }

  const t = await sequelize.transaction();
  const fail = async (code, message) => { await t.rollback(); return sendError(res, code, message); };
  try {
    const settings = await getSettings(t);
    if (!settings.enabled || !settings.bulkEnabled) return fail(403, 'Schedule Pickup isn\'t accepting bookings right now. Please try again later.');

    const { address, location } = await addressAndStore(req, addressId, t);
    if (!address) return fail(404, 'Address not found');
    if (!location) return fail(400, 'We don\'t pick up from this pincode yet');
    if (location.pickupEnabled === false) return fail(400, `${location.name} isn't taking pickups right now`);

    let timeSlot;
    try {
      ({ timeSlot } = await assertBookable({ pickupDate, timeSlotId, location }, t));
    } catch (error) {
      if (!error.statusCode) throw error;
      // A retry that queued behind the original may find the slot full because of the original itself
      const made = idempotencyKey && await Booking.findOne({ where: { userId: req.user.id, idempotencyKey }, transaction: t });
      if (made) { await t.rollback(); return replay(res, made); }
      return fail(error.statusCode, error.message);
    }

    // Retries sent at the same moment queue on the slot lock above; the first one may have just been saved
    if (idempotencyKey) {
      const made = await Booking.findOne({ where: { userId: req.user.id, idempotencyKey }, transaction: t });
      if (made) { await t.rollback(); return replay(res, made); }
    }

    // One active bulk pickup per slot, date and address
    const duplicate = await Booking.findOne({
      where: { userId: req.user.id, bookingType: 'bulk_pickup', pickupDate, timeSlotId, addressId, status: { [Op.notIn]: ['cancelled'] } },
      transaction: t,
    });
    if (duplicate) return fail(409, `You already have a pickup booked for this slot (order #${duplicate.orderNumber})`);

    const customer = await User.findByPk(req.user.id, { attributes: ['name', 'phone'], transaction: t });
    const estDelivery = addDays(pickupDate, 2);
    const booking = await Booking.create({
      userId: req.user.id,
      orderNumber: await generateOrderNumber(t),
      bookingType: 'bulk_pickup',
      idempotencyKey: idempotencyKey || null,
      locationId: location.id,
      addressId,
      pickupDate,
      timeSlotId,
      subtotal: 0,
      deliveryFee: 0,
      discount: 0,
      total: 0,
      paymentMethod: paymentMethod === 'online' ? 'upi' : 'cod',
      paymentStatus: 'pending',
      status: 'confirmed',
      notes: notes ? notes.trim() : null,
      disclaimerAccepted: true,
      estimatedDeliveryDate: estDelivery,
      customerName: customer?.name || address.fullName,
      customerPhone: customer?.phone || address.phone,
    }, { transaction: t });
    await t.commit();

    const rule = await ruleFor(location.id);
    return sendSuccess(res, 201, 'Pickup booked', bookingSummary(booking, location, timeSlot.label, rule));
  } catch (error) {
    await t.rollback();
    // Two requests with the same key at the same moment: the unique index lets one through; return it
    if (idempotencyKey && error.name === 'SequelizeUniqueConstraintError') {
      const existing = await Booking.findOne({ where: { userId: req.user.id, idempotencyKey } });
      if (existing) return replay(res, existing);
    }
    next(error);
  }
};

/** The response for a booking that was already made with this key */
const replay = async (res, booking) => {
  const { TimeSlot } = require('../models/booking.model');
  const { Location } = require('../models/location.model');
  const [slot, location] = await Promise.all([TimeSlot.findByPk(booking.timeSlotId), booking.locationId ? Location.findByPk(booking.locationId) : null]);
  const rule = await ruleFor(booking.locationId);
  return sendSuccess(res, 200, 'Pickup already booked', { ...bookingSummary(booking, location, slot?.label || null, rule), duplicate: true });
};

/**
 * POST /api/v1/bookings/:id/pay
 * Online payment for an order whose amount is known now (e.g. a bulk pickup after it was billed): creates a
 * Razorpay order for the total; the app pays it and calls /bookings/:id/verify-payment.
 */
const payBooking = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return sendError(res, 404, 'Booking not found');
    const booking = await Booking.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!booking) return sendError(res, 404, 'Booking not found');
    if (booking.status === 'cancelled') return sendError(res, 400, 'This order has been cancelled');
    if (booking.paymentStatus === 'paid') return sendError(res, 409, 'This order is already paid');
    if (!['card', 'upi'].includes(booking.paymentMethod)) return sendError(res, 400, 'This order is paid on delivery');
    if (!(Number(booking.total) > 0)) return sendError(res, 400, 'The bill isn\'t ready yet. You can pay once your clothes are counted.');

    const payment = await paymentService.createOrder({
      amount: Number(booking.total),
      receipt: booking.orderNumber,
      notes: { purpose: 'booking', bookingId: booking.id, userId: req.user.id },
    });
    return sendSuccess(res, 201, 'Payment started', { id: booking.id, orderNumber: booking.orderNumber, total: Number(booking.total), payment });
  } catch (error) {
    next(error);
  }
};

module.exports = { getConfig, getDates, getSlots, getQuote, createPickup, payBooking };
