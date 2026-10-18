/**
 * Test all admin-used API endpoints
 * Run: node scripts/test-all-endpoints.js
 */
require('dotenv').config();
const http = require('http');

let TOKEN = '';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 5002,
      path: `/api/v1${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test(name, method, path, body, expectStatus = 200) {
  try {
    const res = await request(method, path, body);
    const ok = res.status === expectStatus;
    console.log(`${ok ? '✅' : '❌'} ${name} — ${res.status} ${res.body?.message || ''}`);
    if (!ok) console.log('   Response:', JSON.stringify(res.body).substring(0, 100));
    return res;
  } catch (err) {
    console.log(`❌ ${name} — ERROR: ${err.message}`);
    return null;
  }
}

async function run() {
  console.log('=== Testing All Admin Endpoints ===\n');

  // 1. Admin Login
  const loginRes = await test('Admin Login', 'POST', '/admin/login', {
    email: 'admin@expresslaundry.com',
    password: 'Admin12@@$$%%',
  });
  if (loginRes?.body?.data?.token) {
    TOKEN = loginRes.body.data.token;
    console.log('   Token acquired ✓\n');
  } else {
    console.log('   FATAL: No token. Stopping tests.\n');
    process.exit(1);
  }

  // 2. Dashboard
  await test('Dashboard Stats', 'GET', '/admin/dashboard');

  // 3. Users
  await test('Users List', 'GET', '/admin/users');

  // 4. Bookings
  await test('Bookings List', 'GET', '/bookings');

  // 5. Categories
  await test('Categories', 'GET', '/categories');

  // 6. Wallet Packages
  await test('Wallet Packages', 'GET', '/wallet/packages');

  // 7. Subscriptions
  await test('Subscription Plans', 'GET', '/subscriptions/plans');

  // 8. Promo Codes
  await test('Promo Codes', 'GET', '/promocodes');

  // 9. Serviceable Areas (public)
  await test('Serviceable Areas', 'GET', '/location/serviceable-areas');

  // 10. FAQ (public)
  await test('FAQ', 'GET', '/content/faq');

  // 11. Terms (public)
  await test('Terms Content', 'GET', '/content/terms');

  // 12. Disclaimer (public)
  await test('Disclaimer', 'GET', '/content/disclaimer');

  // 13. Health
  const healthRes = await request('GET', '/../health');
  console.log(`✅ Health Check — ${healthRes.status}`);

  console.log('\n=== Tests Complete ===');
  process.exit(0);
}

run();
