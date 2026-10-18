const { SubscriptionPlan, UserSubscription } = require('../models/subscription.model');
const { sendSuccess, sendError } = require('../utils/response');
const { Op } = require('sequelize');

/**
 * GET /api/v1/subscriptions/plans
 * Get all available subscription plans
 */
const getPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['price', 'ASC']],
    });

    // Check if user has active subscription
    let activePlanId = null;
    if (req.user) {
      const activeSub = await UserSubscription.findOne({
        where: {
          userId: req.user.id,
          status: { [Op.in]: ['active', 'trial'] },
          endDate: { [Op.gt]: new Date() },
        },
      });
      if (activeSub) activePlanId = activeSub.planId;
    }

    return sendSuccess(res, 200, 'Plans fetched', {
      plans,
      activePlanId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/subscriptions/my-subscription
 * Get user's current active subscription
 */
const getMySubscription = async (req, res, next) => {
  try {
    const subscription = await UserSubscription.findOne({
      where: {
        userId: req.user.id,
        status: { [Op.in]: ['active', 'trial'] },
        endDate: { [Op.gt]: new Date() },
      },
      include: [{ model: SubscriptionPlan, as: 'plan' }],
      order: [['created_at', 'DESC']],
    });

    if (!subscription) {
      return sendSuccess(res, 200, 'No active subscription', { subscription: null });
    }

    return sendSuccess(res, 200, 'Subscription fetched', { subscription });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/subscriptions/subscribe
 * Subscribe to a plan
 */
const subscribe = async (req, res, next) => {
  try {
    const { planId, paymentMethod } = req.body;

    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan || !plan.isActive) {
      return sendError(res, 404, 'Plan not found or inactive');
    }

    // Check for existing active subscription
    const existingSub = await UserSubscription.findOne({
      where: {
        userId: req.user.id,
        status: { [Op.in]: ['active', 'trial'] },
        endDate: { [Op.gt]: new Date() },
      },
    });

    if (existingSub) {
      return sendError(res, 409, 'You already have an active subscription. Cancel it first to switch plans.');
    }

    // Calculate dates
    const startDate = new Date();
    let endDate = new Date();
    let trialEndsAt = null;

    if (plan.trialDays > 0) {
      trialEndsAt = new Date(startDate.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
    }

    if (plan.durationType === 'month') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (plan.durationType === 'year') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setDate(endDate.getDate() + plan.duration);
    }

    const subscription = await UserSubscription.create({
      userId: req.user.id,
      planId,
      status: plan.trialDays > 0 ? 'trial' : 'active',
      startDate,
      endDate,
      trialEndsAt,
      amountPaid: parseFloat(plan.price),
      paymentMethod: paymentMethod || 'wallet',
      autoRenew: true,
    });

    return sendSuccess(res, 201, 'Subscription activated', {
      subscription,
      plan,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/subscriptions/cancel
 * Cancel current subscription
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await UserSubscription.findOne({
      where: {
        userId: req.user.id,
        status: { [Op.in]: ['active', 'trial'] },
        endDate: { [Op.gt]: new Date() },
      },
    });

    if (!subscription) {
      return sendError(res, 404, 'No active subscription found');
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;
    await subscription.save();

    return sendSuccess(res, 200, 'Subscription cancelled. It remains active until the end date.', {
      endDate: subscription.endDate,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/subscriptions/history
 * Get subscription history
 */
const getHistory = async (req, res, next) => {
  try {
    const subscriptions = await UserSubscription.findAll({
      where: { userId: req.user.id },
      include: [{ model: SubscriptionPlan, as: 'plan', attributes: ['name', 'price'] }],
      order: [['created_at', 'DESC']],
    });

    return sendSuccess(res, 200, 'Subscription history fetched', subscriptions);
  } catch (error) {
    next(error);
  }
};

module.exports = { getPlans, getMySubscription, subscribe, cancelSubscription, getHistory };
