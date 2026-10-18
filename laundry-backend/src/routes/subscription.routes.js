const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

// Public - view plans
router.get('/plans', authenticate, subscriptionController.getPlans);

// Authenticated
router.get('/my-subscription', authenticate, subscriptionController.getMySubscription);
router.get('/history', authenticate, subscriptionController.getHistory);

router.post('/subscribe', authenticate, [
  body('planId').isUUID().withMessage('Valid plan ID is required'),
  body('paymentMethod').optional().isIn(['card', 'upi', 'wallet']).withMessage('Invalid payment method'),
], validate, subscriptionController.subscribe);

router.post('/cancel', authenticate, subscriptionController.cancelSubscription);

module.exports = router;
