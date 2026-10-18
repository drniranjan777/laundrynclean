const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { body, query } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

router.use(authenticate);

// User endpoints
router.get('/', walletController.getWallet);
router.get('/transactions', walletController.getTransactions);
router.get('/packages', walletController.getPackages);

router.post('/create-order', [
  body('amount').if(body('packageId').not().exists()).isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
  body('packageId').optional().isUUID().withMessage('Invalid package ID'),
], validate, walletController.createRechargeOrder);

router.post('/add-money', [
  body('razorpayOrderId').isString().notEmpty().withMessage('razorpayOrderId is required'),
  body('razorpayPaymentId').isString().notEmpty().withMessage('razorpayPaymentId is required'),
  body('razorpaySignature').isString().notEmpty().withMessage('razorpaySignature is required'),
  body('paymentMethod').optional().isIn(['card', 'upi']).withMessage('Invalid payment method'),
], validate, walletController.addMoney);

module.exports = router;
