const { fn, col } = require('sequelize');
const { Booking } = require('../models/booking.model');
const BookingEvent = require('../models/booking-event.model');
const User = require('../models/user.model');
const { sequelize } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { isUuid, canAccessLocation } = require('../utils/location-scope');
const { staffOrderFilters } = require('../utils/booking-filters');
const { cashDue } = require('../utils/helpers');
const { ORDER_STATUS, ORDER_STATUS_CORRECTIONS } = require('../utils/constants');

const STATUSES = Object.values(ORDER_STATUS);
const label = (status) => (status || '').replace(/_/g, ' ');
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

const cleanName = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

/** A handover time from the form: now when empty; never in the future or before the order was placed. */
const handoverTime = (value, booking) => {
  if (value === undefined || value === null || value === '') return { at: new Date() };
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return { error: 'Enter a valid date and time' };
  if (at.getTime() > Date.now() + 5 * 60 * 1000) return { error: 'The time can\'t be in the future' };
  const placed = booking.get('created_at');
  if (placed && at < new Date(placed)) return { error: 'The time can\'t be before the order was placed' };
  return { at };
};

/**
 * Checks for an optional cash payment taken at the handover. Payment is recorded only when staff enter it,
 * so confirming the handover never changes the payment status on its own.
 */
const cashCheck = (booking, cashCollected) => {
  if (cashCollected === undefined || cashCollected === null || cashCollected === '') return { due: 0, amount: null };
  if (!(typeof cashCollected === 'number' && Number.isFinite(cashCollected) && cashCollected >= 0)) return { error: 'Cash received must be an amount in rupees' };
  const due = cashDue(booking);
  if (due === 0) return { error: 'Nothing is due in cash on this order' };
  if (Math.round(cashCollected * 100) < Math.round(due * 100)) return { error: `₹${due} is due on this order; ₹${cashCollected} is not enough` };
  return { due, amount: cashCollected };
};

/** Shared request checks for the two handover confirmations */
const handoverInput = (body, nameField) => {
  const name = cleanName(body[nameField]);
  const note = cleanText(body.note);
  if (name.length < 2 || name.length > 100) return { error: nameField === 'receiverName' ? 'Enter who received the order' : 'Enter who collected the order' };
  if (note.length > 500) return { error: 'Notes can be at most 500 characters' };
  return { name, note: note || null };
};

/**
 * POST /api/v1/admin/bookings/:id/deliver
 * Confirm an order out for delivery as delivered. Body: { receiverName, deliveredAt?, partnerId?, note?, cashCollected? }
 * - Records when, who received it, the delivery partner (the assigned driver, or partnerId) and the staff member.
 * - Payment status changes only when cashCollected is entered for an unpaid cash order.
 * - A second confirmation is refused (409).
 */
