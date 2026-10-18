const { TimeSlot, Booking, BookingItem } = require('../models/booking.model');
const { CartItem } = require('../models/cart.model');
const { Item } = require('../models/category.model');
const Address = require('../models/address.model');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/response');
const { sequelize } = require('../config/db');
const { generateOrderNumber, canChangeStatus } = require('../utils/helpers');
const { Op } = require('sequelize');
const { calculatePromoDiscount, markPromoUsed } = require('./promocode.controller');
const { debitWallet, refundToWallet } = require('./wallet.controller');
const { findLocationByPincode, getPriceOverrides, priceAt, getSlotCapacities } = require('../services/location.service');
const { locationFilter, canAccessLocation } = require('../utils/location-scope');
const { Location } = require('../models/location.model');
const paymentService = require('../services/payment.service');
const { failureSummaries, recordStaffEvent, customerTimeline } = require('./booking-event.controller');
const { memberBenefits, memberDiscountOn } = require('../services/subscription.service');

const DELIVERY_FEE = 50;
const FREE_DELIVERY_THRESHOLD = 250;

/**
 * GET /api/v1/bookings/available-dates
 * Get next 3 available pickup dates (skip Sundays)
 */
const getAvailableDates = async (req, res, next) => {
  try {
    const dates = [];
    const today = new Date();
    let current = new Date(today);
    current.setDate(current.getDate() + 1); // Start from tomorrow

    while (dates.length < 3) {
      if (current.getDay() !== 0) { // Skip Sundays
        dates.push({
          date: current.toISOString().split('T')[0],
          day: current.toLocaleDateString('en-US', { weekday: 'long' }),
          display: current.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' }),
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return sendSuccess(res, 200, 'Available dates fetched', dates);
  } catch (error) {
    next(error);
  }
};

/**
 * Store whose pickup slots a customer is shown: the one serving ?addressId, else ?pincode,
 * else the customer's default address (as the cart does). null when none applies.
 */
const resolveSlotLocation = async (req) => {
  if (!req.query.addressId && req.query.pincode) return findLocationByPincode(req.query.pincode);
  const address = await Address.findOne({
    where: req.query.addressId ? { id: req.query.addressId, userId: req.user.id } : { userId: req.user.id, isDefault: true },
  });
  return address ? findLocationByPincode(address.pincode) : null;
};

/**
 * Makes concurrent bookings for the same slot, date and store wait for each other until
 * commit/rollback, so two orders can't both read the capacity count before either is saved.
 * Bookings at other stores or on other dates don't wait. The date is normalised by Postgres
 * so "2030/01/07" and "2030-01-07" take the same lock.
 */
const lockSlotCapacity = (timeSlotId, locationId, pickupDate, transaction) => sequelize.query(
  `SELECT pg_advisory_xact_lock(hashtextextended(:key || to_char(CAST(:pickupDate AS date), 'YYYY-MM-DD'), 0))`,
  { replacements: { key: `booking-slot:${timeSlotId}:${locationId || 'none'}:`, pickupDate }, transaction }
);

/**
 * GET /api/v1/bookings/time-slots?date=2025-04-10[&addressId=...|&pincode=...]
 * Time slots for a date with availability at the customer's store. Without a store
 * (no address/pincode that a store serves) bookings at all stores are counted.
 */
const getTimeSlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return sendError(res, 400, 'Date is required');

    const slots = await TimeSlot.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']],
    });
    const location = await resolveSlotLocation(req);
    const capacities = await getSlotCapacities(location?.id, slots);

    // Count existing bookings per slot for the date (at the store, when there is one)
    const slotsWithAvailability = await Promise.all(slots.map(async (slot) => {
      const where = {
        pickupDate: date,
        timeSlotId: slot.id,
        status: { [Op.notIn]: ['cancelled'] },
      };
      if (location) where.locationId = location.id;
      const bookingCount = await Booking.count({ where });
      const capacity = capacities.get(slot.id);

      return {
        ...slot.toJSON(),
        maxBookings: capacity,
        bookedCount: bookingCount,
        available: bookingCount < capacity,
        remainingSlots: Math.max(capacity - bookingCount, 0),
      };
    }));

    return sendSuccess(res, 200, 'Time slots fetched', slotsWithAvailability);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/bookings/confirm
 * Create booking from cart items
 */
const confirmBooking = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    // Any client-sent `discount` is ignored: it is worked out from the promo code below.
    const { addressId, pickupDate, timeSlotId, promoCode, promoCodeId, paymentMethod = 'wallet', notes, disclaimerAccepted } = req.body;

    // Validate address
    const address = await Address.findOne({ where: { id: addressId, userId: req.user.id }, transaction: t });
    if (!address) {
      await t.rollback();
      return sendError(res, 404, 'Address not found');
    }
    // Who placed it, saved on the order so store staff see the customer's name and mobile (like store orders)
    const customer = await User.findByPk(req.user.id, { attributes: ['name', 'phone'], transaction: t });

    // The store serving the pickup pincode handles the order, with its own prices and slot capacity
    const location = await findLocationByPincode(address.pincode, t);

    // Validate time slot. The share lock keeps the slot from being changed mid-booking
    // without making bookings at different stores wait for each other.
    const timeSlot = await TimeSlot.findByPk(timeSlotId, { lock: t.LOCK.SHARE, transaction: t });
    if (!timeSlot || !timeSlot.isActive) {
      await t.rollback();
      return sendError(res, 404, 'Time slot not found');
    }

    // Check slot availability at this store (orders no store serves share one pool).
    // Concurrent bookings for the same slot, date and store queue on this lock first.
    await lockSlotCapacity(timeSlot.id, location?.id, pickupDate, t);
    const capacity = (await getSlotCapacities(location?.id, [timeSlot], t)).get(timeSlot.id);
    const bookingCount = await Booking.count({
      where: { pickupDate, timeSlotId, locationId: location?.id || null, status: { [Op.notIn]: ['cancelled'] } },
      transaction: t,
    });
    if (bookingCount >= capacity) {
      await t.rollback();
      return sendError(res, 400, 'This time slot is fully booked. Please choose another.');
    }

    // Get cart items, locked so a double submit can't turn the same cart into two orders
    const cartItems = await CartItem.findAll({
      where: { userId: req.user.id },
      include: [{ model: Item, as: 'item' }],
      lock: { level: t.LOCK.UPDATE, of: CartItem },
      transaction: t,
    });

    if (cartItems.length === 0) {
      await t.rollback();
      return sendError(res, 400, 'Cart is empty');
    }

    // The store's own prices; items it doesn't offer block the order
    const overrides = await getPriceOverrides(location?.id, cartItems.map(ci => ci.itemId), t);
    const unavailable = cartItems.filter(ci => priceAt(ci.item, overrides.get(ci.itemId)) === null);
    if (unavailable.length) {
      await t.rollback();
      return sendError(res, 400, `Not available at ${location.name}: ${unavailable.map(ci => ci.item.name).join(', ')}. Please remove from your cart.`);
    }

    // Calculate totals
    let subtotal = 0;
    let totalQuantity = 0;
    const bookingItems = cartItems.map(ci => {
      const price = priceAt(ci.item, overrides.get(ci.itemId));
      const lineTotal = price * ci.quantity;
      subtotal += lineTotal;
      totalQuantity += ci.quantity;
      return {
        itemId: ci.itemId,
        name: ci.item.name,
        color: ci.color,
        size: ci.size,
        quantity: ci.quantity,
        price,
        lineTotal,
      };
    });

    // Delivery fee, waived for customers whose plan has free delivery
    const membership = await memberBenefits(req.user.id, t);
    let deliveryFee = 0;
    if ((subtotal < FREE_DELIVERY_THRESHOLD || totalQuantity < 10) && !membership?.freeDelivery) {
      deliveryFee = DELIVERY_FEE;
    }

    // Validate the promo code and calculate the discount on the server
    let discount = 0;
    let appliedPromoId = null;
    if (promoCode || promoCodeId) {
      const result = await calculatePromoDiscount({
        userId: req.user.id,
        code: promoCode,
        promoCodeId,
        orderAmount: subtotal,
        transaction: t,
      });
      discount = result.discount;
      appliedPromoId = result.promo.id;
    }
    const promoDiscount = discount;

    // The plan's member discount is added to any promo discount (never more than the subtotal).
    // Both are kept in the booking's one `discount` column, so totals add up everywhere it's shown.
    const memberDiscount = memberDiscountOn(subtotal, membership);
    discount = Math.min(subtotal, Math.round((promoDiscount + memberDiscount) * 100) / 100);

    const total = Math.round((subtotal - discount + deliveryFee) * 100) / 100;

    // Card/UPI orders stay pending until the Razorpay payment is verified
    const needsOnlinePayment = ['card', 'upi'].includes(paymentMethod) && total > 0;
    let paymentStatus = 'paid';
    if (paymentMethod === 'cod' || needsOnlinePayment) paymentStatus = 'pending';

    // Estimated delivery (pickup date + 2 days)
    const estDelivery = new Date(pickupDate);
    estDelivery.setDate(estDelivery.getDate() + 2);

    // Create booking
    const booking = await Booking.create({
      userId: req.user.id,
      orderNumber: await generateOrderNumber(t),
      locationId: location?.id || null,
      addressId,
      pickupDate,
      timeSlotId,
      subtotal,
      deliveryFee,
      discount,
      total,
      promoCodeId: appliedPromoId,
      paymentMethod,
      paymentStatus,
      status: needsOnlinePayment ? 'pending' : 'confirmed',
      customerName: customer?.name || address.fullName,
      customerPhone: customer?.phone || address.phone,
      notes,
      disclaimerAccepted: disclaimerAccepted || false,
      estimatedDeliveryDate: estDelivery.toISOString().split('T')[0],
    }, { transaction: t });

    // Create booking items
    for (const item of bookingItems) {
      await BookingItem.create({
        bookingId: booking.id,
        ...item,
      }, { transaction: t });
    }

    // Clear the cart items that were ordered (not ones added since they were read)
    await CartItem.destroy({ where: { id: cartItems.map(ci => ci.id) }, transaction: t });

    // If wallet payment, debit wallet
    if (paymentMethod === 'wallet') {
      await debitWallet(req.user.id, total, booking.id, t, { description: `Payment for order #${booking.orderNumber}` });
    }

    // Promo usage is counted now for wallet/COD orders, or once an online payment is verified
    if (appliedPromoId && !needsOnlinePayment) {
      await markPromoUsed(req.user.id, appliedPromoId, t);
    }

    // Create the Razorpay order before committing so a gateway failure rolls the booking back
    let payment = null;
    if (needsOnlinePayment) {
      payment = await paymentService.createOrder({
        amount: total,
        receipt: booking.orderNumber,
        notes: { purpose: 'booking', bookingId: booking.id, userId: req.user.id },
      });
    }

    await t.commit();

    return sendSuccess(res, 201, 'Order placed successfully', {
      booking: {
        id: booking.id,
        orderNumber: booking.orderNumber,
        status: booking.status,
        location: location ? { id: location.id, name: location.name, phone: location.phone } : null,
        pickupDate: booking.pickupDate,
        timeSlot: timeSlot.label,
        subtotal,
        discount,
        promoDiscount,
        memberDiscount,
        membership,
        deliveryFee,
        total: parseFloat(booking.total),
        paymentStatus: booking.paymentStatus,
        estimatedDeliveryDate: booking.estimatedDeliveryDate,
      },
      // Present for card/UPI: open Razorpay Checkout with this, then call /bookings/:id/verify-payment
      payment,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * POST /api/v1/bookings/:id/verify-payment
 * Confirm a card/UPI booking after Razorpay Checkout succeeds
 */
const verifyBookingPayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.id, userId: req.user.id },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!booking) {
      await t.rollback();
      return sendError(res, 404, 'Booking not found');
    }
    if (!['card', 'upi'].includes(booking.paymentMethod)) {
      await t.rollback();
      return sendError(res, 400, 'This booking does not use online payment');
    }
    if (booking.paymentStatus === 'paid') {
      await t.rollback();
      return sendSuccess(res, 200, 'Payment already verified', { id: booking.id, status: booking.status, paymentStatus: booking.paymentStatus });
    }
    if (booking.status === 'cancelled') {
      await t.rollback();
      return sendError(res, 400, 'This booking has been cancelled');
    }

    const order = await paymentService.verifyPaidOrder(req.body);
    if (order.notes?.purpose !== 'booking' || order.notes?.bookingId !== booking.id) {
      await t.rollback();
      return sendError(res, 400, 'Payment does not belong to this booking');
    }
    if (order.amount !== paymentService.toPaise(booking.total)) {
      await t.rollback();
      return sendError(res, 400, 'Paid amount does not match the order total');
    }

    booking.paymentStatus = 'paid';
    if (booking.status === 'pending') booking.status = 'confirmed';
    await booking.save({ transaction: t });

    if (booking.promoCodeId) {
      await markPromoUsed(req.user.id, booking.promoCodeId, t);
    }

    await t.commit();
    return sendSuccess(res, 200, 'Payment verified', { id: booking.id, status: booking.status, paymentStatus: booking.paymentStatus });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

const isStaff = (user) => ['admin', 'manager'].includes(user.role);
const LOCATION_SUMMARY = { model: Location, as: 'location', attributes: ['id', 'name', 'code'] };

/**
 * GET /api/v1/bookings
 * Get bookings - admin sees all (or the switcher's location), a branch manager
 * sees their location, a customer sees their own
 */
const getBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = isStaff(req.user) ? locationFilter(req) : { userId: req.user.id };
    if (status) where.status = status;

    const { rows, count } = await Booking.findAndCountAll({
      where,
      include: [
        { model: BookingItem, as: 'items' },
        { model: TimeSlot, as: 'timeSlot', attributes: ['label'] },
        LOCATION_SUMMARY,
      ],
      distinct: true,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    // Staff lists also show failed pickup / delivery attempts reported from the driver app
    let bookings = rows;
    if (isStaff(req.user)) {
      const summaries = await failureSummaries(rows.map(b => b.id));
      bookings = rows.map(b => ({ ...b.toJSON(), failedAttempts: 0, lastFailure: null, ...summaries.get(b.id) }));
    }

    return sendSuccess(res, 200, 'Bookings fetched', {
      bookings,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/bookings/:id
 * Get single booking detail
 */
const getBookingById = async (req, res, next) => {
  try {
    const where = { id: req.params.id };
    if (!isStaff(req.user)) {
      where.userId = req.user.id;
    }
    const booking = await Booking.findOne({
      where,
      include: [
        { model: BookingItem, as: 'items' },
        { model: TimeSlot, as: 'timeSlot', attributes: ['label'] },
        { model: Address, as: 'address', attributes: ['fullName', 'phone', 'addressLine', 'city', 'state', 'pincode', 'label'] },
        { ...LOCATION_SUMMARY, attributes: ['id', 'name', 'code', 'phone'] },
      ],
    });

    if (!booking || !canAccessLocation(req, booking.locationId)) return sendError(res, 404, 'Booking not found');
    // When each step happened (status changes recorded by staff and the driver app)
    const timeline = await customerTimeline(booking.id);
    return sendSuccess(res, 200, 'Booking fetched', { ...booking.toJSON(), timeline });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a booking and refund what was paid for it to the user's wallet.
 * The caller must hold a row lock on the booking inside transaction `t`.
 * Card/UPI payments are refunded to the wallet as well: the booking doesn't keep
 * the Razorpay payment id, so the gateway refund API can't be called for it.
 * Store (offline) orders are paid at the counter and refunded there, not here.
 */
const cancelWithRefund = async (booking, t) => {
  let refundedAmount = 0;
  const total = parseFloat(booking.total);
  const refundable = booking.orderType === 'online'
    && booking.paymentStatus === 'paid'
    && ['wallet', 'card', 'upi'].includes(booking.paymentMethod)
    && booking.userId
    && total > 0;

  if (refundable) {
    await refundToWallet(booking.userId, total, booking.id, t, `Refund for cancelled order #${booking.orderNumber}`);
    booking.paymentStatus = 'refunded';
    refundedAmount = total;
  }

  booking.status = 'cancelled';
  await booking.save({ transaction: t });
  return refundedAmount;
};

/**
 * PATCH /api/v1/bookings/:id/cancel
 * Cancel a booking
 */
const cancelBooking = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    // Lock the booking so a repeated cancel (or a status change) can't refund it twice
    const booking = await Booking.findOne({
      where: { id: req.params.id, userId: req.user.id },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!booking) {
      await t.rollback();
      return sendError(res, 404, 'Booking not found');
    }

    if (booking.orderType === 'offline') {
      await t.rollback();
      return sendError(res, 400, 'Store orders can only be cancelled at the store');
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      await t.rollback();
      return sendError(res, 400, 'Booking cannot be cancelled at this stage');
    }

    const refundedAmount = await cancelWithRefund(booking, t);
    await t.commit();

    return sendSuccess(res, 200, refundedAmount > 0 ? `Booking cancelled. ₹${refundedAmount} refunded to your wallet` : 'Booking cancelled', {
      id: booking.id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      refundedAmount,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * PATCH /api/v1/bookings/:id/status
 * Update booking status (admin, or the branch manager of its location)
 */
const updateBookingStatus = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const booking = await Booking.findByPk(req.params.id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!booking || !canAccessLocation(req, booking.locationId)) {
      await t.rollback();
      return sendError(res, 404, 'Booking not found');
    }

    const { status } = req.body;
    if (!canChangeStatus(booking.status, status)) {
      await t.rollback();
      return sendError(res, 400, `Cannot change status from ${booking.status} to ${status}`);
    }

    const fromStatus = booking.status;
    if (status === 'cancelled' && booking.status !== 'cancelled') {
      await cancelWithRefund(booking, t);
    } else {
      booking.status = status;
      await booking.save({ transaction: t });
    }
    // Staff changes go into the order's history next to the driver's (shown on Order Status)
    if (fromStatus !== status) {
      await recordStaffEvent({ bookingId: booking.id, actorId: req.user.id, type: 'status', fromStatus, toStatus: status }, t);
    }

    await t.commit();
    return sendSuccess(res, 200, 'Status updated', booking);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

module.exports = { getAvailableDates, getTimeSlots, confirmBooking, verifyBookingPayment, getBookings, getBookingById, cancelBooking, updateBookingStatus };
