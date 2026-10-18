'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'customer' LIMIT 6`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const items = await queryInterface.sequelize.query(
      `SELECT id FROM items LIMIT 10`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0 || items.length === 0) return;

    const now = new Date();
    const reviews = [
      { id: uuidv4(), user_id: users[0].id, item_id: items[0].id, rating: 5, comment: 'Excellent ironing quality! My blazer looked brand new.', is_verified_purchase: true, is_visible: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[1].id, item_id: items[0].id, rating: 4, comment: 'Good service, slightly late delivery but quality was great.', is_verified_purchase: true, is_visible: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[2].id, item_id: items[1].id, rating: 5, comment: 'Perfect creases on my pants. Very happy with the service!', is_verified_purchase: true, is_visible: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[3].id, item_id: items[2].id, rating: 4, comment: 'T-shirt came out great. Will use again.', is_verified_purchase: true, is_visible: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[0].id, item_id: items[3].id, rating: 5, comment: 'Shirts were perfectly pressed. Love this service!', is_verified_purchase: true, is_visible: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[4].id, item_id: items[5].id, rating: 3, comment: 'Average quality. Expected better for the price.', is_verified_purchase: false, is_visible: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[5].id, item_id: items[7].id, rating: 5, comment: 'Man shirt came out crisp and fresh. Highly recommend!', is_verified_purchase: true, is_visible: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[2].id, item_id: items[8].id, rating: 4, comment: 'Quick pickup and delivery. T-shirt quality was nice.', is_verified_purchase: true, is_visible: true, created_at: now, updated_at: now },
    ];

    await queryInterface.bulkInsert('reviews', reviews);

    // Update item ratings
    for (const item of items.slice(0, 9)) {
      const result = await queryInterface.sequelize.query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE item_id = '${item.id}' AND is_visible = true`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      if (result[0] && result[0].review_count > 0) {
        await queryInterface.sequelize.query(
          `UPDATE items SET avg_rating = ${parseFloat(result[0].avg_rating).toFixed(1)}, review_count = ${result[0].review_count} WHERE id = '${item.id}'`
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('reviews', null, {});
  },
};
