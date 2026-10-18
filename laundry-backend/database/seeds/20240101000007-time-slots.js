'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('time_slots', [
      { id: uuidv4(), start_time: '08:00', end_time: '10:00', label: '08:00 AM - 10:00 AM', max_bookings: 20, sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), start_time: '10:00', end_time: '12:00', label: '10:00 AM - 12:00 PM', max_bookings: 20, sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), start_time: '12:00', end_time: '14:00', label: '12:00 PM - 02:00 PM', max_bookings: 15, sort_order: 3, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), start_time: '18:00', end_time: '21:00', label: '06:00 PM - 09:00 PM', max_bookings: 20, sort_order: 4, is_active: true, created_at: new Date(), updated_at: new Date() },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('time_slots', null, {});
  },
};
