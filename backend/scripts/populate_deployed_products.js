// Script to populate Tomorrow AI products on deployed database
const https = require('https');

const API_URL = 'https://bakery-backend-e92k.onrender.com/api/populate-tomorrow-ai-products';

const options = {
  hostname: 'bakery-backend-e92k.onrender.com',
  port: 443,
  path: '/api/populate-tomorrow-ai-products',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Populating Tomorrow AI products on deployed database...');
console.log(`URL: ${API_URL}`);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      if (parsed.success) {
        console.log('✓ Products populated successfully');
      } else {
        console.error('✗ Population failed:', parsed.error);
      }
    } catch (e) {
      console.log('Response:', data);
    }
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

req.end();
