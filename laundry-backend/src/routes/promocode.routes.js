const express = require('express');
const router = express.Router();
const promocodeController = require('../controllers/promocode.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

router.use(authenticate);

router.get('/', promocodeController.getPromoCodes);

router.post('/apply', [
  body('code').trim().notEmpty().withMessage('Promo code is required'),
  body('orderAmount').isFloat({ min: 0 }).withMessage('Order amount is required'),
], validate, promocodeController.applyPromoCode);

module.exports = router;
