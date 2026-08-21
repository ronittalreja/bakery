const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Configuration
const BASE_URL = 'https://bakery-backend-e92k.onrender.com';
const DOWNLOADS_DIR = path.join(__dirname, '../2025');
const ENDPOINT = '/api/ros-receipts/upload';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsInVzZXJuYW1lIjoiUjMzMDkiLCJyb2xlIjoic3RhZmYiLCJpc0RlbW8iOmZhbHNlLCJpYXQiOjE3ODUwNzU2MTgsImV4cCI6MTgxNjYxMTYxOH0.KnhlHYCbdce9-hRI25m2KMc_0R9tkoByrcvMH2DARzs';

// Helper function to make HTTP request with file upload
async function uploadFile(filePath, token) {
  const form = new FormData();
  form.append('rosReceipt', fs.createReadStream(filePath));
  
  try {
    const response = await axios.post(`${BASE_URL}${ENDPOINT}`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000 // 60 second timeout
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error('No response from server - connection timeout or server down');
    } else {
      throw new Error(`Request setup error: ${error.message}`);
    }
  }
}

// Main function
async function main() {
  console.log('=== ROS Receipts Upload Script ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Directory: ${DOWNLOADS_DIR}/ROSReceipts`);
  
  const dirPath = path.join(DOWNLOADS_DIR, 'ROS');
  const files = await fsPromises.readdir(dirPath);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`\nFound ${pdfFiles.length} ROS receipt files to process\n`);
  
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
    const errorLogPath = path.join(__dirname, 'rosreceipts_errors.json');
    await fsPromises.writeFile(errorLogPath, JSON.stringify(results.errors, null, 2));
    console.log(`\nErrors saved to: ${errorLogPath}`);
  }
}

main().catch(console.error);
