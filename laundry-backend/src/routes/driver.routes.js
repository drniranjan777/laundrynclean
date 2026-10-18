const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driver.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');
const { authValidation } = require('../validations/auth.validation');

// Public - Driver app login with mobile OTP (only delivery boys created by a store; no sign-up).
// Token refresh and logout use /auth/refresh-token and /auth/logout.
router.post('/send-otp', authValidation.sendOtp, validate, driverController.driverSendOtp);
router.post('/verify-otp', authValidation.verifyOtp, validate, driverController.driverVerifyOtp);
router.post('/resend-otp', authValidation.sendOtp, validate, driverController.driverResendOtp);

// Public - Driver login with email + password (older login, kept while the app moves to OTP)
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, driverController.driverLogin);

// Protected - Driver only
router.use(authenticate, authorize('driver'));

router.get('/stats', driverController.getDriverStats);
router.get('/my-orders', driverController.getMyOrders);
router.patch('/orders/:id/status', [
  body('status').isIn(['picked_up', 'in_process', 'out_for_delivery', 'delivered']).withMessage('Invalid status'),
], validate, driverController.updateOrderStatus);
// A pickup or delivery that couldn't be done (reason required)
router.post('/orders/:id/failed', driverController.reportFailedAttempt);

module.exports = router;
