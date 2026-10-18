const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authValidation } = require('../validations/auth.validation');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate } = require('../middlewares/auth.middleware');

// OTP-based authentication
router.post('/send-otp', authValidation.sendOtp, validate, authController.sendOtp);
router.post('/verify-otp', authValidation.verifyOtp, validate, authController.verifyOtp);
router.post('/resend-otp', authValidation.sendOtp, validate, authController.resendOtp);

// Token management
router.post('/refresh-token', authValidation.refreshToken, validate, authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
