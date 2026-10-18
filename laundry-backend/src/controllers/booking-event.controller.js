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
    const booking = await Booking.findByPk(req.params.id, { attributes: ['id', 'orderNumber', 'status', 'locationId'] });
    if (!booking || !canAccessLocation(req, booking.locationId)) return sendError(res, 404, 'Booking not found');

    const events = await BookingEvent.findAll({
      where: { bookingId: booking.id },
      include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'role'] }],
      order: [['created_at', 'DESC']],
    });

    return sendSuccess(res, 200, 'Booking history fetched', {
      booking: { id: booking.id, orderNumber: booking.orderNumber, status: booking.status },
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
        createdAt: e.created_at,
        actor: e.actor ? { id: e.actor.id, name: e.actor.name, role: e.actor.role } : null,
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

module.exports = { getBookingEvents, failureSummaries, recordStaffEvent };
