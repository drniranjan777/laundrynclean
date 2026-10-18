'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'customer' LIMIT 3`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const plans = await queryInterface.sequelize.query(
      `SELECT id, name FROM subscription_plans LIMIT 4`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0 || plans.length === 0) return;

    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscriptions = [
      { id: uuidv4(), user_id: users[0].id, plan_id: plans[2]?.id || plans[0].id, status: 'active', start_date: now, end_date: endDate, amount_paid: 500, payment_method: 'wallet', auto_renew: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[1].id, plan_id: plans[0]?.id, status: 'active', start_date: now, end_date: endDate, amount_paid: 150, payment_method: 'upi', auto_renew: true, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[2].id, plan_id: plans[3]?.id || plans[1].id, status: 'trial', start_date: now, end_date: endDate, trial_ends_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), amount_paid: 0, payment_method: 'wallet', auto_renew: true, created_at: now, updated_at: now },
    ];

    await queryInterface.bulkInsert('user_subscriptions', subscriptions);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('user_subscriptions', null, {});
  },
};
