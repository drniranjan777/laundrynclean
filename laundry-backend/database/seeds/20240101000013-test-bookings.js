'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'customer' LIMIT 6`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const addresses = await queryInterface.sequelize.query(
      `SELECT id, user_id FROM addresses LIMIT 7`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const timeSlots = await queryInterface.sequelize.query(
      `SELECT id FROM time_slots LIMIT 4`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const items = await queryInterface.sequelize.query(
      `SELECT id, name, price FROM items LIMIT 10`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0 || addresses.length === 0 || timeSlots.length === 0 || items.length === 0) return;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const bookings = [
      { id: uuidv4(), user_id: users[0].id, order_number: 'ORD-001-ABC', address_id: addresses[0].id, pickup_date: yesterday.toISOString().split('T')[0], time_slot_id: timeSlots[0].id, subtotal: 350, delivery_fee: 0, discount: 0, total: 350, payment_method: 'wallet', payment_status: 'paid', status: 'in_process', notes: 'Please handle with care', disclaimer_accepted: true, estimated_delivery_date: tomorrow.toISOString().split('T')[0], created_at: twoDaysAgo, updated_at: now },
      { id: uuidv4(), user_id: users[1].id, order_number: 'ORD-002-DEF', address_id: addresses[2].id, pickup_date: yesterday.toISOString().split('T')[0], time_slot_id: timeSlots[1].id, subtotal: 200, delivery_fee: 50, discount: 20, total: 230, payment_method: 'wallet', payment_status: 'paid', status: 'in_process', disclaimer_accepted: true, estimated_delivery_date: tomorrow.toISOString().split('T')[0], created_at: twoDaysAgo, updated_at: now },
      { id: uuidv4(), user_id: users[2].id, order_number: 'ORD-003-GHI', address_id: addresses[3].id, pickup_date: now.toISOString().split('T')[0], time_slot_id: timeSlots[2].id, subtotal: 500, delivery_fee: 0, discount: 50, total: 450, payment_method: 'card', payment_status: 'paid', status: 'ready', disclaimer_accepted: true, estimated_delivery_date: tomorrow.toISOString().split('T')[0], created_at: yesterday, updated_at: now },
      { id: uuidv4(), user_id: users[3].id, order_number: 'ORD-004-JKL', address_id: addresses[4].id, pickup_date: now.toISOString().split('T')[0], time_slot_id: timeSlots[0].id, subtotal: 150, delivery_fee: 50, discount: 0, total: 200, payment_method: 'upi', payment_status: 'paid', status: 'ready', disclaimer_accepted: true, estimated_delivery_date: tomorrow.toISOString().split('T')[0], created_at: yesterday, updated_at: now },
      { id: uuidv4(), user_id: users[4].id, order_number: 'ORD-005-MNO', address_id: addresses[5].id, pickup_date: tomorrow.toISOString().split('T')[0], time_slot_id: timeSlots[1].id, subtotal: 300, delivery_fee: 0, discount: 0, total: 300, payment_method: 'wallet', payment_status: 'paid', status: 'picked_up', disclaimer_accepted: true, estimated_delivery_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[5].id, order_number: 'ORD-006-PQR', address_id: addresses[6].id, pickup_date: tomorrow.toISOString().split('T')[0], time_slot_id: timeSlots[3].id, subtotal: 450, delivery_fee: 0, discount: 45, total: 405, payment_method: 'wallet', payment_status: 'paid', status: 'picked_up', disclaimer_accepted: true, estimated_delivery_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[0].id, order_number: 'ORD-007-STU', address_id: addresses[0].id, pickup_date: tomorrow.toISOString().split('T')[0], time_slot_id: timeSlots[2].id, subtotal: 600, delivery_fee: 0, discount: 0, total: 600, payment_method: 'wallet', payment_status: 'paid', status: 'confirmed', disclaimer_accepted: true, estimated_delivery_date: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[1].id, order_number: 'ORD-008-VWX', address_id: addresses[2].id, pickup_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], time_slot_id: timeSlots[0].id, subtotal: 250, delivery_fee: 0, discount: 25, total: 225, payment_method: 'wallet', payment_status: 'paid', status: 'pending', disclaimer_accepted: true, estimated_delivery_date: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], created_at: now, updated_at: now },
      { id: uuidv4(), user_id: users[2].id, order_number: 'ORD-009-YZA', address_id: addresses[3].id, pickup_date: twoDaysAgo.toISOString().split('T')[0], time_slot_id: timeSlots[1].id, subtotal: 400, delivery_fee: 0, discount: 0, total: 400, payment_method: 'wallet', payment_status: 'paid', status: 'delivered', disclaimer_accepted: true, estimated_delivery_date: yesterday.toISOString().split('T')[0], created_at: twoDaysAgo, updated_at: yesterday },
      { id: uuidv4(), user_id: users[3].id, order_number: 'ORD-010-BCD', address_id: addresses[4].id, pickup_date: twoDaysAgo.toISOString().split('T')[0], time_slot_id: timeSlots[2].id, subtotal: 180, delivery_fee: 50, discount: 0, total: 230, payment_method: 'cod', payment_status: 'paid', status: 'delivered', disclaimer_accepted: true, estimated_delivery_date: yesterday.toISOString().split('T')[0], created_at: twoDaysAgo, updated_at: yesterday },
    ];

    await queryInterface.bulkInsert('bookings', bookings);

    // Add booking items
    const bookingItems = [];
    bookings.forEach((booking, idx) => {
      const numItems = Math.min(3, items.length);
      for (let i = 0; i < numItems; i++) {
        const item = items[(idx + i) % items.length];
        const qty = Math.floor(Math.random() * 3) + 1;
        bookingItems.push({
          id: uuidv4(),
          booking_id: booking.id,
          item_id: item.id,
          name: item.name,
          color: ['Black', 'White', 'Gray', 'Blue'][Math.floor(Math.random() * 4)],
          size: ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)],
          quantity: qty,
          price: parseFloat(item.price),
          line_total: parseFloat(item.price) * qty,
          created_at: booking.created_at,
          updated_at: booking.updated_at,
        });
      }
    });

    await queryInterface.bulkInsert('booking_items', bookingItems);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('booking_items', null, {});
    await queryInterface.bulkDelete('bookings', null, {});
  },
};
