const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true, // Set during profile completion
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true, // Optional - OTP-based auth uses phone
    unique: true,
  },
  phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
    unique: true,
  },
  countryCode: {
    type: DataTypes.STRING(5),
    defaultValue: '+91',
    field: 'country_code',
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Not needed for OTP-based login
  },
  otp: {
    type: DataTypes.STRING(4),
    allowNull: true,
  },
  otpExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'otp_expires_at',
  },
  otpAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'otp_attempts',
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_verified',
  },
  role: {
    type: DataTypes.ENUM('customer', 'driver', 'admin', 'manager'), // manager = branch manager of one location
    defaultValue: 'customer',
  },
  locationId: {
    type: DataTypes.UUID,
    allowNull: true, // Location a driver or branch manager works at
    field: 'location_id',
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  isProfileComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_profile_complete',
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login_at',
  },
  deviceToken: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'device_token', // For push notifications
  },
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
