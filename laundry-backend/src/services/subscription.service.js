const { Op } = require('sequelize');
const { SubscriptionPlan, UserSubscription } = require('../models/subscription.model');

/**
 * The customer's current plan: active, on trial, or cancelled but not yet ended (a cancelled plan keeps its
 * benefits until its end date). Null when there is none.
 */
const currentSubscription = (userId, transaction) => UserSubscription.findOne({
  where: {
    userId,
    status: { [Op.in]: ['active', 'trial', 'cancelled'] },
    endDate: { [Op.gt]: new Date() },
  },
  include: [{ model: SubscriptionPlan, as: 'plan' }],
  order: [['created_at', 'DESC']],
  transaction,
});

/**
 * What the current plan gives on an order: { planName, discountPercent, freeDelivery }, or null for
 * customers without a plan.
 */
const memberBenefits = async (userId, transaction) => {
  if (!userId) return null;
  const sub = await currentSubscription(userId, transaction);
  if (!sub || !sub.plan) return null;
  return {
    planName: sub.plan.name,
    discountPercent: parseFloat(sub.plan.discountPercent) || 0,
    freeDelivery: !!sub.plan.freeDelivery,
  };
};

/** The member discount on an order subtotal, rounded to paise. */
const memberDiscountOn = (subtotal, benefits) => (benefits && benefits.discountPercent > 0
  ? Math.round(subtotal * benefits.discountPercent) / 100
  : 0);

module.exports = { currentSubscription, memberBenefits, memberDiscountOn };
