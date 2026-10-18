const { PromoCode, UserPromoCode } = require('../models/promocode.model');
const { sendSuccess, sendError } = require('../utils/response');
const { Op } = require('sequelize');

/**
 * GET /api/v1/promocodes
 * Get available promo codes for the user
 */
const getPromoCodes = async (req, res, next) => {
  try {
    const now = new Date();

    // Get public promos (not user-specific)
    const publicPromos = await PromoCode.findAll({
      where: {
        isActive: true,
        isUserSpecific: false,
        validFrom: { [Op.lte]: now },
        validUntil: { [Op.gt]: now },
      },
      order: [['discountValue', 'DESC']],
    });

    // Get user-specific promos assigned to this user
    const userPromoAssignments = await UserPromoCode.findAll({
      where: { userId: req.user.id },
      include: [{
        model: PromoCode,
        as: 'promoCode',
        where: {
          isActive: true,
          validFrom: { [Op.lte]: now },
          validUntil: { [Op.gt]: now },
        },
      }],
    });

    const userPromos = userPromoAssignments.map(a => a.promoCode);
    const allPromos = [...publicPromos, ...userPromos];

    // Check if user has previous orders (for filtering new-user-only promos)
    const { Booking } = require('../models/booking.model');
    const { Op: SeqOp } = require('sequelize');
    const previousOrders = await Booking.count({
      where: { userId: req.user.id, status: { [SeqOp.notIn]: ['cancelled'] } },
    });
    const isNewUser = previousOrders === 0;

    // Add daysRemaining and filter new-user-only promos
    const promosWithExpiry = allPromos
      .filter(promo => !promo.isNewUserOnly || isNewUser) // Hide new-user promos from existing users
      .map(promo => {
        const daysRemaining = Math.ceil((new Date(promo.validUntil) - now) / (1000 * 60 * 60 * 24));
        return {
          ...promo.toJSON(),
          daysRemaining,
          isNewUserOnly: promo.isNewUserOnly || false,
        };
      });

    return sendSuccess(res, 200, 'Promo codes fetched', promosWithExpiry);
  } catch (error) {
    next(error);
  }
};

const promoError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Validate a promo code for a user and work out the discount on the server.
 * Looks the promo up by `code` or `promoCodeId`. Throws an error with a
 * statusCode when the promo can't be used.
 */
const calculatePromoDiscount = async ({ userId, code, promoCodeId, orderAmount, transaction }) => {
  const now = new Date();
  const where = {
    isActive: true,
    validFrom: { [Op.lte]: now },
    validUntil: { [Op.gt]: now },
  };
  if (code) where.code = code.toUpperCase();
  else where.id = promoCodeId;

  const promo = await PromoCode.findOne({ where, transaction });
  if (!promo) throw promoError(404, 'Invalid or expired promo code');

  // Check usage limit
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
    throw promoError(400, 'This promo code has reached its usage limit');
  }

  // Check per-user usage (the same row also marks user-specific assignment)
  const userUsage = await UserPromoCode.findOne({
    where: { userId, promoCodeId: promo.id },
    transaction,
  });

  if (userUsage && userUsage.usedCount >= promo.usagePerUser) {
    throw promoError(400, 'You have already used this promo code');
  }

  if (promo.isUserSpecific && !userUsage) {
    throw promoError(403, 'This promo code is not available for you');
  }

  // Check if new user only promo
  if (promo.isNewUserOnly) {
    const { Booking } = require('../models/booking.model');
    const previousOrders = await Booking.count({
      where: { userId, status: { [Op.notIn]: ['cancelled'] } },
      transaction,
    });
    if (previousOrders > 0) {
      throw promoError(400, 'This promo code is only valid for first-time orders');
    }
  }

  // Check minimum order amount
  if (orderAmount < parseFloat(promo.minOrderAmount)) {
    throw promoError(400, `Minimum order amount is ₹${promo.minOrderAmount} for this promo`);
  }

  // Calculate discount
  let discount = 0;
  if (promo.discountType === 'percentage') {
    discount = (orderAmount * parseFloat(promo.discountValue)) / 100;
    if (promo.maxDiscount && discount > parseFloat(promo.maxDiscount)) {
      discount = parseFloat(promo.maxDiscount);
    }
  } else {
    discount = parseFloat(promo.discountValue);
  }

  // Discount cannot exceed order amount
  if (discount > orderAmount) discount = orderAmount;

  return { promo, discount: Math.round(discount * 100) / 100 };
};

/**
 * POST /api/v1/promocodes/apply
 * Apply a promo code to an order
 */
const applyPromoCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    const orderAmount = parseFloat(req.body.orderAmount);
    const { promo, discount } = await calculatePromoDiscount({ userId: req.user.id, code, orderAmount });

    return sendSuccess(res, 200, 'Promo code applied', {
      promoCodeId: promo.id,
      code: promo.code,
      title: promo.title,
      discountType: promo.discountType,
      discountValue: parseFloat(promo.discountValue),
      discount,
      finalAmount: Math.round((orderAmount - discount) * 100) / 100,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark promo code as used (called once the order is paid or confirmed)
 */
const markPromoUsed = async (userId, promoCodeId, transaction) => {
  await PromoCode.increment('usedCount', { by: 1, where: { id: promoCodeId }, transaction });

  const [userPromo] = await UserPromoCode.findOrCreate({
    where: { userId, promoCodeId },
    defaults: { userId, promoCodeId, usedCount: 0 },
    transaction,
  });
  userPromo.usedCount += 1;
  userPromo.lastUsedAt = new Date();
  await userPromo.save({ transaction });
};

module.exports = { getPromoCodes, applyPromoCode, calculatePromoDiscount, markPromoUsed };
