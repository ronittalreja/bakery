const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuration
const config = {
  email: process.env.GMAIL_EMAIL || 'monginisshahad@gmail.com',
  password: process.env.GMAIL_APP_PASSWORD || 'jgyl mhui ewjj mjcj',
  imap: {
    user: process.env.GMAIL_EMAIL || 'monginisshahad@gmail.com',
    password: process.env.GMAIL_APP_PASSWORD || 'jgyl mhui ewjj mjcj',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    connTimeout: 10000, // 10 seconds connection timeout
    authTimeout: 5000,   // 5 seconds auth timeout
    tlsOptions: {
      rejectUnauthorized: false // Accept self-signed certificates
    }
  },
  recipientEmail: process.env.RECIPIENT_EMAIL || 'receipt5@mongini.in',
  apiBaseUrl: process.env.API_URL || 'https://bakery-backend-e92k.onrender.com',
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
  processedFolder: 'PROCESSED_EMAILS',
  tempDir: path.join(__dirname, '../temp-emails')
};

// Ensure temp directory exists
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

// Email classification based on subject
function classifyEmail(subject) {
  const upperSubject = subject.toUpperCase();
  
  if (upperSubject.includes('INVOICE')) {
    return 'invoice';
  } else if (upperSubject.includes('CRDR')) {
    return 'credit-note';
  } else if (upperSubject.includes('ROSRECEIPT')) {
    return 'ros-receipt';
  }
  
  return null;
}

// Generate JWT token for authentication
function generateAuthToken() {
  const payload = {
    id: 1,
    username: 'admin',
    role: 'admin'
  };
  
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
  return token;
}

