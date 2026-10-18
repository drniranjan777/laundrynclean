'use strict';

// What happened to an order on the road, recorded by the driver app: status changes, failed pickup /
// delivery attempts (with a reason), cash collected for COD orders, and proof photos.
// Plain SQL: Sequelize's column helpers misbehave on Postgres 18 (see 20240101000022).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS booking_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
        type VARCHAR(30) NOT NULL,
        from_status VARCHAR(30),
        to_status VARCHAR(30),
        reason VARCHAR(255),
        note TEXT,
        photo_url VARCHAR(255),
        amount DECIMAL(10, 2),
        item_count INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS booking_events_booking_id ON booking_events (booking_id, created_at)');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS booking_events');
  },
};
