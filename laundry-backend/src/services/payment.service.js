const crypto = require('crypto');
const paymentConfig = require('../config/payment');

const RAZORPAY_API = 'https://api.razorpay.com/v1';

const paymentError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertConfigured = () => {
  if (!paymentConfig.key || !paymentConfig.secret) {
    throw paymentError(503, 'Online payments are not available right now');
  }
};

const razorpayRequest = async (method, path, body) => {
  assertConfigured();
  const auth = Buffer.from(`${paymentConfig.key}:${paymentConfig.secret}`).toString('base64');

  let response;
  try {
    response = await fetch(`${RAZORPAY_API}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw paymentError(502, 'Could not reach the payment gateway. Please try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.description || response.statusText;
    throw paymentError(502, `Payment gateway error: ${detail}`);
  }
  return data;
};

/**
 * Create a Razorpay order. `amount` is in rupees; notes are set by the server
 * and returned untouched by Razorpay, so they can be trusted on verification.
 */
const createOrder = async ({ amount, receipt, notes }) => {
  const order = await razorpayRequest('POST', '/orders', {
    amount: toPaise(amount),
    currency: paymentConfig.currency,
    receipt: String(receipt).slice(0, 40),
    notes,
  });
  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: paymentConfig.key,
  };
};

const fetchOrder = (orderId) => razorpayRequest('GET', `/orders/${encodeURIComponent(orderId)}`);

/**
 * Check the signature Razorpay Checkout returns after a successful payment.
 */
const verifySignature = ({ orderId, paymentId, signature }) => {
  assertConfigured();
  const expected = crypto
    .createHmac('sha256', paymentConfig.secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Verify a checkout result and return the paid Razorpay order.
 * Throws unless the signature is valid and the order is fully paid.
 */
const verifyPaidOrder = async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const valid = verifySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });
  if (!valid) throw paymentError(400, 'Payment verification failed');

  const order = await fetchOrder(razorpayOrderId);
  if (order.status !== 'paid' || order.amount_paid < order.amount) {
    throw paymentError(400, 'Payment has not been completed');
  }
  return order;
};

const toPaise = (amount) => Math.round(parseFloat(amount) * 100);

module.exports = { createOrder, fetchOrder, verifySignature, verifyPaidOrder, toPaise };
