const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Review = sequelize.define('Review', {
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
  itemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'item_id',
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'booking_id', // Link to booking for verified purchase
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false, // 1-5 stars
    validate: { min: 1, max: 5 },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imageUrls: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'image_urls', // User-uploaded review images
  },
  isVerifiedPurchase: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_verified_purchase',
  },
  isVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_visible', // Admin can hide inappropriate reviews
  },
}, {
  tableName: 'reviews',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['user_id', 'item_id', 'booking_id'] }, // One review per item per booking
  ],
});

module.exports = Review;
