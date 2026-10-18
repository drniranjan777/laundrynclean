'use strict';

// Pickup slot capacity is per location: each store gets time_slots.max_bookings orders per
// slot per day, unless it has its own number here (0 closes the slot at that store).
// Plain SQL: Sequelize's column helpers misbehave on Postgres 18 (see 20240101000022).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS location_time_slots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
        time_slot_id UUID NOT NULL REFERENCES time_slots (id) ON DELETE CASCADE,
        max_bookings INTEGER NOT NULL CHECK (max_bookings >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (location_id, time_slot_id)
      )
    `);
    // Slot capacity is counted per slot, date and location
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS bookings_time_slot_pickup_date_location
      ON bookings (time_slot_id, pickup_date, location_id)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS bookings_time_slot_pickup_date_location');
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS location_time_slots');
  },
};
