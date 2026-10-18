'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      icon: { type: Sequelize.STRING, allowNull: true },
      image_url: { type: Sequelize.STRING, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('sub_categories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      category_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'categories', key: 'id' }, onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false },
      color: { type: Sequelize.STRING, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      category_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'categories', key: 'id' }, onDelete: 'CASCADE' },
      sub_category_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'sub_categories', key: 'id' } },
      name: { type: Sequelize.STRING, allowNull: false },
      brand: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url: { type: Sequelize.STRING, allowNull: true },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      original_price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      discount_percent: { type: Sequelize.INTEGER, defaultValue: 0 },
      colors: { type: Sequelize.JSONB, allowNull: true },
      sizes: { type: Sequelize.JSONB, allowNull: true },
      avg_rating: { type: Sequelize.DECIMAL(2, 1), defaultValue: 0 },
      review_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      is_add_on: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_limited_offer: { type: Sequelize.BOOLEAN, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('items');
    await queryInterface.dropTable('sub_categories');
    await queryInterface.dropTable('categories');
  },
};
