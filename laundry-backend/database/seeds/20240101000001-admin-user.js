'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const hashedPassword = await bcrypt.hash('Admin12@@$$%%', 12);
    await queryInterface.bulkInsert('users', [
      {
        id: uuidv4(),
        name: 'Admin',
        email: 'admin@expresslaundry.com',
        phone: '9999999999',
        country_code: '+91',
        password: hashedPassword,
        role: 'admin',
        is_verified: true,
        is_active: true,
        is_profile_complete: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: 'admin@expresslaundry.com' });
  },
};
