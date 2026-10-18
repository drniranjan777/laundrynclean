/**
 * Test admin login directly
 * Run: node scripts/test-login.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/config/db');
require('../src/models/index');
const User = require('../src/models/user.model');

async function testLogin() {
  try {
    await sequelize.authenticate();

    const user = await User.findOne({ where: { email: 'admin@expresslaundry.com', role: 'admin' } });
    
    if (!user) {
      console.log('FAIL: Admin user not found');
      process.exit(1);
    }

    console.log('Found admin user:', user.id);
    console.log('Has password:', !!user.password);
    console.log('Password hash:', user.password?.substring(0, 20) + '...');

    const testPassword = 'Admin12@@$$%%';
    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log('Password match:', isValid);

    if (isValid) {
      console.log('\nSUCCESS: Login should work!');
    } else {
      console.log('\nFAIL: Password does not match. Re-hashing...');
      const newHash = await bcrypt.hash(testPassword, 12);
      user.password = newHash;
      await user.save();
      
      // Verify again
      const recheck = await bcrypt.compare(testPassword, newHash);
      console.log('After re-hash, match:', recheck);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testLogin();
