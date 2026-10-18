'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('subscription_plans', [
      { id: uuidv4(), name: 'Basic', price: 150, duration: 30, duration_type: 'month', description: 'Basic plan with essential features', features: JSON.stringify(['Free delivery on orders above ₹200', '5% discount on all services']), free_delivery: false, discount_percent: 5, trial_days: 7, is_active: true, sort_order: 1, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), name: 'Starter', price: 250, duration: 30, duration_type: 'month', description: 'Starter plan for regular users', features: JSON.stringify(['Free delivery on all orders', '10% discount on all services', 'Priority pickup']), free_delivery: true, discount_percent: 10, trial_days: 0, is_active: true, sort_order: 2, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), name: 'Standard', price: 500, duration: 30, duration_type: 'month', description: 'Standard plan for frequent users', features: JSON.stringify(['Free delivery on all orders', '15% discount on all services', 'Priority pickup', 'Express delivery']), free_delivery: true, discount_percent: 15, trial_days: 0, is_active: true, sort_order: 3, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), name: 'Platinum', price: 1000, duration: 30, duration_type: 'month', description: 'Premium plan with all benefits', features: JSON.stringify(['Free delivery on all orders', '20% discount on all services', 'Priority pickup', 'Express delivery', 'Dedicated support', 'Exclusive offers']), free_delivery: true, discount_percent: 20, trial_days: 0, is_active: true, sort_order: 4, created_at: new Date(), updated_at: new Date() },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('subscription_plans', null, {});
  },
};
