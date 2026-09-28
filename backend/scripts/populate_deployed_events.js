// Script to populate Tomorrow AI events on deployed database
const https = require('https');

const API_URL = 'https://bakery-backend-e92k.onrender.com/api/populate-tomorrow-ai-events';

const options = {
  hostname: 'bakery-backend-e92k.onrender.com',
  port: 443,
  path: '/api/populate-tomorrow-ai-events',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Populating Tomorrow AI events on deployed database...');
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
        console.log('✓ Events populated successfully');
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
