'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'customer' LIMIT 6`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0) return;

    const now = new Date();
    const wallets = [];
    const transactions = [];

    users.forEach((user, idx) => {
      const walletId = uuidv4();
      const balance = [2000, 1500, 800, 3200, 500, 1200][idx] || 1000;
      const totalCredited = balance + [400, 230, 450, 200, 300, 405][idx];
      const totalDebited = totalCredited - balance;

      wallets.push({
        id: walletId,
        user_id: user.id,
        balance,
        total_credited: totalCredited,
        total_debited: totalDebited,
        created_at: now,
        updated_at: now,
      });

      // Add some transactions
      transactions.push(
        { id: uuidv4(), wallet_id: walletId, user_id: user.id, type: 'credit', amount: 600, balance_after: balance + 600, description: 'Package: Pay ₹500, Get ₹600', reference_type: 'recharge', payment_method: 'upi', created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), updated_at: now },
        { id: uuidv4(), wallet_id: walletId, user_id: user.id, type: 'credit', amount: 1250, balance_after: balance + 1850, description: 'Package: Pay ₹1000, Get ₹1250', reference_type: 'recharge', payment_method: 'card', created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), updated_at: now },
        { id: uuidv4(), wallet_id: walletId, user_id: user.id, type: 'debit', amount: [400, 230, 450, 200, 300, 405][idx], balance_after: balance, description: 'Payment for order', reference_type: 'order_payment', created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), updated_at: now },
      );
    });

    await queryInterface.bulkInsert('wallets', wallets);
    await queryInterface.bulkInsert('wallet_transactions', transactions);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('wallet_transactions', null, {});
    await queryInterface.bulkDelete('wallets', null, {});
  },
};
