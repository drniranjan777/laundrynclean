'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_plans', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      duration: { type: Sequelize.INTEGER, defaultValue: 30 },
      duration_type: { type: Sequelize.ENUM('days', 'month', 'year'), defaultValue: 'month' },
      description: { type: Sequelize.TEXT, allowNull: true },
      features: { type: Sequelize.JSONB, allowNull: true },
      free_delivery: { type: Sequelize.BOOLEAN, defaultValue: false },
      discount_percent: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      trial_days: { type: Sequelize.INTEGER, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('user_subscriptions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      plan_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'subscription_plans', key: 'id' } },
      status: { type: Sequelize.ENUM('active', 'expired', 'cancelled', 'trial'), defaultValue: 'active' },
      start_date: { type: Sequelize.DATE, allowNull: false },
      end_date: { type: Sequelize.DATE, allowNull: false },
      trial_ends_at: { type: Sequelize.DATE, allowNull: true },
      amount_paid: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      payment_method: { type: Sequelize.STRING, allowNull: true },
      auto_renew: { type: Sequelize.BOOLEAN, defaultValue: true },
      cancelled_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_subscriptions');
    await queryInterface.dropTable('subscription_plans');
  },
};