// Upload PDF to API
async function uploadToApi(pdfPath, emailType) {
  const formData = new FormData();
  
  let endpoint;
  switch (emailType) {
    case 'invoice':
      endpoint = '/api/invoices/upload';
      formData.append('file', fs.createReadStream(pdfPath));
      break;
    case 'credit-note':
      endpoint = '/api/credit-notes/upload';
      formData.append('file', fs.createReadStream(pdfPath));
      break;
    case 'ros-receipt':
      endpoint = '/api/ros-receipts/upload';
      formData.append('rosReceipt', fs.createReadStream(pdfPath)); // ROS uses different field name
      break;
    default:
      throw new Error(`Unknown email type: ${emailType}`);
  }
  
  try {
    const token = generateAuthToken();
    const headers = formData.getHeaders();
    headers['Authorization'] = `Bearer ${token}`;
    
    const response = await axios.post(`${config.apiBaseUrl}${endpoint}`, formData, {
      headers: headers,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    
    console.log(`✅ Successfully uploaded ${emailType} to API:`, response.data);
    return true;
  } catch (error) {
    console.error(`❌ Failed to upload ${emailType} to API:`, error.response?.data || error.message);
    return false;
  }
}

// Process email
async function processEmail(imap, email) {
  try {
    console.log(`\n📧 Processing email: ${email.subject}`);
    
    // Parse email using the full source
    const parsed = await simpleParser(email.source || email);
    
    // Check if email is from the correct sender
    if (!parsed.from?.value?.[0]?.address?.toLowerCase().includes(config.recipientEmail.toLowerCase())) {
      console.log(`⏭️  Skipping email from: ${parsed.from?.value?.[0]?.address}`);
      return false;
    }
    
    // Classify email based on subject
    const emailType = classifyEmail(parsed.subject || email.subject);
    if (!emailType) {
      console.log(`⏭️  Skipping email - no matching type in subject: ${parsed.subject || email.subject}`);
      return false;
    }
    
    console.log(`📋 Email classified as: ${emailType}`);
    
    // Find PDF attachment
    const pdfAttachment = parsed.attachments?.find(att => 
      att.contentType === 'application/pdf' || att.filename?.toLowerCase().endsWith('.pdf')
    );
    
    if (!pdfAttachment) {
      console.log(`⏭️  No PDF attachment found in email`);
      return false;
    }
    
    console.log(`📎 Found PDF attachment: ${pdfAttachment.filename}`);
    
    // Save PDF to temp file
    const tempFilePath = path.join(config.tempDir, `${Date.now()}_${pdfAttachment.filename}`);
    fs.writeFileSync(tempFilePath, pdfAttachment.content);
    
    console.log(`💾 Saved PDF to: ${tempFilePath}`);
    
    // Upload to API
    const uploadSuccess = await uploadToApi(tempFilePath, emailType);
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    console.log(`🗑️  Cleaned up temp file`);
    
    if (uploadSuccess) {
      // Mark email as seen to prevent reprocessing
      imap.addFlags(email.uid, ['\\Seen'], (err) => {
        if (err) {
          console.error(`⚠️  Could not mark email as seen:`, err.message);
        } else {
          console.log(`✅ Marked email as seen`);
        }
      });
      
      // Move email to processed folder (async, don't wait for it)
      imap.move(email.uid, config.processedFolder, (err) => {
        if (err) {
          console.error(`⚠️  Could not move email to processed folder:`, err.message);
        } else {
          console.log(`📁 Moved email to ${config.processedFolder} folder`);
        }
      });
      
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error(`❌ Error processing email:`, error.message);
    return false;
  }
}

// Fetch and process emails
async function fetchAndProcessEmails() {
  console.log(`\n🚀 Starting email fetch at ${new Date().toISOString()}`);
  
  return new Promise((resolve, reject) => {
    const imap = new Imap(config.imap);
    
    imap.once('ready', () => {
      console.log('✅ Connected to Gmail IMAP');
      
      // Open INBOX
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('❌ Error opening INBOX:', err);
          imap.end();
          reject(err);
          return;
        }
        
        console.log(`📬 INBOX opened. Total messages: ${box.messages.total}`);
        
        // Create processed folder if it doesn't exist
        imap.getBoxes((err, boxes) => {
          if (err) {
            console.error('❌ Error getting mailbox list:', err);
          } else if (!boxes[config.processedFolder]) {
            imap.addBox(config.processedFolder, (err) => {
              if (err) {
                console.error(`⚠️  Could not create ${config.processedFolder} folder:`, err.message);
              } else {
                console.log(`✅ Created ${config.processedFolder} folder`);
              }
            });
          }
        });
        
        // Search for unread emails from the specific sender
        const searchCriteria = [
          ['UNSEEN'],
          ['FROM', config.recipientEmail]
        ];
        
        imap.search(searchCriteria, (err, results) => {
          if (err) {
            console.error('❌ Error searching emails:', err);
            imap.end();
            reject(err);
            return;
          }
          
          if (results.length === 0) {
            console.log('✅ No new emails to process');
            imap.end();
            resolve(0);
            return;
          }
          
          console.log(`📨 Found ${results.length} new emails to process`);
          
          // Fetch emails with full body
          const fetch = imap.fetch(results, {
            bodies: '',
            markSeen: false
          });
          
          let processedCount = 0;
          let processedPromises = [];
          
          fetch.on('message', (msg, seqno) => {
            let buffer = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });
            
            msg.once('end', async () => {
              const email = Imap.parseHeader(buffer);
              email.uid = results[seqno - 1];
              email.source = buffer; // Store full email source for parsing
              
              const promise = processEmail(imap, email).then(success => {
                if (success) processedCount++;
              });
              processedPromises.push(promise);
            });
          });
          
          fetch.once('error', (err) => {
            console.error('❌ Fetch error:', err);
            imap.end();
            reject(err);
          });
          
          fetch.once('end', async () => {
            await Promise.all(processedPromises);
            console.log(`\n📊 Processing complete. Successfully processed: ${processedCount}/${results.length} emails`);
            imap.end();
            resolve(processedCount);
          });
        });
      });
    });
    
    imap.once('error', (err) => {
      console.error('❌ IMAP error:', err);
      reject(err);
    });
    
    imap.once('end', () => {
      console.log('👋 IMAP connection ended');
    });
    
    imap.connect();
  });
}

// Run the email processor
async function main() {
  console.log('🚀 Email-to-API processor started!');
  console.log(`📧 Monitoring emails from: ${config.recipientEmail}`);
  console.log(`🔗 API Base URL: ${config.apiBaseUrl}`);

  try {
    const processedCount = await fetchAndProcessEmails();
    console.log(`✅ Successfully processed ${processedCount} emails`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Email processing failed:', error);
    process.exit(1);
  }
}

main();
