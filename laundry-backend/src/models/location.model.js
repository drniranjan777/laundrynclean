const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Shop location / branch. Each location has its own invoice series and receipt details.
const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true, // Short code, e.g. "KRM"
  },
  addressLine: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'address_line',
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pincode: {
    type: DataTypes.STRING(6),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gstin: {
    type: DataTypes.STRING(15),
    allowNull: true, // Blank = use the GSTIN in GST settings
  },
  invoicePrefix: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    field: 'invoice_prefix',
  },
  invoiceCounter: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'invoice_counter',
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
  // Customers of this store can schedule pickups
  pickupEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'pickup_enabled',
  },
  // This store's booking window in days (null = the global setting)
  maxAdvanceDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'max_advance_days',
  },
}, {
  tableName: 'locations',
  timestamps: true,
});

// Per-location price override and availability for a catalogue item
const LocationItemPrice = sequelize.define('LocationItemPrice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  locationId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'location_id',
  },
  itemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'item_id',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true, // null = use the item's base price
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_available',
  },
}, {
  tableName: 'location_item_prices',
  timestamps: true,
});

// Per-location pickup capacity for a time slot (overrides time_slots.max_bookings)
const LocationTimeSlot = sequelize.define('LocationTimeSlot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  locationId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'location_id',
  },
  timeSlotId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'time_slot_id',
  },
  maxBookings: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'max_bookings', // Orders per day at this store; 0 = slot closed here
  },
}, {
  tableName: 'location_time_slots',
  timestamps: true,
});

module.exports = { Location, LocationItemPrice, LocationTimeSlot };
