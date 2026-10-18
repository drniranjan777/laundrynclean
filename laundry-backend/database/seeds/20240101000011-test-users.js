'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const pwd = await bcrypt.hash('Test1234', 12);
    const now = new Date();

    const users = [
      { id: uuidv4(), name: 'Rahul Sharma', email: 'rahul@test.com', phone: '9876543210', country_code: '+91', password: pwd, role: 'customer', is_verified: true, is_active: true, is_profile_complete: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Priya Patel', email: 'priya@test.com', phone: '9876543211', country_code: '+91', password: pwd, role: 'customer', is_verified: true, is_active: true, is_profile_complete: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Amit Kumar', email: 'amit@test.com', phone: '9876543212', country_code: '+91', password: pwd, role: 'customer', is_verified: true, is_active: true, is_profile_complete: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Sneha Reddy', email: 'sneha@test.com', phone: '9876543213', country_code: '+91', password: pwd, role: 'customer', is_verified: true, is_active: true, is_profile_complete: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Vikram Singh', email: 'vikram@test.com', phone: '9876543214', country_code: '+91', password: pwd, role: 'customer', is_verified: true, is_active: true, is_profile_complete: false, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Anita Desai', email: 'anita@test.com', phone: '9876543215', country_code: '+91', password: pwd, role: 'customer', is_verified: true, is_active: true, is_profile_complete: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Ravi Driver', email: 'ravi.driver@test.com', phone: '9876543220', country_code: '+91', password: pwd, role: 'driver', is_verified: true, is_active: true, is_profile_complete: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Suresh Driver', email: 'suresh.driver@test.com', phone: '9876543221', country_code: '+91', password: pwd, role: 'driver', is_verified: true, is_active: true, is_profile_complete: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Mohan Driver', email: 'mohan.driver@test.com', phone: '9876543222', country_code: '+91', password: pwd, role: 'driver', is_verified: true, is_active: true, is_profile_complete: true, created_at: now, updated_at: now },
    ];

    await queryInterface.bulkInsert('users', users);

    // Store user IDs for later seeds
    global.__TEST_USERS__ = users;
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: { [require('sequelize').Op.like]: '%@test.com' } });
  },
};
