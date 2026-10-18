const { Op } = require('sequelize');
const { Booking } = require('../models/booking.model');
const BookingEvent = require('../models/booking-event.model');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/response');
const { isUuid, canAccessLocation } = require('../utils/location-scope');

const FAILURE_TYPES = ['pickup_failed', 'delivery_failed'];

/**
 * GET /api/v1/admin/bookings/:id/events
 * An order's history for store staff, newest first: driver actions from the driver app (status changes with
 * piece count / note / proof photo, failed attempts with a reason, cash collected) plus staff status changes
 * and driver assignment. Branch managers only see their own store's orders.
 */
const getBookingEvents = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return sendError(res, 404, 'Booking not found');
    const booking = await Booking.findByPk(req.params.id, {
      include: [{ model: User, as: 'driver', attributes: ['id', 'name', 'phone'] }],
    });
    if (!booking || !canAccessLocation(req, booking.locationId)) return sendError(res, 404, 'Booking not found');

    const events = await BookingEvent.findAll({
      where: { bookingId: booking.id },
      include: [
        { model: User, as: 'actor', attributes: ['id', 'name', 'role'] },
        { model: User, as: 'partner', attributes: ['id', 'name', 'phone'] },
      ],
      order: [['created_at', 'DESC']],
    });

    return sendSuccess(res, 200, 'Booking history fetched', {
      booking: {
        id: booking.id,
        orderNumber: booking.orderNumber,
        status: booking.status,
        orderType: booking.orderType,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        total: Number(booking.total),
        createdAt: booking.get('created_at'),
        deliveredAt: booking.deliveredAt,
        receivedBy: booking.receivedBy,
        collectedAt: booking.collectedAt,
        collectedBy: booking.collectedBy,
        driver: booking.driver ? { id: booking.driver.id, name: booking.driver.name, phone: booking.driver.phone } : null,
      },
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        reason: e.reason,
        note: e.note,
        photoUrl: e.photoUrl,
        amount: e.amount === null ? null : Number(e.amount),
        itemCount: e.itemCount,
        receiverName: e.receiverName,
        createdAt: e.created_at,
        actor: e.actor ? { id: e.actor.id, name: e.actor.name, role: e.actor.role } : null,
        partner: e.partner ? { id: e.partner.id, name: e.partner.name, phone: e.partner.phone } : null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Failed pickup / delivery attempts per booking, for order lists: Map(bookingId → { failedAttempts, lastFailure }).
 */
const failureSummaries = async (bookingIds) => {
  const summaries = new Map();
  if (!bookingIds.length) return summaries;
  const failures = await BookingEvent.findAll({
    where: { bookingId: { [Op.in]: bookingIds }, type: FAILURE_TYPES },
    attributes: ['bookingId', 'type', 'reason', 'created_at'],
    order: [['created_at', 'DESC']],
  });
  for (const f of failures) {
    const s = summaries.get(f.bookingId);
    if (s) s.failedAttempts += 1;
    else summaries.set(f.bookingId, { failedAttempts: 1, lastFailure: { type: f.type, reason: f.reason, at: f.created_at } });
  }
  return summaries;
};

/** Records a staff action on an order (inside the caller's transaction) */
const recordStaffEvent = (fields, transaction) => BookingEvent.create(fields, { transaction });

/**
 * What the customer sees of an order's history, oldest first: each status the order reached and when, plus
 * failed pickup / delivery attempts with their reason. Internal notes, photos and who did what are left out.
 */
const customerTimeline = async (bookingId) => {
  const events = await BookingEvent.findAll({
    where: { bookingId, [Op.or]: [{ toStatus: { [Op.ne]: null } }, { type: FAILURE_TYPES }] },
    attributes: ['type', 'toStatus', 'reason', 'created_at'],
    order: [['created_at', 'ASC']],
  });
  return events
    .filter((e) => FAILURE_TYPES.includes(e.type) || e.type === 'status' || e.type === 'driver_assigned')
    .map((e) => ({ type: e.type, status: e.toStatus, reason: FAILURE_TYPES.includes(e.type) ? e.reason : null, at: e.created_at }));
};

module.exports = { getBookingEvents, failureSummaries, recordStaffEvent, customerTimeline };
