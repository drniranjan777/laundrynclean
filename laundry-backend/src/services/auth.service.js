const User = require('../models/user.model');
const { generateToken, generateRefreshToken } = require('../config/jwt');
const smsService = require('./sms.service');

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_LOCK_MINUTES = 30;

/**
 * Who may sign in through each app's OTP endpoints. The customer app (/auth) serves customers and
 * registers new numbers; the driver app (/drivers) only serves delivery boys the store has created.
 */
const AUDIENCES = {
  customer: {
    role: 'customer',
    autoRegister: true,
    otherRoleStatus: 403,
    otherRoleMessage: "This number belongs to a staff account and can't be used in the customer app.",
    notFoundMessage: 'User not found. Please request OTP first.',
  },
  driver: {
    role: 'driver',
    autoRegister: false,
    otherRoleStatus: 404, // don't reveal that the number has some other account
    otherRoleMessage: "This number isn't registered as a delivery partner. Please contact your store.",
    notFoundMessage: "This number isn't registered as a delivery partner. Please contact your store.",
  },
};

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const audienceFor = (name) => {
  const audience = AUDIENCES[name];
  if (!audience) throw new Error(`Unknown OTP audience: ${name}`);
  return audience;
};

// Indian mobile number as stored on users.phone: the last 10 digits
const normalisePhone = (phone = '') => String(phone).replace(/\D/g, '').slice(-10);

const assertActive = (user) => {
  if (!user.isActive) {
    throw httpError(403, 'Your account has been blocked. Please contact support.');
  }
};

/** The account behind a number for this app, or an error that this app may show */
const findAccount = async (cleanPhone, audience) => {
  const user = await User.findOne({ where: { phone: cleanPhone } });
  if (user && user.role !== audience.role) throw httpError(audience.otherRoleStatus, audience.otherRoleMessage);
  return user;
};

/**
 * Send OTP to mobile number
 * The customer app creates the account if it doesn't exist (auto-registration); the driver app never does.
 */
const sendOtp = async ({ phone, countryCode = '+91' }, audienceName = 'customer') => {
  const audience = audienceFor(audienceName);

  // Validate Indian mobile number (10 digits)
  const cleanPhone = normalisePhone(phone);
  if (cleanPhone.length !== 10) {
    throw httpError(422, 'Please enter a valid mobile number');
  }

  let user = await findAccount(cleanPhone, audience);

  if (user) {
    assertActive(user);

    const lastSentAt = user.otpExpiresAt ? new Date(user.otpExpiresAt.getTime() - OTP_EXPIRY_MINUTES * 60 * 1000) : null;

    // Check resend cooldown
    if (lastSentAt && new Date() < new Date(lastSentAt.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000)) {
      throw httpError(429, `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP`);
    }

    // Too many wrong OTPs locks the number for OTP_LOCK_MINUTES after the last OTP was sent
    if (user.otpAttempts >= MAX_OTP_ATTEMPTS && lastSentAt && new Date() < new Date(lastSentAt.getTime() + OTP_LOCK_MINUTES * 60 * 1000)) {
      throw httpError(429, `Too many OTP attempts. Please try again after ${OTP_LOCK_MINUTES} minutes.`);
    }
  } else if (audience.autoRegister) {
    // Auto-register new user
    user = await User.create({
      phone: cleanPhone,
      countryCode,
      role: audience.role,
    });
  } else {
    throw httpError(404, audience.notFoundMessage);
  }

  // Generate OTP
  const otp = smsService.generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Save OTP to user
  user.otp = otp;
  user.otpExpiresAt = otpExpiresAt;
  user.otpAttempts = 0;
  await user.save();

  // Send OTP via SMS
  await smsService.sendOtp(cleanPhone, otp);

  return {
    message: 'OTP sent successfully',
    phone: cleanPhone,
    expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
    isNewUser: !user.isVerified,
  };
};

/**
 * Verify OTP and return JWT tokens
 */
const verifyOtp = async ({ phone, otp }, audienceName = 'customer') => {
  const audience = audienceFor(audienceName);
  const cleanPhone = normalisePhone(phone);

  // An OTP sent by one app can't sign in to the other: the account must have this app's role
  const user = await findAccount(cleanPhone, audience);
  if (!user) {
    throw httpError(404, audience.notFoundMessage);
  }

  assertActive(user);

  // Check if OTP exists
  if (!user.otp || !user.otpExpiresAt) {
    const error = new Error('No OTP requested. Please request a new OTP.');
    error.statusCode = 400;
    throw error;
  }

  // Check max attempts
  if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
    const error = new Error('Too many failed attempts. Please request a new OTP.');
    error.statusCode = 429;
    throw error;
  }

  // Check OTP expiry
  if (new Date() > user.otpExpiresAt) {
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();
    const error = new Error('OTP has expired. Please request a new one.');
    error.statusCode = 410;
    throw error;
  }

  // Verify OTP
  if (user.otp !== otp) {
    user.otpAttempts += 1;
    await user.save();
    const remainingAttempts = MAX_OTP_ATTEMPTS - user.otpAttempts;
    const error = new Error(`Invalid OTP. ${remainingAttempts} attempts remaining.`);
    error.statusCode = 401;
    throw error;
  }

  // OTP verified - clear OTP fields
  const isFirstLogin = !user.isVerified;
  user.otp = null;
  user.otpExpiresAt = null;
  user.otpAttempts = 0;
  user.isVerified = true;
  user.lastLoginAt = new Date();
  await user.save();

  // Generate tokens
  const token = generateToken({ id: user.id, role: user.role, phone: user.phone });
  const refreshToken = generateRefreshToken({ id: user.id });

  return {
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      countryCode: user.countryCode,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isProfileComplete: user.isProfileComplete,
      isVerified: user.isVerified,
    },
    token,
    refreshToken,
    isNewUser: isFirstLogin,
  };
};

/**
 * Resend OTP (same as sendOtp but with explicit intent)
 */
const resendOtp = async ({ phone, countryCode = '+91' }, audienceName = 'customer') => {
  return sendOtp({ phone, countryCode }, audienceName);
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (refreshToken) => {
  const { verifyRefreshToken } = require('../config/jwt');
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      const error = new Error('User not found or inactive');
      error.statusCode = 401;
      throw error;
    }
    const token = generateToken({ id: user.id, role: user.role, phone: user.phone });
    return { token };
  } catch (err) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }
};

/**
 * Logout - clear device token
 */
const logout = async (userId) => {
  const user = await User.findByPk(userId);
  if (user) {
    user.deviceToken = null;
    await user.save();
  }
  return { message: 'Logged out successfully' };
};

module.exports = { sendOtp, verifyOtp, resendOtp, refreshAccessToken, logout, normalisePhone };
