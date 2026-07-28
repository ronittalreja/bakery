const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = 'https://bakery-backend-kpeo.onrender.com';
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
const ENDPOINT = '/api/credit-notes/upload';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsInVzZXJuYW1lIjoiUjMzMDkiLCJyb2xlIjoic3RhZmYiLCJpc0RlbW8iOmZhbHNlLCJpYXQiOjE3ODUwNzU2MTgsImV4cCI6MTgxNjYxMTYxOH0.KnhlHYCbdce9-hRI25m2KMc_0R9tkoByrcvMH2DARzs';

// Helper function to make HTTP request with file upload
function uploadFile(filePath, token) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    form.append('file', fileStream, path.basename(filePath));
    
    const url = new URL(BASE_URL + ENDPOINT);
    const options = {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response.error || response.message || 'Upload failed'}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}. Raw response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`  Request error: ${err.message}`);
      reject(err);
    });
    
    form.pipe(req);
  });
}

// Main function
async function main() {
  console.log('=== Credit Notes (CRDR) Upload Script ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Directory: ${DOWNLOADS_DIR}/CRDR`);
  
  const dirPath = path.join(DOWNLOADS_DIR, 'CRDR');
  const files = await fsPromises.readdir(dirPath);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`\nFound ${pdfFiles.length} credit note files to process\n`);
  
  const results = {
    total: pdfFiles.length,
    success: 0,
    failed: 0,
    duplicates: 0,
    errors: []
  };

  for (let i = 0; i < pdfFiles.length; i++) {
    const fileName = pdfFiles[i];
    const filePath = path.join(dirPath, fileName);
    
    console.log(`[${i + 1}/${pdfFiles.length}] ${fileName}...`);
    
    try {
      const response = await uploadFile(filePath, AUTH_TOKEN);
      console.log(`  ✓ Success`);
      results.success++;
    } catch (error) {
      if (error.message.includes('already uploaded') || error.message.includes('Duplicate entry') || error.message.includes('already exists')) {
        console.log(`  ⊘ Skipped (duplicate)`);
        results.duplicates++;
      } else {
        console.error(`  ✗ Failed: ${error.message}`);
        results.failed++;
        results.errors.push({ fileName, error: error.message });
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${results.total}`);
  console.log(`Successfully uploaded: ${results.success}`);
  console.log(`Duplicates (already in DB): ${results.duplicates}`);
  console.log(`Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    const errorLogPath = path.join(__dirname, 'creditnotes_errors.json');
    await fsPromises.writeFile(errorLogPath, JSON.stringify(results.errors, null, 2));
    console.log(`\nErrors saved to: ${errorLogPath}`);
  }
}

main().catch(console.error);
