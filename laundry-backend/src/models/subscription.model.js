const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Subscription Plans (Admin managed)
const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false, // Basic, Starter, Standard, Platinum
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false, // Monthly price
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 30, // Duration in days
  },
  durationType: {
    type: DataTypes.ENUM('days', 'month', 'year'),
    defaultValue: 'month',
    field: 'duration_type',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  features: {
    type: DataTypes.JSONB,
    allowNull: true, // Array of feature strings
  },
  freeDelivery: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'free_delivery',
  },
  discountPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    field: 'discount_percent', // Extra discount on services
  },
  trialDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'trial_days',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order',
  },
}, {
  tableName: 'subscription_plans',
  timestamps: true,
});

// User Subscriptions
const UserSubscription = sequelize.define('UserSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
  },
  planId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'plan_id',
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'cancelled', 'trial'),
    defaultValue: 'active',
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_date',
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_date',
  },
  trialEndsAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_ends_at',
  },
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'amount_paid',
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'payment_method',
  },
  autoRenew: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'auto_renew',
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cancelled_at',
  },
}, {
  tableName: 'user_subscriptions',
  timestamps: true,
});

SubscriptionPlan.hasMany(UserSubscription, { foreignKey: 'plan_id', as: 'subscriptions' });
UserSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id', as: 'plan' });

module.exports = { SubscriptionPlan, UserSubscription };
