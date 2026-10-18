'use strict';

// POS bills can contain custom items that aren't in the catalogue, which have no item_id.
// Plain SQL: Sequelize's changeColumn doesn't drop NOT NULL on Postgres 18.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE booking_items ALTER COLUMN item_id DROP NOT NULL');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE booking_items ALTER COLUMN item_id SET NOT NULL');
  },
};
