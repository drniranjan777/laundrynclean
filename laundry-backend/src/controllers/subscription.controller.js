const { SubscriptionPlan, UserSubscription } = require('../models/subscription.model');
const { sendSuccess, sendError } = require('../utils/response');
const { sequelize } = require('../config/db');
const { currentSubscription } = require('../services/subscription.service');
const { debitWallet } = require('./wallet.controller');

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Plans the customer has already had (a plan's free trial is given once). */
const plansUsed = async (userId, transaction) => {
  const rows = await UserSubscription.findAll({ where: { userId }, attributes: ['planId'], transaction });
  return new Set(rows.map(r => r.planId));
};

/**
 * GET /api/v1/subscriptions/plans
 * All available plans, the customer's current plan and whether each plan's free trial is still available
 */
const getPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['price', 'ASC']],
    });

    const current = await currentSubscription(req.user.id);
    const used = await plansUsed(req.user.id);

    return sendSuccess(res, 200, 'Plans fetched', {
      plans: plans.map(p => ({ ...p.toJSON(), trialAvailable: p.trialDays > 0 && !used.has(p.id) })),
      activePlanId: current ? current.planId : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/subscriptions/my-subscription
 * The customer's current plan. A cancelled plan is still returned (status 'cancelled') until its end date,
 * because its benefits last until then.
 */
const getMySubscription = async (req, res, next) => {
  try {
    const subscription = await currentSubscription(req.user.id);
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
 * Start a plan. A plan with trial days starts as a free trial the first time the customer takes it;
 * otherwise its price is paid from the wallet (Add money first if the balance is short).
 */
const subscribe = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { planId } = req.body;

    const plan = await SubscriptionPlan.findByPk(planId, { transaction: t });
    if (!plan || !plan.isActive) {
      await t.rollback();
      return sendError(res, 404, 'Plan not found or inactive');
    }

    const existing = await currentSubscription(req.user.id, t);
    if (existing) {
      await t.rollback();
      const name = existing.plan ? existing.plan.name : 'current';
      return sendError(res, 409, existing.status === 'cancelled'
        ? `Your ${name} plan runs until ${formatDate(existing.endDate)}. You can pick a new plan after that.`
        : `You already have the ${name} plan. Cancel it first to switch plans.`);
    }

    const startDate = new Date();
    const used = await plansUsed(req.user.id, t);
    const isTrial = plan.trialDays > 0 && !used.has(plan.id);
    const price = parseFloat(plan.price);

    let endDate = new Date(startDate);
    if (isTrial) {
      endDate.setDate(endDate.getDate() + plan.trialDays);
    } else if (plan.durationType === 'month') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (plan.durationType === 'year') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setDate(endDate.getDate() + plan.duration);
    }

    const subscription = await UserSubscription.create({
      userId: req.user.id,
      planId,
      status: isTrial ? 'trial' : 'active',
      startDate,
      endDate,
      trialEndsAt: isTrial ? endDate : null,
      amountPaid: isTrial ? 0 : price,
      paymentMethod: isTrial ? 'trial' : 'wallet',
      autoRenew: false, // there is no automatic billing; the customer renews from the app
    }, { transaction: t });

    let walletBalance = null;
    if (!isTrial && price > 0) {
      try {
        walletBalance = await debitWallet(req.user.id, price, subscription.id, t, {
          description: `${plan.name} plan subscription`,
          referenceType: 'subscription',
        });
      } catch (error) {
        if (error.shortfall === undefined) throw error;
        await t.rollback();
        return sendError(res, 400, `Not enough wallet balance. Add ₹${error.shortfall} to your wallet to get the ${plan.name} plan.`, {
          shortfall: error.shortfall,
        });
      }
    }

    await t.commit();

    return sendSuccess(res, 201, isTrial
      ? `Your ${plan.trialDays}-day free trial of ${plan.name} has started`
      : `${plan.name} plan activated`, {
      subscription: { ...subscription.toJSON(), plan },
      walletBalance,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * POST /api/v1/subscriptions/cancel
 * Cancel the current plan. Nothing is refunded; the plan and its benefits stay until the end date.
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await currentSubscription(req.user.id);
    if (!subscription || subscription.status === 'cancelled') {
      return sendError(res, 404, 'No active subscription found');
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;
    await subscription.save();

    return sendSuccess(res, 200, `Subscription cancelled. Your benefits stay until ${formatDate(subscription.endDate)}.`, {
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
