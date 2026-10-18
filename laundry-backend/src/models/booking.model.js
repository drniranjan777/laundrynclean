const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Time slots configuration (admin managed)
const TimeSlot = sequelize.define('TimeSlot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  startTime: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'start_time', // "08:00"
  },
  endTime: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'end_time', // "10:00"
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false, // "08:00 AM - 10:00 AM"
  },
  maxBookings: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    field: 'max_bookings', // Max bookings per slot per day
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'time_slots',
  timestamps: true,
});

// Booking / Order with pickup scheduling
const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true, // Nullable for offline/walk-in orders
    field: 'user_id',
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'order_number',
  },
  addressId: {
    type: DataTypes.UUID,
    allowNull: true, // Nullable for offline orders
    field: 'address_id',
  },
  driverId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'driver_id',
  },
  locationId: {
    type: DataTypes.UUID,
    allowNull: true, // Shop location handling the order (from the pickup pincode, or the POS counter)
    field: 'location_id',
  },
  pickupDate: {
    type: DataTypes.DATEONLY,
    allowNull: true, // Nullable for offline orders
    field: 'pickup_date',
  },
  timeSlotId: {
    type: DataTypes.UUID,
    allowNull: true, // Nullable for offline orders
    field: 'time_slot_id',
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  deliveryFee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'delivery_fee',
  },
  discount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  promoCodeId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'promo_code_id',
  },
  paymentMethod: {
    type: DataTypes.ENUM('wallet', 'card', 'upi', 'cod'),
    defaultValue: 'wallet',
    field: 'payment_method',
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending',
    field: 'payment_status',
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 'confirmed', 'pickup_scheduled', 'picked_up',
      'in_process', 'ready', 'out_for_delivery', 'delivered', 'cancelled'
    ),
    defaultValue: 'pending',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true, // User notes / disruption info
  },
  disclaimerAccepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'disclaimer_accepted',
  },
  estimatedDeliveryDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'estimated_delivery_date',
  },
  // POS / Offline order fields
  orderType: {
    type: DataTypes.ENUM('online', 'offline'),
    defaultValue: 'online',
    field: 'order_type',
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    field: 'invoice_number',
  },
  gstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'gst_amount',
  },
  gstRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    field: 'gst_rate',
  },
  cgst: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  sgst: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  customerNote: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'customer_note',
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'customer_name', // For offline orders (walk-in customers)
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'customer_phone',
  },
  paymentMethodDetail: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'payment_method_detail', // e.g., "Cash", "UPI - PhonePe", "Card - HDFC"
  },
  barcodePrinted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'barcode_printed',
  },
}, {
  tableName: 'bookings',
  timestamps: true,
});

// Booking Items
const BookingItem = sequelize.define('BookingItem', {
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
  itemId: {
    type: DataTypes.UUID,
    allowNull: true, // null for custom POS items that aren't in the catalogue
    field: 'item_id',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false, // Snapshot of item name
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  size: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false, // Price at time of booking
  },
  lineTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'line_total',
  },
  // POS fields
  itemNote: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'item_note', // Stitching issue, stain, missing button etc.
  },
  garmentColor: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'garment_color', // Actual garment color for identification
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true, // Unique barcode per item for tracking
  },
}, {
  tableName: 'booking_items',
  timestamps: true,
});

Booking.hasMany(BookingItem, { foreignKey: 'booking_id', as: 'items' });
BookingItem.belongsTo(Booking, { foreignKey: 'booking_id' });
Booking.belongsTo(TimeSlot, { foreignKey: 'time_slot_id', as: 'timeSlot' });

module.exports = { TimeSlot, Booking, BookingItem };
