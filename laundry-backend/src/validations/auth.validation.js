const { body } = require('express-validator');

const authValidation = {
  sendOtp: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Mobile number is required')
      .matches(/^(\+91)?[6-9]\d{9}$/).withMessage('Please enter a valid mobile number'),
    body('countryCode')
      .optional()
      .matches(/^\+\d{1,4}$/).withMessage('Invalid country code'),
  ],
  verifyOtp: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Mobile number is required')
      .matches(/^(\+91)?[6-9]\d{9}$/).withMessage('Please enter a valid mobile number'),
    body('otp')
      .trim()
      .notEmpty().withMessage('OTP is required')
      .isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits')
      .isNumeric().withMessage('OTP must contain only digits'),
  ],
  refreshToken: [
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required'),
  ],
};

module.exports = { authValidation };
