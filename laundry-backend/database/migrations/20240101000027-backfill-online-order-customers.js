'use strict';

// App orders didn't save the customer's name and mobile on the booking (only store orders did), so the
// admin panel showed "—" for them. New orders save it; this fills it in for the ones already placed:
// the customer's account name and mobile, or the pickup address contact when the account has no name.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE bookings b
      SET customer_name = COALESCE(b.customer_name, NULLIF(u.name, '')),
          customer_phone = COALESCE(b.customer_phone, NULLIF(u.phone, ''))
      FROM users u
      WHERE u.id = b.user_id AND b.order_type = 'online' AND (b.customer_name IS NULL OR b.customer_phone IS NULL)
    `);
    await queryInterface.sequelize.query(`
      UPDATE bookings b
      SET customer_name = COALESCE(b.customer_name, NULLIF(a.full_name, '')),
          customer_phone = COALESCE(b.customer_phone, NULLIF(a.phone, ''))
      FROM addresses a
      WHERE a.id = b.address_id AND b.order_type = 'online' AND (b.customer_name IS NULL OR b.customer_phone IS NULL)
    `);
  },

  // The filled-in values can't be told apart from saved ones, and they are correct, so nothing to undo
  async down() {},
};
