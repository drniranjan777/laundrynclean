const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ServiceablePincode = sequelize.define('ServiceablePincode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  pincode: {
    type: DataTypes.STRING(6),
    allowNull: false,
    unique: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  area: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  locationId: {
    type: DataTypes.UUID,
    allowNull: true, // Shop location that serves this pincode
    field: 'location_id',
  },
  deliveryDays: {
    type: DataTypes.INTEGER,
    defaultValue: 2, // Expected delivery days for this area
    field: 'delivery_days',
  },
  minimumOrder: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 99.00,
    field: 'minimum_order',
  },
}, {
  tableName: 'serviceable_pincodes',
  timestamps: true,
});

module.exports = ServiceablePincode;