const confirmDelivered = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Booking not found');
  const input = handoverInput(req.body, 'receiverName');
  if (input.error) return sendError(res, 422, input.error);
  const { partnerId } = req.body;
  if (partnerId !== undefined && partnerId !== null && partnerId !== '' && !isUuid(partnerId)) return sendError(res, 422, 'Choose a delivery partner from the list');

  const t = await sequelize.transaction();
  const fail = async (code, message) => { await t.rollback(); return sendError(res, code, message); };
  try {
    const booking = await Booking.findByPk(req.params.id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!booking || !canAccessLocation(req, booking.locationId)) return fail(404, 'Booking not found');
    if (booking.status === 'delivered') {
      return fail(409, `Order ${booking.orderNumber} was already delivered${booking.deliveredAt ? ` on ${when(booking.deliveredAt)}` : ''}${booking.receivedBy ? ` to ${booking.receivedBy}` : ''}`);
    }
    if (booking.status !== 'out_for_delivery') {
      return fail(400, `Only an order that is out for delivery can be confirmed as delivered (this one is ${label(booking.status)})`);
    }

    const time = handoverTime(req.body.deliveredAt, booking);
    if (time.error) return fail(422, time.error);
    const cash = cashCheck(booking, req.body.cashCollected);
    if (cash.error) return fail(422, cash.error);

    let partner = booking.driverId;
    if (partnerId) {
      const driver = await User.findOne({ where: { id: partnerId, role: 'driver' }, transaction: t });
      if (!driver || (booking.locationId && driver.locationId && driver.locationId !== booking.locationId)) {
        return fail(422, 'Choose a delivery partner from this order\'s store');
      }
      partner = driver.id;
      booking.driverId = driver.id; // the partner who actually delivered it (filters and reports use this)
    }

    booking.status = 'delivered';
    booking.deliveredAt = time.at;
    booking.receivedBy = input.name;
    if (cash.amount !== null) booking.paymentStatus = 'paid';
    await booking.save({ transaction: t });

    const event = { bookingId: booking.id, actorId: req.user.id, partnerId: partner || null };
    await BookingEvent.create({
      ...event, type: 'status', fromStatus: 'out_for_delivery', toStatus: 'delivered', note: input.note, receiverName: input.name,
    }, { transaction: t });
    if (cash.amount !== null) await BookingEvent.create({ ...event, type: 'cash_collected', amount: cash.amount }, { transaction: t });
    await t.commit();

    return sendSuccess(res, 200, `Order ${booking.orderNumber} delivered to ${input.name}`, {
      id: booking.id,
      status: booking.status,
      deliveredAt: booking.deliveredAt,
      receivedBy: booking.receivedBy,
      driverId: booking.driverId,
      paymentStatus: booking.paymentStatus,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * POST /api/v1/admin/bookings/:id/collect
 * Confirm an order waiting at the shop as collected. Body: { collectedBy, collectedAt?, note?, cashCollected? }
 * Records when, who collected it and the staff member who handed it over. A second confirmation is refused (409).
 */
const confirmCollected = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Booking not found');
  const input = handoverInput(req.body, 'collectedBy');
  if (input.error) return sendError(res, 422, input.error);

  const t = await sequelize.transaction();
  const fail = async (code, message) => { await t.rollback(); return sendError(res, code, message); };
  try {
    const booking = await Booking.findByPk(req.params.id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!booking || !canAccessLocation(req, booking.locationId)) return fail(404, 'Booking not found');
    if (booking.status === 'collected') {
      return fail(409, `Order ${booking.orderNumber} was already collected${booking.collectedAt ? ` on ${when(booking.collectedAt)}` : ''}${booking.collectedBy ? ` by ${booking.collectedBy}` : ''}`);
    }
    if (booking.status !== 'ready_for_pickup') {
      return fail(400, `Only an order that is ready for pickup at the shop can be confirmed as collected (this one is ${label(booking.status)})`);
    }

    const time = handoverTime(req.body.collectedAt, booking);
    if (time.error) return fail(422, time.error);
    const cash = cashCheck(booking, req.body.cashCollected);
    if (cash.error) return fail(422, cash.error);

    booking.status = 'collected';
    booking.collectedAt = time.at;
    booking.collectedBy = input.name;
    if (cash.amount !== null) booking.paymentStatus = 'paid';
    await booking.save({ transaction: t });

    const event = { bookingId: booking.id, actorId: req.user.id };
    await BookingEvent.create({
      ...event, type: 'status', fromStatus: 'ready_for_pickup', toStatus: 'collected', note: input.note, receiverName: input.name,
    }, { transaction: t });
    if (cash.amount !== null) await BookingEvent.create({ ...event, type: 'cash_collected', amount: cash.amount }, { transaction: t });
    await t.commit();

    return sendSuccess(res, 200, `Order ${booking.orderNumber} collected by ${input.name}`, {
      id: booking.id,
      status: booking.status,
      collectedAt: booking.collectedAt,
      collectedBy: booking.collectedBy,
      paymentStatus: booking.paymentStatus,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * POST /api/v1/admin/bookings/:id/correct-status  (admins only)
 * Undo a mistaken status, e.g. an order confirmed as delivered by mistake. Body: { status, reason }
 * Only the moves in ORDER_STATUS_CORRECTIONS are allowed. The handover details are cleared when a delivery or
 * collection is undone; payments are left as they are. Recorded in the history as a correction.
 */
const correctStatus = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Booking not found');
  const { status } = req.body;
  const reason = cleanText(req.body.reason);
  if (reason.length < 5 || reason.length > 255) return sendError(res, 422, 'Give a reason for the correction (5 to 255 characters)');

  const t = await sequelize.transaction();
  const fail = async (code, message) => { await t.rollback(); return sendError(res, code, message); };
  try {
    const booking = await Booking.findByPk(req.params.id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!booking || !canAccessLocation(req, booking.locationId)) return fail(404, 'Booking not found');
    const fromStatus = booking.status;
    if (!(ORDER_STATUS_CORRECTIONS[fromStatus] || []).includes(status)) {
      return fail(400, `A ${label(fromStatus)} order can't be corrected to ${label(status) || 'that status'}`);
    }

    if (fromStatus === 'delivered') { booking.deliveredAt = null; booking.receivedBy = null; }
    if (fromStatus === 'collected') { booking.collectedAt = null; booking.collectedBy = null; }
    booking.status = status;
    await booking.save({ transaction: t });
    await BookingEvent.create({ bookingId: booking.id, actorId: req.user.id, type: 'correction', fromStatus, toStatus: status, reason }, { transaction: t });
    await t.commit();

    return sendSuccess(res, 200, `Order ${booking.orderNumber} corrected to ${label(status)}`, { id: booking.id, status: booking.status });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * GET /api/v1/admin/bookings/status-counts
 * Number of orders in each status, counted in the database with the same filters as the order lists
 * (store, search, order date, delivery partner, order type). Every status is present (0 when none).
 */
const statusCounts = async (req, res, next) => {
  try {
    const { where, error } = staffOrderFilters(req);
    if (error) return sendError(res, 422, error);
    const rows = await Booking.findAll({ where, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true });
    const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
    for (const r of rows) counts[r.status] = Number(r.count);
    return sendSuccess(res, 200, 'Status counts fetched', { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  } catch (error) {
    next(error);
  }
};

module.exports = { confirmDelivered, confirmCollected, correctStatus, statusCounts };
