const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** One row of global Schedule Pickup settings (id is always 1) */
const PickupSettings = sequelize.define('PickupSettings', {
  id: { type: DataTypes.SMALLINT, primaryKey: true, defaultValue: 1 },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true }, // pickups can be scheduled at all
  bulkEnabled: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'bulk_enabled' }, // direct bulk pickup bookings
  minAdvanceDays: { type: DataTypes.INTEGER, defaultValue: 1, field: 'min_advance_days' }, // 1 = tomorrow onward
  maxAdvanceDays: { type: DataTypes.INTEGER, defaultValue: 7, field: 'max_advance_days' },
  timezone: { type: DataTypes.STRING(64), defaultValue: 'Asia/Kolkata' },
  workingDays: { type: DataTypes.ARRAY(DataTypes.SMALLINT), defaultValue: [1, 2, 3, 4, 5, 6], field: 'working_days' }, // 0 = Sunday
  instructions: { type: DataTypes.TEXT },
  policies: { type: DataTypes.TEXT },
  updatedBy: { type: DataTypes.UUID, field: 'updated_by' },
}, {
  tableName: 'pickup_settings',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
});

/** A date that is closed (holiday, blocked) or open on a non-working day; global or for one store */
const PickupDateException = sequelize.define('PickupDateException', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  locationId: { type: DataTypes.UUID, field: 'location_id' },
  isOpen: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_open' },
  reason: { type: DataTypes.STRING(255) },
  createdBy: { type: DataTypes.UUID, field: 'created_by' },
}, {
  tableName: 'pickup_date_exceptions',
  timestamps: true,
});

/** Capacity of one slot on one date (0 = closed / marked full); global or for one store */
const SlotDateOverride = sequelize.define('SlotDateOverride', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  timeSlotId: { type: DataTypes.UUID, allowNull: false, field: 'time_slot_id' },
  locationId: { type: DataTypes.UUID, field: 'location_id' },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  maxBookings: { type: DataTypes.INTEGER, allowNull: false, field: 'max_bookings' },
  reason: { type: DataTypes.STRING(255) },
  createdBy: { type: DataTypes.UUID, field: 'created_by' },
}, {
  tableName: 'slot_date_overrides',
  timestamps: true,
});

/**
 * Pickup & delivery charges: below `freeAbove` (or with fewer than `minItemsFree` pieces, when set) an order pays
 * deliveryCharge + pickupCharge. A store's own active rule wins over the default (locationId null).
 */
const DeliveryChargeRule = sequelize.define('DeliveryChargeRule', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  locationId: { type: DataTypes.UUID, field: 'location_id' },
  freeAbove: { type: DataTypes.DECIMAL(10, 2), defaultValue: 250, field: 'free_above' },
  minItemsFree: { type: DataTypes.INTEGER, field: 'min_items_free' },
  deliveryCharge: { type: DataTypes.DECIMAL(10, 2), defaultValue: 50, field: 'delivery_charge' },
  pickupCharge: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'pickup_charge' },
  effectiveFrom: { type: DataTypes.DATEONLY, field: 'effective_from' },
  effectiveTo: { type: DataTypes.DATEONLY, field: 'effective_to' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'delivery_charge_rules',
  timestamps: true,
});

/** Who changed which admin setting, with the values before and after */
const AdminAuditLog = sequelize.define('AdminAuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  actorId: { type: DataTypes.UUID, field: 'actor_id' },
  action: { type: DataTypes.STRING(60), allowNull: false },
  entity: { type: DataTypes.STRING(40), allowNull: false },
  entityId: { type: DataTypes.STRING(64), field: 'entity_id' },
  before: { type: DataTypes.JSONB },
  after: { type: DataTypes.JSONB },
}, {
  tableName: 'admin_audit_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = { PickupSettings, PickupDateException, SlotDateOverride, DeliveryChargeRule, AdminAuditLog };
