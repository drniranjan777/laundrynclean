'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('serviceable_pincodes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      pincode: {
        type: Sequelize.STRING(6),
        allowNull: false,
        unique: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      state: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      area: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      delivery_days: {
        type: Sequelize.INTEGER,
        defaultValue: 2,
      },
      minimum_order: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 99.00,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Index for fast pincode lookup
    await queryInterface.addIndex('serviceable_pincodes', ['pincode'], { unique: true, name: 'idx_serviceable_pincodes_pincode' });
    await queryInterface.addIndex('serviceable_pincodes', ['city'], { name: 'idx_serviceable_pincodes_city' });
    await queryInterface.addIndex('serviceable_pincodes', ['is_active'], { name: 'idx_serviceable_pincodes_active' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('serviceable_pincodes');
  },
};
