'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promo_codes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      discount_type: { type: Sequelize.ENUM('percentage', 'flat'), defaultValue: 'percentage' },
      discount_value: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      max_discount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      min_order_amount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      valid_from: { type: Sequelize.DATE, allowNull: false },
      valid_until: { type: Sequelize.DATE, allowNull: false },
      usage_limit: { type: Sequelize.INTEGER, allowNull: true },
      usage_per_user: { type: Sequelize.INTEGER, defaultValue: 1 },
      used_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      is_user_specific: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_new_user_only: { type: Sequelize.BOOLEAN, defaultValue: false },
      image_url: { type: Sequelize.STRING, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('user_promo_codes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      promo_code_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'promo_codes', key: 'id' }, onDelete: 'CASCADE' },
      used_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      last_used_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_promo_codes');
    await queryInterface.dropTable('promo_codes');
  },
};
