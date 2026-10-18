'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixDaysLater = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const twentyThreeDaysLater = new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000);

    await queryInterface.bulkInsert('promo_codes', [
      { id: uuidv4(), code: 'MYPROMOCODE2025', title: 'Personal offer', description: 'Get 10% off on your next order', discount_type: 'percentage', discount_value: 10, max_discount: 100, min_order_amount: 200, valid_from: now, valid_until: sixDaysLater, usage_limit: 100, usage_per_user: 1, is_user_specific: false, is_new_user_only: false, is_active: true, created_at: now, updated_at: now },
      { id: uuidv4(), code: 'SUMMER2025', title: 'Summer Sale', description: 'Summer special 15% off', discount_type: 'percentage', discount_value: 15, max_discount: 200, min_order_amount: 300, valid_from: now, valid_until: twentyThreeDaysLater, usage_limit: 500, usage_per_user: 2, is_user_specific: false, is_new_user_only: false, is_active: true, created_at: now, updated_at: now },
      { id: uuidv4(), code: 'FLAT50', title: 'Flat ₹50 Off', description: 'Flat ₹50 discount on orders above ₹250', discount_type: 'flat', discount_value: 50, max_discount: null, min_order_amount: 250, valid_from: now, valid_until: thirtyDaysLater, usage_limit: null, usage_per_user: 3, is_user_specific: false, is_new_user_only: false, is_active: true, created_at: now, updated_at: now },
      { id: uuidv4(), code: 'WELCOME22', title: 'Welcome - First Order', description: '22% off exclusively for new users on their first order', discount_type: 'percentage', discount_value: 22, max_discount: 150, min_order_amount: 100, valid_from: now, valid_until: thirtyDaysLater, usage_limit: null, usage_per_user: 1, is_user_specific: false, is_new_user_only: true, is_active: true, created_at: now, updated_at: now },
      { id: uuidv4(), code: 'FIRSTORDER', title: 'New User Special', description: 'Flat ₹100 off on your first order', discount_type: 'flat', discount_value: 100, max_discount: null, min_order_amount: 200, valid_from: now, valid_until: thirtyDaysLater, usage_limit: null, usage_per_user: 1, is_user_specific: false, is_new_user_only: true, is_active: true, created_at: now, updated_at: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('promo_codes', null, {});
  },
};
