'use strict';

// Traceable handover: orders can be collected at the shop (ready_for_pickup → collected) as well as delivered,
// and both record when it happened and who received the clothes. Order history rows can name the receiver and
// the delivery partner.
// Plain SQL: Sequelize's column helpers misbehave on Postgres 18 (see 20240101000022).
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q("ALTER TYPE enum_bookings_status ADD VALUE IF NOT EXISTS 'ready_for_pickup'");
    await q("ALTER TYPE enum_bookings_status ADD VALUE IF NOT EXISTS 'collected'");
    await q(`
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS received_by VARCHAR(100),
        ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS collected_by VARCHAR(100)
    `);
    await q(`
      ALTER TABLE booking_events
        ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users (id) ON DELETE SET NULL
    `);
    // Orders delivered before this: when, from their history (else the last time they changed)
    await q(`
      UPDATE bookings b
      SET delivered_at = COALESCE(
        (SELECT MAX(e.created_at) FROM booking_events e WHERE e.booking_id = b.id AND e.to_status = 'delivered'),
        b.updated_at
      )
      WHERE b.status = 'delivered' AND b.delivered_at IS NULL
    `);
    // Tab counts and status lists filter by status (and store) and sort by date
    await q('CREATE INDEX IF NOT EXISTS bookings_status_created_at ON bookings (status, created_at)');
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('DROP INDEX IF EXISTS bookings_status_created_at');
    await q('ALTER TABLE booking_events DROP COLUMN IF EXISTS receiver_name, DROP COLUMN IF EXISTS partner_id');
    await q('ALTER TABLE bookings DROP COLUMN IF EXISTS delivered_at, DROP COLUMN IF EXISTS received_by, DROP COLUMN IF EXISTS collected_at, DROP COLUMN IF EXISTS collected_by');
    // Postgres can't drop enum values; ready_for_pickup / collected stay in the type unused
  },
};
