'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('serviceable_pincodes', [
      // Mumbai
      { id: uuidv4(), pincode: '400001', city: 'Mumbai', state: 'Maharashtra', area: 'Fort', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), pincode: '400050', city: 'Mumbai', state: 'Maharashtra', area: 'Bandra West', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), pincode: '400051', city: 'Mumbai', state: 'Maharashtra', area: 'Bandra East', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), pincode: '400069', city: 'Mumbai', state: 'Maharashtra', area: 'Andheri East', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), pincode: '400076', city: 'Mumbai', state: 'Maharashtra', area: 'Powai', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      // Delhi
      { id: uuidv4(), pincode: '110001', city: 'New Delhi', state: 'Delhi', area: 'Connaught Place', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), pincode: '110017', city: 'New Delhi', state: 'Delhi', area: 'Hauz Khas', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), pincode: '110019', city: 'New Delhi', state: 'Delhi', area: 'South Extension', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      // Bangalore
      { id: uuidv4(), pincode: '560001', city: 'Bangalore', state: 'Karnataka', area: 'MG Road', is_active: true, delivery_days: 3, minimum_order: 149.00, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), pincode: '560034', city: 'Bangalore', state: 'Karnataka', area: 'Koramangala', is_active: true, delivery_days: 3, minimum_order: 149.00, created_at: new Date(), updated_at: new Date() },
      // Pune
      { id: uuidv4(), pincode: '411001', city: 'Pune', state: 'Maharashtra', area: 'Shivaji Nagar', is_active: true, delivery_days: 2, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), pincode: '411014', city: 'Pune', state: 'Maharashtra', area: 'Hinjewadi', is_active: true, delivery_days: 3, minimum_order: 99.00, created_at: new Date(), updated_at: new Date() },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('serviceable_pincodes', null, {});
  },
};
