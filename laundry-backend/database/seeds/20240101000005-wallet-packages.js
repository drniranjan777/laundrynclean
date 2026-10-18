'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('wallet_packages', [
      { id: uuidv4(), name: 'Starter Pack', pay_amount: 200, credit_amount: 220, bonus_amount: 20, description: 'Pay ₹200, Get ₹220', is_active: true, sort_order: 1, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), name: 'Value Pack', pay_amount: 500, credit_amount: 600, bonus_amount: 100, description: 'Pay ₹500, Get ₹600', is_active: true, sort_order: 2, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), name: 'Super Pack', pay_amount: 1000, credit_amount: 1250, bonus_amount: 250, description: 'Pay ₹1000, Get ₹1250', is_active: true, sort_order: 3, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), name: 'Mega Pack', pay_amount: 2000, credit_amount: 2600, bonus_amount: 600, description: 'Pay ₹2000, Get ₹2600', is_active: true, sort_order: 4, created_at: new Date(), updated_at: new Date() },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('wallet_packages', null, {});
  },
};
