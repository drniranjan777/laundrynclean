const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Driver-app history of an order. type:
 * - status: a status change (fromStatus → toStatus)
 * - pickup_failed / delivery_failed: an attempt that didn't happen, with a reason
 * - cash_collected: COD cash taken at the door (amount)
 */
const BookingEvent = sequelize.define('BookingEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'booking_id',
  },
  actorId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'actor_id',
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  fromStatus: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'from_status',
  },
  toStatus: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'to_status',
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  photoUrl: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'photo_url',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  itemCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'item_count',
  },
  // Who received the clothes (delivery or shop collection)
  receiverName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'receiver_name',
  },
  // The delivery partner who handed it over (the actor may be the staff member who confirmed it)
  partnerId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'partner_id',
  },
}, {
  tableName: 'booking_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = BookingEvent;
