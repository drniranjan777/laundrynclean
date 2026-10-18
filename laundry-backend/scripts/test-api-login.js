/**
 * Test admin login via HTTP request
 * Run: node scripts/test-api-login.js
 */
const http = require('http');

const data = JSON.stringify({
  email: 'admin@expresslaundry.com',
  password: 'Admin12@@$$%%'
});

const options = {
  hostname: 'localhost',
  port: 5002,
  path: '/api/v1/admin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(body);
    console.log('Response:', JSON.stringify(parsed, null, 2));
    if (parsed.success) {
      console.log('\nLOGIN SUCCESS! Token:', parsed.data.token.substring(0, 30) + '...');
    } else {
      console.log('\nLOGIN FAILED:', parsed.message);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
