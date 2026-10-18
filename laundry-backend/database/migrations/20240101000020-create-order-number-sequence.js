'use strict';

// Order numbers come from a sequence so concurrent orders can't get the same number.
// It starts after the highest purely numeric order number already used ("0016" -> 17);
// legacy numbers like "ORD-001-ABC" can't collide with the padded format.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('CREATE SEQUENCE IF NOT EXISTS booking_order_number_seq START WITH 1');
    await queryInterface.sequelize.query(`
      SELECT setval(
        'booking_order_number_seq',
        COALESCE((SELECT MAX(order_number::BIGINT) FROM bookings WHERE order_number ~ '^[0-9]+$'), 0) + 1,
        false
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS booking_order_number_seq');
  },
};
