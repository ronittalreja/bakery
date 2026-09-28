// Script to trigger historical sync on deployed API
const https = require('https');

const API_URL = 'https://r3309.vercel.app/api/tomorrow-ai/sync/historical';

const options = {
  hostname: 'r3309.vercel.app',
  port: 443,
  path: '/api/tomorrow-ai/sync/historical',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Triggering historical sync on deployed API...');
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
        console.log('✓ Historical sync completed successfully');
        console.log(`Dates processed: ${parsed.data.datesProcessed}`);
        console.log(`Total records: ${parsed.data.totalRecords}`);
      } else {
        console.error('✗ Sync failed:', parsed.error);
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
