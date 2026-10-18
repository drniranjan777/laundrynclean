const env = require('./env');

// Payment gateway configuration (Razorpay/Stripe)
const paymentConfig = {
  key: env.PAYMENT_KEY,
  secret: env.PAYMENT_SECRET,
  currency: 'INR',
  webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
};

module.exports = paymentConfig;
