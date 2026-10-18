const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Address = sequelize.define('Address', {
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
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'full_name',
  },
  phone: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  addressLine: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'address_line',
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pincode: {
    type: DataTypes.STRING(6),
    allowNull: false,
  },
  country: {
    type: DataTypes.STRING,
    defaultValue: 'India',
  },
  lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  label: {
    type: DataTypes.STRING,
    defaultValue: 'Home',
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_default',
  },
}, {
  tableName: 'addresses',
  timestamps: true,
});

module.exports = Address;
