'use strict';

// Subscriptions are paid from the wallet, so wallet history needs a 'subscription' entry type.
// Plain SQL: Sequelize's column helpers misbehave on Postgres 18 (see 20240101000022).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TYPE enum_wallet_transactions_reference_type ADD VALUE IF NOT EXISTS 'subscription'",
    );
  },

  // Postgres can't drop a value from an enum type; an unused extra value is harmless
  async down() {},
};
