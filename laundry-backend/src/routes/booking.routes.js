const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { body, query } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

router.use(authenticate);

// Scheduling
router.get('/available-dates', bookingController.getAvailableDates);
router.get('/time-slots', [
  query('date').notEmpty().isDate().withMessage('Valid date is required (YYYY-MM-DD)'),
  query('addressId').optional({ values: 'falsy' }).isUUID().withMessage('Invalid address ID'),
  query('pincode').optional({ values: 'falsy' }).isString().trim(),
], validate, bookingController.getTimeSlots);

// Booking CRUD
router.post('/confirm', [
  body('addressId').isUUID().withMessage('Valid address ID is required'),
  body('pickupDate').isDate().withMessage('Valid pickup date is required'),
  body('timeSlotId').isUUID().withMessage('Valid time slot ID is required'),
  body('paymentMethod').optional().isIn(['wallet', 'card', 'upi', 'cod']).withMessage('Invalid payment method'),
  body('promoCode').optional({ values: 'falsy' }).isString().trim(),
  body('promoCodeId').optional({ values: 'falsy' }).isUUID().withMessage('Invalid promo code ID'),
  body('disclaimerAccepted').optional().isBoolean(),
], validate, bookingController.confirmBooking);

router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.patch('/:id/status', authorize('admin', 'manager'), [
  body('status').isIn(['pending', 'confirmed', 'pickup_scheduled', 'picked_up', 'in_process', 'ready', 'out_for_delivery', 'delivered', 'cancelled']).withMessage('Invalid status'),
], validate, bookingController.updateBookingStatus);
router.patch('/:id/cancel', bookingController.cancelBooking);
router.post('/:id/verify-payment', [
  body('razorpayOrderId').isString().notEmpty().withMessage('razorpayOrderId is required'),
  body('razorpayPaymentId').isString().notEmpty().withMessage('razorpayPaymentId is required'),
  body('razorpaySignature').isString().notEmpty().withMessage('razorpaySignature is required'),
], validate, bookingController.verifyBookingPayment);

module.exports = router;
