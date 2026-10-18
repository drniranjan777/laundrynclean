const authService = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/v1/auth/send-otp
 * Send OTP to mobile number
 */
const sendOtp = async (req, res, next) => {
  try {
    const result = await authService.sendOtp(req.body);
    return sendSuccess(res, 200, 'OTP sent successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/verify-otp
 * Verify OTP and login/register
 */
const verifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp(req.body);
    return sendSuccess(res, 200, 'OTP verified successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/resend-otp
 * Resend OTP to mobile number
 */
const resendOtp = async (req, res, next) => {
  try {
    const result = await authService.resendOtp(req.body);
    return sendSuccess(res, 200, 'OTP resent successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/refresh-token
 * Refresh access token
 */
const refreshToken = async (req, res, next) => {
  try {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    return sendSuccess(res, 200, 'Token refreshed', result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/logout
 * Logout user
 */
const logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.user.id);
    return sendSuccess(res, 200, result.message);
  } catch (error) {
    next(error);
  }
};

module.exports = { sendOtp, verifyOtp, resendOtp, refreshToken, logout };
