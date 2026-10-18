const Review = require('../models/review.model');
const { Item } = require('../models/category.model');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/response');
const { sequelize } = require('../config/db');

/**
 * GET /api/v1/reviews/item/:itemId
 * Get reviews for an item
 */
const getItemReviews = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows, count } = await Review.findAndCountAll({
      where: { itemId, isVisible: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'avatar'],
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    // Calculate rating breakdown
    const ratingBreakdown = await Review.findAll({
      where: { itemId, isVisible: true },
      attributes: [
        'rating',
        [sequelize.fn('COUNT', sequelize.col('rating')), 'count'],
      ],
      group: ['rating'],
      raw: true,
    });

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingBreakdown.forEach(r => { breakdown[r.rating] = parseInt(r.count); });

    return sendSuccess(res, 200, 'Reviews fetched', {
      reviews: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
      ratingBreakdown: breakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/reviews
 * Add a review for an item
 */
const addReview = async (req, res, next) => {
  try {
    const { itemId, bookingId, rating, comment, imageUrls } = req.body;

    // Check item exists
    const item = await Item.findByPk(itemId);
    if (!item) return sendError(res, 404, 'Item not found');

    // Check duplicate review
    const existingWhere = { userId: req.user.id, itemId };
    if (bookingId) existingWhere.bookingId = bookingId;

    const existing = await Review.findOne({ where: existingWhere });
    if (existing) return sendError(res, 409, 'You have already reviewed this item');

    // Check if verified purchase
    let isVerifiedPurchase = false;
    if (bookingId) {
      const { Booking, BookingItem } = require('../models/booking.model');
      const booking = await Booking.findOne({
        where: { id: bookingId, userId: req.user.id, status: 'delivered' },
      });
      if (booking) {
        const bookedItem = await BookingItem.findOne({ where: { bookingId, itemId } });
        if (bookedItem) isVerifiedPurchase = true;
      }
    }

    const review = await Review.create({
      userId: req.user.id,
      itemId,
      bookingId,
      rating,
      comment,
      imageUrls,
      isVerifiedPurchase,
    });

    // Update item's average rating
    const avgResult = await Review.findOne({
      where: { itemId, isVisible: true },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount'],
      ],
      raw: true,
    });

    await Item.update(
      {
        avgRating: parseFloat(avgResult.avgRating).toFixed(1),
        reviewCount: parseInt(avgResult.reviewCount),
      },
      { where: { id: itemId } }
    );

    return sendSuccess(res, 201, 'Review added', review);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/reviews/my-reviews
 * Get user's own reviews
 */
const getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Item,
        as: 'item',
        attributes: ['id', 'name', 'imageUrl', 'price'],
      }],
      order: [['created_at', 'DESC']],
    });

    return sendSuccess(res, 200, 'My reviews fetched', reviews);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/reviews/:id
 * Delete own review
 */
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!review) return sendError(res, 404, 'Review not found');

    const itemId = review.itemId;
    await review.destroy();

    // Recalculate item rating
    const avgResult = await Review.findOne({
      where: { itemId, isVisible: true },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount'],
      ],
      raw: true,
    });

    await Item.update(
      {
        avgRating: avgResult.avgRating ? parseFloat(avgResult.avgRating).toFixed(1) : 0,
        reviewCount: parseInt(avgResult.reviewCount) || 0,
      },
      { where: { id: itemId } }
    );

    return sendSuccess(res, 200, 'Review deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = { getItemReviews, addReview, getMyReviews, deleteReview };
