const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GstSettings = sequelize.define('GstSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  gstin: {
    type: DataTypes.STRING(15),
    allowNull: true, // e.g., 29ABCDE1234F1ZP
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'business_name',
  },
  businessAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'business_address',
  },
  businessPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'business_phone',
  },
  gstRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 18.00,
    field: 'gst_rate', // Total GST % (e.g., 18)
  },
  gstType: {
    type: DataTypes.ENUM('inclusive', 'exclusive'),
    defaultValue: 'exclusive',
    field: 'gst_type', // inclusive = price includes GST, exclusive = GST added on top
  },
  hsnCode: {
    type: DataTypes.STRING(10),
    defaultValue: '9971',
    field: 'hsn_code', // HSN for laundry services
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_enabled', // Toggle GST on/off
  },
  invoicePrefix: {
    type: DataTypes.STRING(10),
    defaultValue: 'INV',
    field: 'invoice_prefix',
  },
  invoiceCounter: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'invoice_counter', // Auto-increment for invoice numbers
  },
}, {
  tableName: 'gst_settings',
  timestamps: true,
});

module.exports = GstSettings;
