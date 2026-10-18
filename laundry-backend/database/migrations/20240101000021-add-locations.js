'use strict';

// Multi-location support: shop locations with their own invoice series, per-location
// item prices, a location on bookings / serviceable pincodes / staff, and a branch
// "manager" role. Existing data is moved to a first "Main Store" location.
module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    };

    await queryInterface.createTable('locations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      code: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      address_line: { type: Sequelize.STRING, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true },
      state: { type: Sequelize.STRING, allowNull: true },
      pincode: { type: Sequelize.STRING(6), allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      gstin: { type: Sequelize.STRING(15), allowNull: true },
      invoice_prefix: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      invoice_counter: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });

    await queryInterface.createTable('location_item_prices', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      location_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'locations', key: 'id' }, onDelete: 'CASCADE' },
      item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'items', key: 'id' }, onDelete: 'CASCADE' },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: true }, // null = use the item's base price
      is_available: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps,
    });
    await queryInterface.addIndex('location_item_prices', ['location_id', 'item_id'], { unique: true });

    for (const table of ['bookings', 'serviceable_pincodes', 'users']) {
      await queryInterface.addColumn(table, 'location_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'locations', key: 'id' },
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex(table, ['location_id']);
    }

    await queryInterface.sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'manager'`);

    // The existing shop becomes the first location and keeps the current invoice series
    const [[gst]] = await queryInterface.sequelize.query('SELECT * FROM gst_settings ORDER BY created_at LIMIT 1');
    const [[main]] = await queryInterface.sequelize.query(`
      INSERT INTO locations (id, name, code, address_line, phone, gstin, invoice_prefix, invoice_counter, is_active, sort_order, created_at, updated_at)
      VALUES (gen_random_uuid(), :name, 'MAIN', :address, :phone, :gstin, :prefix, :counter, true, 0, NOW(), NOW())
      RETURNING id
    `, {
      replacements: {
        name: gst?.business_name || 'Main Store',
        address: gst?.business_address || null,
        phone: gst?.business_phone || null,
        gstin: gst?.gstin || null,
        prefix: gst?.invoice_prefix || 'INV',
        counter: gst?.invoice_counter || 0,
      },
    });

    const replacements = { id: main.id };
    await queryInterface.sequelize.query('UPDATE bookings SET location_id = :id', { replacements });
    await queryInterface.sequelize.query('UPDATE serviceable_pincodes SET location_id = :id', { replacements });
    await queryInterface.sequelize.query(`UPDATE users SET location_id = :id WHERE role = 'driver'`, { replacements });
  },

  async down(queryInterface) {
    // Postgres can't drop an enum value, so 'manager' stays; those accounts are switched off instead
    await queryInterface.sequelize.query(`UPDATE users SET role = 'customer', is_active = false WHERE role = 'manager'`);
    for (const table of ['bookings', 'serviceable_pincodes', 'users']) {
      await queryInterface.removeColumn(table, 'location_id');
    }
    await queryInterface.dropTable('location_item_prices');
    await queryInterface.dropTable('locations');
  },
};
