require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

// Refuse to start with a missing, short or placeholder JWT secret: anyone who
// knows the secret can mint tokens for any user, including admins.
const requireSecret = (name) => {
  const value = process.env[name];
  if (NODE_ENV === 'test') return value || `test-only-${name}`;
  if (!value || value.length < 32 || /your-|change-?me|secret-key/i.test(value)) {
    throw new Error(
      `${name} must be set to a random string of at least 32 characters. ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  return value;
};

const JWT_SECRET = requireSecret('JWT_SECRET');
const JWT_REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET');
if (JWT_SECRET === JWT_REFRESH_SECRET && NODE_ENV !== 'test') {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
}

module.exports = {
  NODE_ENV,
  PORT: process.env.PORT || 5000,

  // Database
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_NAME: process.env.DB_NAME || 'laundry_db',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',

  // JWT
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Payment Gateway
  PAYMENT_KEY: process.env.PAYMENT_KEY || '',
  PAYMENT_SECRET: process.env.PAYMENT_SECRET || '',

  // Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',

  // SMS
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  SMS_SENDER_ID: process.env.SMS_SENDER_ID || '',
};
