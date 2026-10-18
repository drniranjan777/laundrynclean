const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

// Public - view reviews
router.get('/item/:itemId', reviewController.getItemReviews);

// Authenticated
router.get('/my-reviews', authenticate, reviewController.getMyReviews);

router.post('/', authenticate, [
  body('itemId').isUUID().withMessage('Valid item ID is required'),
  body('bookingId').optional().isUUID().withMessage('Invalid booking ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment too long'),
], validate, reviewController.addReview);

router.delete('/:id', authenticate, reviewController.deleteReview);

module.exports = router;
