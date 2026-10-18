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
 * Returns { where } or { error } for a bad filter.
 */
const staffOrderFilters = (req) => {
  const { search, dateFrom, dateTo, driverId, orderType } = req.query;
  const where = { ...locationFilter(req) };

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

  return { where };
};

module.exports = { staffOrderFilters };
