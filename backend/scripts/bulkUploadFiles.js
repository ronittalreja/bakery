const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = 'https://bakery-backend-kpeo.onrender.com';
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');

// API endpoints
const ENDPOINTS = {
  invoices: '/api/invoices/upload',
  creditNotes: '/api/credit-notes/upload',
  rosReceipts: '/api/ros-receipts/upload'
};

// Auth token
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsInVzZXJuYW1lIjoiUjMzMDkiLCJyb2xlIjoic3RhZmYiLCJpc0RlbW8iOmZhbHNlLCJpYXQiOjE3ODUwNzU2MTgsImV4cCI6MTgxNjYxMTYxOH0.KnhlHYCbdce9-hRI25m2KMc_0R9tkoByrcvMH2DARzs';

// Helper function to make HTTP request with file upload
function uploadFile(filePath, endpoint, token) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    form.append('file', fileStream, path.basename(filePath));
    
    const url = new URL(BASE_URL + endpoint);
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
          console.log(`  Response: ${JSON.stringify(response).substring(0, 200)}...`);
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

// Process files in a directory
async function processDirectory(dirName, endpoint) {
  const dirPath = path.join(DOWNLOADS_DIR, dirName);
  const files = await fsPromises.readdir(dirPath);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`\n=== Processing ${dirName} (${pdfFiles.length} files) ===`);
  
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
    
    console.log(`[${i + 1}/${pdfFiles.length}] Uploading ${fileName}...`);
    
    try {
      const response = await uploadFile(filePath, endpoint, AUTH_TOKEN);
      console.log(`✓ Success: ${fileName}`);
      results.success++;
    } catch (error) {
      // Check if it's a duplicate error
      if (error.message.includes('already uploaded') || error.message.includes('Duplicate entry')) {
        console.log(`⊘ Skipped (duplicate): ${fileName}`);
        results.duplicates = (results.duplicates || 0) + 1;
      } else {
        console.error(`✗ Failed: ${fileName} - ${error.message}`);
        results.failed++;
        results.errors.push({ fileName, error: error.message });
      }
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

// Main function
async function main() {
  console.log('=== Bulk File Upload Script ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Downloads Directory: ${DOWNLOADS_DIR}`);

  const allResults = {};

  try {
    // Process Invoices
    allResults.invoices = await processDirectory('Invoices', ENDPOINTS.invoices);
    
    // Process Credit Notes (CRDR)
    allResults.creditNotes = await processDirectory('CRDR', ENDPOINTS.creditNotes);
    
    // Process ROS Receipts
    allResults.rosReceipts = await processDirectory('ROSReceipts', ENDPOINTS.rosReceipts);

    // Print summary
    console.log('\n=== FINAL SUMMARY ===');
    console.log('\nInvoices:');
    console.log(`  Total: ${allResults.invoices.total}`);
    console.log(`  Success: ${allResults.invoices.success}`);
    console.log(`  Duplicates (skipped): ${allResults.invoices.duplicates || 0}`);
    console.log(`  Failed: ${allResults.invoices.failed}`);
    
    console.log('\nCredit Notes:');
    console.log(`  Total: ${allResults.creditNotes.total}`);
    console.log(`  Success: ${allResults.creditNotes.success}`);
    console.log(`  Duplicates (skipped): ${allResults.creditNotes.duplicates || 0}`);
    console.log(`  Failed: ${allResults.creditNotes.failed}`);
    
    console.log('\nROS Receipts:');
    console.log(`  Total: ${allResults.rosReceipts.total}`);
    console.log(`  Success: ${allResults.rosReceipts.success}`);
    console.log(`  Duplicates (skipped): ${allResults.rosReceipts.duplicates || 0}`);
    console.log(`  Failed: ${allResults.rosReceipts.failed}`);

    const totalSuccess = allResults.invoices.success + allResults.creditNotes.success + allResults.rosReceipts.success;
    const totalDuplicates = (allResults.invoices.duplicates || 0) + (allResults.creditNotes.duplicates || 0) + (allResults.rosReceipts.duplicates || 0);
    const totalFailed = allResults.invoices.failed + allResults.creditNotes.failed + allResults.rosReceipts.failed;
    
    console.log('\n=== TOTAL ===');
    console.log(`Successfully uploaded: ${totalSuccess}`);
    console.log(`Duplicates (already in DB): ${totalDuplicates}`);
    console.log(`Failed: ${totalFailed}`);

    // Save errors to file if any
    const allErrors = [
      ...allResults.invoices.errors.map(e => ({ ...e, type: 'Invoice' })),
      ...allResults.creditNotes.errors.map(e => ({ ...e, type: 'Credit Note' })),
      ...allResults.rosReceipts.errors.map(e => ({ ...e, type: 'ROS Receipt' }))
    ];

    if (allErrors.length > 0) {
      const errorLogPath = path.join(__dirname, 'upload_errors.json');
      await fsPromises.writeFile(errorLogPath, JSON.stringify(allErrors, null, 2));
      console.log(`\nErrors saved to: ${errorLogPath}`);
    }

  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

main();
