'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get customer user IDs
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'customer' LIMIT 6`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0) return;

    const addresses = [
      { id: uuidv4(), user_id: users[0].id, full_name: 'Rahul Sharma', phone: '9876543210', address_line: '12, MG Road, Koramangala', city: 'Bangalore', state: 'Karnataka', pincode: '560034', country: 'India', label: 'Home', is_default: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), user_id: users[0].id, full_name: 'Rahul Sharma', phone: '9876543210', address_line: '5th Floor, Tower B, Prestige Tech Park', city: 'Bangalore', state: 'Karnataka', pincode: '560001', country: 'India', label: 'Office', is_default: false, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), user_id: users[1].id, full_name: 'Priya Patel', phone: '9876543211', address_line: '45, Linking Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', country: 'India', label: 'Home', is_default: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), user_id: users[2].id, full_name: 'Amit Kumar', phone: '9876543212', address_line: '78, Connaught Place', city: 'New Delhi', state: 'Delhi', pincode: '110001', country: 'India', label: 'Home', is_default: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), user_id: users[3].id, full_name: 'Sneha Reddy', phone: '9876543213', address_line: '23, Hinjewadi Phase 1', city: 'Pune', state: 'Maharashtra', pincode: '411014', country: 'India', label: 'Home', is_default: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), user_id: users[4].id, full_name: 'Vikram Singh', phone: '9876543214', address_line: '101, Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400069', country: 'India', label: 'Home', is_default: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), user_id: users[5].id, full_name: 'Anita Desai', phone: '9876543215', address_line: '67, Powai Lake Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', country: 'India', label: 'Home', is_default: true, created_at: new Date(), updated_at: new Date() },
    ];

    await queryInterface.bulkInsert('addresses', addresses);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('addresses', null, {});
  },
};
