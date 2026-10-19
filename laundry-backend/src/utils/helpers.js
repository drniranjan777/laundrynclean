const { sequelize } = require('../config/db');
const { ORDER_STATUS_TRANSITIONS } = require('./constants');

/**
 * Generate sequential 4-digit order number (0001, 0002, 0003...)
 * Uses the booking_order_number_seq sequence (see migrations), so concurrent
 * orders never share a number. A rolled-back order leaves a gap.
 */
const generateOrderNumber = async (transaction) => {
  const [result] = await sequelize.query(
    `SELECT nextval('booking_order_number_seq') AS next_num`,
    { type: sequelize.QueryTypes.SELECT, transaction }
  );
  return result.next_num.toString().padStart(4, '0');
};

/**
 * Whether a booking may move from one status to another (setting the same status is a no-op)
 */
const canChangeStatus = (from, to) => from === to || (ORDER_STATUS_TRANSITIONS[from] || []).includes(to);

const paginate = (page = 1, limit = 10) => {
  const offset = (parseInt(page) - 1) * parseInt(limit);
  return { offset, limit: parseInt(limit) };
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

/** Cash still to collect for an order: its total for an unpaid cash order (COD, or a store order paid later), else 0 */
/**
 * Cash the partner collects at delivery: COD orders, and bulk pickups (billed after pickup) that the customer
 * chose to pay online but hadn't paid by the time they are delivered.
 */
const cashDue = (booking) => (booking.paymentStatus !== 'paid' && (booking.paymentMethod === 'cod' || booking.bookingType === 'bulk_pickup')
  ? Number(booking.total)
  : 0);

module.exports = { generateOrderNumber, canChangeStatus, paginate, formatCurrency, cashDue };
