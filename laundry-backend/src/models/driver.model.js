const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Driver = sequelize.define('Driver', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'user_id',
  },
  vehicleType: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'vehicle_type',
  },
  license: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_available',
  },
  currentLat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
    field: 'current_lat',
  },
  currentLng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
    field: 'current_lng',
  },
}, {
  tableName: 'drivers',
  timestamps: true,
});

module.exports = Driver;
