'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('time_slots', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      start_time: { type: Sequelize.STRING, allowNull: false },
      end_time: { type: Sequelize.STRING, allowNull: false },
      label: { type: Sequelize.STRING, allowNull: false },
      max_bookings: { type: Sequelize.INTEGER, defaultValue: 20 },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('bookings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      order_number: { type: Sequelize.STRING, allowNull: false, unique: true },
      address_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'addresses', key: 'id' } },
      driver_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      pickup_date: { type: Sequelize.DATEONLY, allowNull: true },
      time_slot_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'time_slots', key: 'id' } },
      subtotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      delivery_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      discount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      promo_code_id: { type: Sequelize.UUID, allowNull: true },
      payment_method: { type: Sequelize.ENUM('wallet', 'card', 'upi', 'cod'), defaultValue: 'wallet' },
      payment_status: { type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'), defaultValue: 'pending' },
      status: { type: Sequelize.ENUM('pending', 'confirmed', 'pickup_scheduled', 'picked_up', 'in_process', 'ready', 'out_for_delivery', 'delivered', 'cancelled'), defaultValue: 'pending' },
      notes: { type: Sequelize.TEXT, allowNull: true },
      disclaimer_accepted: { type: Sequelize.BOOLEAN, defaultValue: false },
      estimated_delivery_date: { type: Sequelize.DATEONLY, allowNull: true },
      // POS / Offline fields
      order_type: { type: Sequelize.ENUM('online', 'offline'), defaultValue: 'online' },
      invoice_number: { type: Sequelize.STRING, allowNull: true, unique: true },
      gst_amount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      gst_rate: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      cgst: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      sgst: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      customer_note: { type: Sequelize.TEXT, allowNull: true },
      customer_name: { type: Sequelize.STRING, allowNull: true },
      customer_phone: { type: Sequelize.STRING, allowNull: true },
      payment_method_detail: { type: Sequelize.STRING, allowNull: true },
      barcode_printed: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('booking_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      booking_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'bookings', key: 'id' }, onDelete: 'CASCADE' },
      item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'items', key: 'id' } },
      name: { type: Sequelize.STRING, allowNull: false },
      color: { type: Sequelize.STRING, allowNull: true },
      size: { type: Sequelize.STRING, allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      line_total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      // POS fields
      item_note: { type: Sequelize.TEXT, allowNull: true },
      garment_color: { type: Sequelize.STRING, allowNull: true },
      barcode: { type: Sequelize.STRING, allowNull: true, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('booking_items');
    await queryInterface.dropTable('bookings');
    await queryInterface.dropTable('time_slots');
  },
};
