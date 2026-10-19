const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { PickupSettings, PickupDateException, SlotDateOverride } = require('../models/pickup.model');
const { TimeSlot, Booking } = require('../models/booking.model');
const { LocationTimeSlot } = require('../models/location.model');

/**
 * When pickups can be booked: the admin's booking window (in the business timezone), working days, closed / open
 * date exceptions, each slot's weekdays and stores, per-store capacity and per-date capacity overrides.
 * Used by the app's date and slot lists and checked again when an order or a bulk pickup is booked.
 */

const DEFAULTS = { enabled: true, bulkEnabled: true, minAdvanceDays: 1, maxAdvanceDays: 7, timezone: 'Asia/Kolkata', workingDays: [1, 2, 3, 4, 5, 6] };
const NO_STORE = '00000000-0000-0000-0000-000000000000';

const availabilityError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const getSettings = async (transaction) => {
  const row = await PickupSettings.findByPk(1, { transaction });
  return row ? { ...DEFAULTS, ...row.toJSON(), workingDays: (row.workingDays || []).map(Number) } : { ...DEFAULTS };
};

/** YYYY-MM-DD of a moment in a timezone */
const dayIn = (date, timezone) => date.toLocaleDateString('en-CA', { timeZone: timezone });
/** YYYY-MM-DD plus n days */
const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** 0 = Sunday … 6 = Saturday */
const weekdayOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
const isDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime())
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

/** First and last bookable dates for a store. Same-day pickup is never allowed (minimum 1 day ahead). */
const bookingWindow = (settings, location) => {
  const today = dayIn(new Date(), settings.timezone);
  const min = Math.max(1, Number(settings.minAdvanceDays) || 1);
  const max = Math.max(min, Number(location?.maxAdvanceDays || settings.maxAdvanceDays) || min);
  return { today, first: addDays(today, min), last: addDays(today, max), min, max };
};

const exceptionsBetween = (from, to, locationId, transaction) => PickupDateException.findAll({
  where: { date: { [Op.between]: [from, to] }, [Op.or]: [{ locationId: null }, ...(locationId ? [{ locationId }] : [])] },
  transaction,
});

/** { available, reason } for one date at a store. A store's own exception wins over a global one. */
const dateStatus = (day, { settings, window, exceptions, location }) => {
  if (!settings.enabled) return { available: false, reason: 'Pickups are paused right now' };
  if (location && location.pickupEnabled === false) return { available: false, reason: 'Pickups are paused at this store' };
  if (day <= window.today) return { available: false, reason: day === window.today ? 'Same-day pickup is not available' : 'This date has passed' };
  if (day < window.first) return { available: false, reason: `Book at least ${window.min} days ahead` };
  if (day > window.last) return { available: false, reason: 'Beyond the booking window' };
  const own = location ? exceptions.find(e => e.date === day && e.locationId === location.id) : null;
  const exception = own || exceptions.find(e => e.date === day && !e.locationId);
  if (exception) return exception.isOpen ? { available: true, reason: null } : { available: false, reason: exception.reason || 'Closed' };
  if (!settings.workingDays.includes(weekdayOf(day))) return { available: false, reason: 'Closed on this day' };
  return { available: true, reason: null };
};

/**
 * Dates from tomorrow to the end of the store's booking window, each with whether it can be booked and why not.
 */
const listDates = async (location, transaction) => {
  const settings = await getSettings(transaction);
  const window = bookingWindow(settings, location);
  const start = addDays(window.today, 1);
  const exceptions = (await exceptionsBetween(start, window.last, location?.id, transaction)).map(e => e.toJSON());
  const dates = [];
  for (let day = start; day <= window.last; day = addDays(day, 1)) {
    const d = new Date(`${day}T12:00:00Z`);
    dates.push({
      date: day,
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
      dayOfMonth: d.getUTCDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
      day: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
      display: d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }),
      ...dateStatus(day, { settings, window, exceptions, location }),
    });
  }
  return { settings, window, dates };
};

/** Booked (not cancelled) orders for a slot on a date at a store (or with no store) */
const bookedCount = (timeSlotId, day, locationId, transaction) => Booking.count({
  where: { pickupDate: day, timeSlotId, locationId: locationId || null, status: { [Op.notIn]: ['cancelled'] } },
  transaction,
});

