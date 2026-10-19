'use strict';

// Schedule Pickup: everything about when pickups can be booked and what they cost becomes admin-configurable.
// - pickup_settings: one row of global settings (booking window, working days, timezone, instructions, switches)
// - locations.pickup_enabled / max_advance_days: per-store switch and booking window
// - pickup_date_exceptions: holidays / blocked dates, or extra open days (global or per store)
// - time_slots.days / all_locations: which weekdays a slot runs, and whether every store has it
// - slot_date_overrides: capacity for one slot on one date (0 = closed / marked full), global or per store
// - delivery_charge_rules: free-delivery threshold and charges, default or per store, with effective dates
// - bookings.booking_type / idempotency_key: bulk pickups (no items until the store bills them) and protection
//   against the same booking being created twice by a repeated tap or a network retry
// - admin_audit_logs: who changed which setting, with before / after values
// Defaults reproduce today's behaviour: tomorrow onward, no Sundays, ₹50 below ₹250 or fewer than 10 items.
// Plain SQL: Sequelize's column helpers misbehave on Postgres 18 (see 20240101000022).
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await q(`
      CREATE TABLE IF NOT EXISTS pickup_settings (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        bulk_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        min_advance_days INTEGER NOT NULL DEFAULT 1 CHECK (min_advance_days >= 1),
        max_advance_days INTEGER NOT NULL DEFAULT 7 CHECK (max_advance_days BETWEEN 1 AND 90),
        timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
        working_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
        instructions TEXT,
        policies TEXT,
        updated_by UUID REFERENCES users (id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (max_advance_days >= min_advance_days)
      )
    `);
    await q(`
      INSERT INTO pickup_settings (id, instructions, policies) VALUES (1,
        'Keep your clothes ready and packed. Our pickup partner will arrive within your selected time slot.',
        'Schedule Pickup is for bulk orders (home, office, hotel or hostel laundry). Same-day pickup is not available. Clothes are counted and billed at the store after pickup; pickup and delivery charges follow the delivery charge rules.')
      ON CONFLICT (id) DO NOTHING
    `);

    await q(`
      ALTER TABLE locations
        ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS max_advance_days INTEGER CHECK (max_advance_days BETWEEN 1 AND 90)
    `);

    await q(`
      CREATE TABLE IF NOT EXISTS pickup_date_exceptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL,
        location_id UUID REFERENCES locations (id) ON DELETE CASCADE,
        is_open BOOLEAN NOT NULL DEFAULT FALSE,
        reason VARCHAR(255),
        created_by UUID REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS pickup_date_exceptions_date_location
      ON pickup_date_exceptions (date, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))`);

    await q(`
      ALTER TABLE time_slots
        ADD COLUMN IF NOT EXISTS days SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
        ADD COLUMN IF NOT EXISTS all_locations BOOLEAN NOT NULL DEFAULT TRUE
    `);

    await q(`
      CREATE TABLE IF NOT EXISTS slot_date_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        time_slot_id UUID NOT NULL REFERENCES time_slots (id) ON DELETE CASCADE,
        location_id UUID REFERENCES locations (id) ON DELETE CASCADE,
        date DATE NOT NULL,
        max_bookings INTEGER NOT NULL CHECK (max_bookings BETWEEN 0 AND 10000),
        reason VARCHAR(255),
        created_by UUID REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS slot_date_overrides_slot_date_location
      ON slot_date_overrides (time_slot_id, date, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))`);

    await q(`
      CREATE TABLE IF NOT EXISTS delivery_charge_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        location_id UUID REFERENCES locations (id) ON DELETE CASCADE,
        free_above DECIMAL(10, 2) NOT NULL DEFAULT 250 CHECK (free_above >= 0),
        min_items_free INTEGER CHECK (min_items_free >= 0),
        delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 50 CHECK (delivery_charge >= 0),
        pickup_charge DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (pickup_charge >= 0),
        effective_from DATE,
        effective_to DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
      )
    `);
    await q(`
      INSERT INTO delivery_charge_rules (name, location_id, free_above, min_items_free, delivery_charge, pickup_charge)
      SELECT 'Standard', NULL, 250, 10, 50, 0
      WHERE NOT EXISTS (SELECT 1 FROM delivery_charge_rules WHERE location_id IS NULL)
    `);

    await q(`
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (booking_type IN ('standard', 'bulk_pickup')),
        ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80)
    `);
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS bookings_user_idempotency_key
      ON bookings (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`);

    await q(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
        action VARCHAR(60) NOT NULL,
        entity VARCHAR(40) NOT NULL,
        entity_id VARCHAR(64),
        before JSONB,
        after JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await q('CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_created ON admin_audit_logs (entity, created_at DESC)');
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('DROP TABLE IF EXISTS admin_audit_logs');
    await q('DROP INDEX IF EXISTS bookings_user_idempotency_key');
    await q('ALTER TABLE bookings DROP COLUMN IF EXISTS booking_type, DROP COLUMN IF EXISTS idempotency_key');
    await q('DROP TABLE IF EXISTS delivery_charge_rules');
    await q('DROP TABLE IF EXISTS slot_date_overrides');
    await q('ALTER TABLE time_slots DROP COLUMN IF EXISTS days, DROP COLUMN IF EXISTS all_locations');
    await q('DROP TABLE IF EXISTS pickup_date_exceptions');
    await q('ALTER TABLE locations DROP COLUMN IF EXISTS pickup_enabled, DROP COLUMN IF EXISTS max_advance_days');
    await q('DROP TABLE IF EXISTS pickup_settings');
  },
};
