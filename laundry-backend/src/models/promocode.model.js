const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PromoCode = sequelize.define('PromoCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false, // e.g., "Personal offer", "Summer Sale"
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  discountType: {
    type: DataTypes.ENUM('percentage', 'flat'),
    defaultValue: 'percentage',
    field: 'discount_type',
  },
  discountValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'discount_value', // 10 = 10% or ₹10 based on type
  },
  maxDiscount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'max_discount', // Cap for percentage discounts
  },
  minOrderAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'min_order_amount',
  },
  validFrom: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'valid_from',
  },
  validUntil: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'valid_until',
  },
  usageLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'usage_limit', // Total usage limit (null = unlimited)
  },
  usagePerUser: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    field: 'usage_per_user', // How many times one user can use
  },
  usedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'used_count',
  },
  isUserSpecific: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_user_specific', // If true, only assigned users can use
  },
  isNewUserOnly: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_new_user_only', // If true, only first-time users (no previous orders) can use
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'image_url', // Promo banner image
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'promo_codes',
  timestamps: true,
});

// Track which users a promo is assigned to (for user-specific promos)
const UserPromoCode = sequelize.define('UserPromoCode', {
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
  promoCodeId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'promo_code_id',
  },
  usedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'used_count',
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_used_at',
  },
}, {
  tableName: 'user_promo_codes',
  timestamps: true,
});

PromoCode.hasMany(UserPromoCode, { foreignKey: 'promo_code_id', as: 'userAssignments' });
UserPromoCode.belongsTo(PromoCode, { foreignKey: 'promo_code_id', as: 'promoCode' });

module.exports = { PromoCode, UserPromoCode };
