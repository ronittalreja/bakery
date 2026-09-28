// Script to trigger historical data sync via API
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/tomorrow-ai/sync/historical',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.log('Note: Make sure the backend server is running on port 5000');
  process.exit(1);
});

req.end();
