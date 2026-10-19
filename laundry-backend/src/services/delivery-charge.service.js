const { Op } = require('sequelize');
const { DeliveryChargeRule } = require('../models/pickup.model');
const { getSettings, dayIn } = require('./pickup-availability.service');

/**
 * Pickup & delivery charges from the admin's rules. One rule applies to an order: the store's own active rule
 * (for today, by effective dates), else the default rule. Charges never stack.
 */

// Used only if no rule is configured at all (the migration creates a default one)
const FALLBACK = { id: null, name: 'Standard', locationId: null, freeAbove: 250, minItemsFree: 10, deliveryCharge: 50, pickupCharge: 0 };

const money = (n) => Math.round(Number(n || 0) * 100) / 100;

const effectiveOn = (day) => ({
  isActive: true,
  [Op.and]: [
    { [Op.or]: [{ effectiveFrom: null }, { effectiveFrom: { [Op.lte]: day } }] },
    { [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: day } }] },
  ],
});

/** The rule for a store today (business timezone) */
const ruleFor = async (locationId, transaction) => {
  const settings = await getSettings(transaction);
  const day = dayIn(new Date(), settings.timezone);
  const order = [['effectiveFrom', 'DESC NULLS LAST'], ['created_at', 'DESC']];
  if (locationId) {
    const own = await DeliveryChargeRule.findOne({ where: { ...effectiveOn(day), locationId }, order, transaction });
    if (own) return own;
  }
  return (await DeliveryChargeRule.findOne({ where: { ...effectiveOn(day), locationId: null }, order, transaction })) || FALLBACK;
};

/** The rule as numbers, for the app and the admin panel */
const summarise = (rule) => ({
  id: rule.id,
  name: rule.name,
  scope: rule.locationId ? 'store' : 'default',
  freeAbove: money(rule.freeAbove),
  minItemsFree: rule.minItemsFree === null || rule.minItemsFree === undefined ? null : Number(rule.minItemsFree),
  deliveryCharge: money(rule.deliveryCharge),
  pickupCharge: money(rule.pickupCharge),
  charge: money(Number(rule.deliveryCharge) + Number(rule.pickupCharge)),
});

/**
 * Charges for an order of `subtotal` with `quantity` pieces: the full charge below the free threshold (or with
 * fewer pieces than the rule's minimum, when set), nothing above. A plan with free delivery waives it.
 */
const chargesFor = (rule, { subtotal, quantity, freeDelivery = false }) => {
  const r = summarise(rule);
  const below = subtotal < r.freeAbove || (r.minItemsFree !== null && quantity < r.minItemsFree);
  const applies = below && !freeDelivery;
  return {
    deliveryFee: applies ? r.charge : 0,
    deliveryCharge: applies ? r.deliveryCharge : 0,
    pickupCharge: applies ? r.pickupCharge : 0,
    waivedByMembership: below && freeDelivery,
    rule: r,
  };
};

/** Customer-facing explanation of a rule */
const describe = (rule) => {
  const r = summarise(rule);
  if (r.charge === 0) return 'Pickup and delivery are free.';
  const items = r.minItemsFree ? ` or have fewer than ${r.minItemsFree} items` : '';
  return `Orders below ₹${r.freeAbove}${items} have a ₹${r.charge} pickup & delivery charge. Orders of ₹${r.freeAbove} and above are picked up and delivered free.`;
};

module.exports = { FALLBACK, ruleFor, summarise, chargesFor, describe, money };
