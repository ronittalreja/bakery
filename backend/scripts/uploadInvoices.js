const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Configuration
const BASE_URL = 'https://bakery-backend-e92k.onrender.com';
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
const ENDPOINT = '/api/invoices/upload';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsInVzZXJuYW1lIjoiUjMzMDkiLCJyb2xlIjoic3RhZmYiLCJpc0RlbW8iOmZhbHNlLCJpYXQiOjE3ODUwNzU2MTgsImV4cCI6MTgxNjYxMTYxOH0.KnhlHYCbdce9-hRI25m2KMc_0R9tkoByrcvMH2DARzs';
const YEARS = ['2023', '2024', '2025', '2026'];

// Helper function to make HTTP request with file upload
async function uploadFile(filePath, token) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
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

// Helper function to get all PDF files from a directory recursively
async function getPdfFiles(dirPath) {
  const files = [];
  
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively get files from subdirectories
        const subFiles = await getPdfFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dirPath}: ${error.message}`);
  }
  
  return files;
}

// Main function
async function main() {
  console.log('=== Invoices Upload Script ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Directory: ${DOWNLOADS_DIR}/Invoices`);
  
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    duplicates: 0,
    errors: []
  };

  for (const year of YEARS) {
    const yearDir = path.join(DOWNLOADS_DIR, 'Invoices', year);
    
    try {
      await fsPromises.access(yearDir);
    } catch {
      console.log(`Year ${year}: Directory not found, skipping`);
      continue;
    }
    
    console.log(`\nProcessing year ${year}...`);
    
    const pdfFiles = await getPdfFiles(yearDir);
    console.log(`Found ${pdfFiles.length} invoice files to process`);
    
    results.total += pdfFiles.length;
    
    for (let i = 0; i < pdfFiles.length; i++) {
      const filePath = pdfFiles[i];
      const fileName = path.basename(filePath);
      
      console.log(`[${i + 1}/${pdfFiles.length}] ${fileName}...`);
      
      try {
        const response = await uploadFile(filePath, AUTH_TOKEN);
        console.log(`  ✓ Success`);
        results.success++;
      } catch (error) {
        if (error.message.includes('already uploaded') || error.message.includes('Duplicate entry')) {
          console.log(`  ⊘ Skipped (duplicate)`);
          results.duplicates++;
        } else {
          console.error(`  ✗ Failed: ${error.message}`);
          results.failed++;
          results.errors.push({ fileName, year, error: error.message });
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${results.total}`);
  console.log(`Successfully uploaded: ${results.success}`);
  console.log(`Duplicates (already in DB): ${results.duplicates}`);
  console.log(`Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    const errorLogPath = path.join(__dirname, 'invoices_errors.json');
    await fsPromises.writeFile(errorLogPath, JSON.stringify(results.errors, null, 2));
    console.log(`\nErrors saved to: ${errorLogPath}`);
  }
}

main().catch(console.error);
