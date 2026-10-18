'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reviews', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'items', key: 'id' }, onDelete: 'CASCADE' },
      booking_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'bookings', key: 'id' } },
      rating: { type: Sequelize.INTEGER, allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: true },
      image_urls: { type: Sequelize.JSONB, allowNull: true },
      is_verified_purchase: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_visible: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('reviews', ['user_id', 'item_id', 'booking_id'], { unique: true, name: 'idx_reviews_user_item_booking' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reviews');
  },
};
