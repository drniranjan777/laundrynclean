/**
 * Script to create/reset admin user
 * Run: node scripts/create-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/config/db');
require('../src/models/index');
const User = require('../src/models/user.model');

const ADMIN_EMAIL = 'admin@expresslaundry.com';
const ADMIN_PASSWORD = 'Admin12@@$$%%';

async function createAdmin() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Check if admin exists
    let admin = await User.findOne({ where: { email: ADMIN_EMAIL } });

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    if (admin) {
      // Update password
      admin.password = hashedPassword;
      admin.role = 'admin';
      admin.isVerified = true;
      admin.isActive = true;
      await admin.save();
      console.log('Admin password updated successfully');
    } else {
      // Create admin
      admin = await User.create({
        name: 'Admin',
        email: ADMIN_EMAIL,
        phone: '9999999999',
        countryCode: '+91',
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
        isActive: true,
        isProfileComplete: true,
      });
      console.log('Admin user created successfully');
    }

    console.log('Email:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
