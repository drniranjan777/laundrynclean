const { Op } = require('sequelize');
const { isUuid, locationFilter } = require('./location-scope');

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INDIA = '+05:30';

/**
 * `where` for the staff order lists and the Order Management tab counts, so both agree:
 * - store scope (a branch manager's store, or the admin's store switcher)
 * - search: order number, customer name or mobile
 * - dateFrom / dateTo: order date (YYYY-MM-DD, India time), inclusive
 * - driverId: delivery partner (or 'none' for orders without one)
 * - orderType: online | offline
 * - paymentStatus: paid | pending | failed | refunded
 * - paymentMethod: cod (cash) | upi | card | wallet
 * - bookingType: standard | bulk_pickup (Schedule Pickup)
 * - timeSlotId: pickup time slot
 * - locationId: a store (admins; a branch manager always sees their own store)
 * - pickupFrom / pickupTo: scheduled pickup date (YYYY-MM-DD), inclusive
 * Returns { where } or { error } for a bad filter.
 */
const staffOrderFilters = (req) => {
  const { search, dateFrom, dateTo, driverId, orderType, paymentStatus, paymentMethod, bookingType, timeSlotId, locationId, pickupFrom, pickupTo } = req.query;
  const where = { ...locationFilter(req) };
  if (locationId && req.user?.role !== 'manager') {
    if (!isUuid(locationId)) return { error: 'Invalid store' };
    where.locationId = locationId;
  }

  const s = typeof search === 'string' ? search.trim() : '';
  if (s) {
    const digits = s.replace(/\D/g, '');
    where[Op.or] = [
      { orderNumber: { [Op.iLike]: `%${s}%` } },
      { invoiceNumber: { [Op.iLike]: `%${s}%` } },
      { customerName: { [Op.iLike]: `%${s}%` } },
      ...(digits.length >= 3 ? [{ customerPhone: { [Op.like]: `%${digits}%` } }] : []),
    ];
  }

  if (dateFrom || dateTo) {
    if ((dateFrom && !DAY.test(dateFrom)) || (dateTo && !DAY.test(dateTo))) return { error: 'Dates must be YYYY-MM-DD' };
    const range = {};
    if (dateFrom) range[Op.gte] = new Date(`${dateFrom}T00:00:00${INDIA}`);
    if (dateTo) {
      const end = new Date(`${dateTo}T00:00:00${INDIA}`);
      end.setDate(end.getDate() + 1);
      range[Op.lt] = end;
    }
    where.created_at = range;
  }

  if (driverId) {
    if (driverId === 'none') where.driverId = null;
    else if (isUuid(driverId)) where.driverId = driverId;
    else return { error: 'Invalid delivery partner' };
  }

  if (orderType) {
    if (!['online', 'offline'].includes(orderType)) return { error: 'orderType must be online or offline' };
    where.orderType = orderType;
  }

  if (paymentStatus) {
    if (!['paid', 'pending', 'failed', 'refunded'].includes(paymentStatus)) return { error: 'Unknown payment status' };
    where.paymentStatus = paymentStatus;
  }

  if (paymentMethod) {
    if (!['cod', 'upi', 'card', 'wallet'].includes(paymentMethod)) return { error: 'Unknown payment method' };
    where.paymentMethod = paymentMethod;
  }

  if (bookingType) {
    if (!['standard', 'bulk_pickup'].includes(bookingType)) return { error: 'bookingType must be standard or bulk_pickup' };
    where.bookingType = bookingType;
  }

  if (timeSlotId) {
    if (!isUuid(timeSlotId)) return { error: 'Invalid time slot' };
    where.timeSlotId = timeSlotId;
  }

  if (pickupFrom || pickupTo) {
    if ((pickupFrom && !DAY.test(pickupFrom)) || (pickupTo && !DAY.test(pickupTo))) return { error: 'Pickup dates must be YYYY-MM-DD' };
    where.pickupDate = { ...(pickupFrom ? { [Op.gte]: pickupFrom } : {}), ...(pickupTo ? { [Op.lte]: pickupTo } : {}) };
  }

  return { where };
};

/** Start of today in India time, as a Date (dashboard "today" figures match the date filter above) */
const startOfIndiaDay = (date = new Date()) => {
  const day = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return new Date(`${day}T00:00:00${INDIA}`);
};

module.exports = { staffOrderFilters, startOfIndiaDay };
