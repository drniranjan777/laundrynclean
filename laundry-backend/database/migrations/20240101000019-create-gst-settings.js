'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('gst_settings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      gstin: { type: Sequelize.STRING(15), allowNull: true },
      business_name: { type: Sequelize.STRING, allowNull: true },
      business_address: { type: Sequelize.TEXT, allowNull: true },
      business_phone: { type: Sequelize.STRING, allowNull: true },
      gst_rate: { type: Sequelize.DECIMAL(5, 2), defaultValue: 18.00 },
      gst_type: { type: Sequelize.ENUM('inclusive', 'exclusive'), defaultValue: 'exclusive' },
      hsn_code: { type: Sequelize.STRING(10), defaultValue: '9971' },
      is_enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
      invoice_prefix: { type: Sequelize.STRING(10), defaultValue: 'INV' },
      invoice_counter: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('gst_settings');
  },
};