/**
 * Slots offered on a date at a store, in order, each with capacity, bookings and status:
 * available | full | closed. Slots that don't run that weekday or at that store are left out.
 */
const listSlots = async (day, location, transaction) => {
  const slots = await TimeSlot.findAll({ where: { isActive: true }, order: [['sortOrder', 'ASC'], ['startTime', 'ASC']], transaction });
  const weekday = weekdayOf(day);
  const [storeCaps, overrides] = await Promise.all([
    location ? LocationTimeSlot.findAll({ where: { locationId: location.id }, transaction }) : [],
    SlotDateOverride.findAll({ where: { date: day, [Op.or]: [{ locationId: null }, ...(location ? [{ locationId: location.id }] : [])] }, transaction }),
  ]);
  const own = new Map(storeCaps.map(c => [c.timeSlotId, c.maxBookings]));
  const result = [];
  for (const slot of slots) {
    if (!(slot.days || []).map(Number).includes(weekday)) continue;
    const storeCap = own.has(slot.id) ? own.get(slot.id) : null;
    if (location && storeCap === 0) continue; // closed at this store
    if (!slot.allLocations && location && storeCap === null) continue; // not assigned to this store
    const override = overrides.find(o => o.timeSlotId === slot.id && location && o.locationId === location.id)
      || overrides.find(o => o.timeSlotId === slot.id && !o.locationId);
    const capacity = override ? override.maxBookings : (storeCap ?? slot.maxBookings);
    const booked = await bookedCount(slot.id, day, location?.id, transaction);
    const status = override && override.maxBookings === 0 ? 'closed' : booked >= capacity ? 'full' : 'available';
    result.push({
      id: slot.id,
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity,
      booked,
      remaining: Math.max(capacity - booked, 0),
      status,
      available: status === 'available',
      reason: status === 'closed' ? (override.reason || 'Not available on this date') : status === 'full' ? 'Fully booked' : null,
      slot,
    });
  }
  return result;
};

/**
 * Concurrent bookings for the same slot, date and store wait for each other until commit / rollback, so two
 * orders can't both read the capacity count before either is saved. The date is normalised by Postgres.
 */
const lockSlotCapacity = (timeSlotId, locationId, pickupDate, transaction) => sequelize.query(
  `SELECT pg_advisory_xact_lock(hashtextextended(:key || to_char(CAST(:pickupDate AS date), 'YYYY-MM-DD'), 0))`,
  { replacements: { key: `booking-slot:${timeSlotId}:${locationId || 'none'}:`, pickupDate }, transaction },
);

/**
 * Checks a booking request inside its transaction: the date is bookable at the store, the slot runs that day there,
 * and (after taking the slot's lock) it still has room. Throws an error with statusCode 400 / 409 otherwise.
 */
const assertBookable = async ({ pickupDate, timeSlotId, location }, transaction) => {
  if (!isDay(pickupDate)) throw availabilityError(400, 'Choose a valid pickup date');
  const settings = await getSettings(transaction);
  const window = bookingWindow(settings, location);
  const exceptions = (await exceptionsBetween(pickupDate, pickupDate, location?.id, transaction)).map(e => e.toJSON());
  const status = dateStatus(pickupDate, { settings, window, exceptions, location });
  if (!status.available) throw availabilityError(400, `${status.reason}. Please choose another date.`);

  const timeSlot = await TimeSlot.findByPk(timeSlotId, { lock: transaction.LOCK.SHARE, transaction });
  if (!timeSlot || !timeSlot.isActive) throw availabilityError(404, 'Time slot not found');
  await lockSlotCapacity(timeSlot.id, location?.id, pickupDate, transaction);
  const slot = (await listSlots(pickupDate, location, transaction)).find(s => s.id === timeSlot.id);
  if (!slot) throw availabilityError(400, 'This time slot is not available on that date. Please choose another.');
  if (slot.status === 'closed') throw availabilityError(400, `${slot.reason}. Please choose another time slot.`);
  if (slot.status === 'full') throw availabilityError(400, 'This time slot is fully booked. Please choose another.');
  return { timeSlot, settings };
};

module.exports = {
  NO_STORE,
  getSettings,
  dayIn,
  addDays,
  weekdayOf,
  isDay,
  bookingWindow,
  listDates,
  listSlots,
  lockSlotCapacity,
  assertBookable,
};
