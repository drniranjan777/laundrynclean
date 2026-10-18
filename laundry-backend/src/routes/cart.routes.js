const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

router.use(authenticate);

// Cart
router.get('/', cartController.getCart);
router.post('/', [
  body('itemId').isUUID().withMessage('Valid item ID is required'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('color').optional().trim(),
  body('size').optional().trim(),
], validate, cartController.addToCart);
router.patch('/:id/quantity', [
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be 0 or more'),
], validate, cartController.updateQuantity);
router.delete('/:id', cartController.removeFromCart);
router.delete('/', cartController.clearCart);

// Favorites
router.get('/favorites', cartController.getFavorites);
router.post('/favorites', [
  body('itemId').isUUID().withMessage('Valid item ID is required'),
], validate, cartController.addToFavorites);
router.delete('/favorites/:itemId', cartController.removeFromFavorites);

module.exports = router;
