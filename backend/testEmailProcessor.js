const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

class TestEmailProcessor {
  constructor(testMode = false) {
    this.testMode = testMode;
    
    // Use test config if in test mode
    const email = process.env.GMAIL_EMAIL; // Always use main Gmail
    const password = process.env.GMAIL_APP_PASSWORD; // Always use main app password
    const backendUrl = process.env.BACKEND_URL;
    
    this.imapConfig = {
      user: email,
      password: password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };
    
    this.processedEmailsFile = testMode ? 
      path.join(__dirname, 'test_processed_emails.json') : 
      path.join(__dirname, 'processed_emails.json');
    
    this.processedEmails = this.loadProcessedEmails();
    this.backendUrl = backendUrl || 'http://localhost:5000';
    
    // In test mode, monitor test sender instead of receipt5@mongini.in
    this.targetSender = testMode ? 
      (process.env.TEST_SENDER_EMAIL || 'your-test-email@gmail.com') : 
      'receipt5@mongini.in';
  }

  loadProcessedEmails() {
    try {
      if (fs.existsSync(this.processedEmailsFile)) {
        const data = fs.readFileSync(this.processedEmailsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log('No processed emails file found, starting fresh');
    }
    return {};
  }

  saveProcessedEmails() {
    try {
      fs.writeFileSync(this.processedEmailsFile, JSON.stringify(this.processedEmails, null, 2));
    } catch (error) {
      console.error('Error saving processed emails:', error);
    }
  }

  isEmailProcessed(messageId) {
    return this.processedEmails[messageId] !== undefined;
  }

  markEmailAsProcessed(messageId, type, status) {
    this.processedEmails[messageId] = {
      type,
      status,
      processedAt: new Date().toISOString()
    };
    this.saveProcessedEmails();
  }

  detectEmailType(subject) {
    const subjectLower = subject.toLowerCase();
    
    if (subjectLower.includes('invoice')) {
      return 'invoice';
    } else if (subjectLower.includes('crdr') || subjectLower.includes('credit') || subjectLower.includes('debit')) {
      return 'crdr';
    } else if (subjectLower.includes('rosreceipt') || subjectLower.includes('ros receipt')) {
      return 'rosreceipt';
    }
    
    return 'unknown';
  }

  async uploadToBackend(emailData, attachments) {
    try {
      // In test mode, just log instead of actually uploading
      if (this.testMode) {
        console.log(`🧪 TEST MODE: Would upload ${emailData.type} email: ${emailData.subject}`);
        console.log(`🧪 TEST MODE: Attachments: ${attachments?.length || 0}`);
        console.log(`🧪 TEST MODE: Backend URL: ${this.backendUrl}`);
        return { success: true, test: true };
      }

      const FormData = require('form-data');
      const formData = new FormData();
      
      // Add email metadata
      formData.append('subject', emailData.subject);
      formData.append('from', emailData.from);
      formData.append('date', emailData.date);
      formData.append('messageId', emailData.messageId);
      
      // Add attachments if any
      if (attachments && attachments.length > 0) {
        attachments.forEach((attachment, index) => {
          formData.append(`file`, attachment.content, attachment.filename);
        });
      }

      let endpoint;
      switch (emailData.type) {
        case 'invoice':
          endpoint = '/api/invoices/upload';
          break;
        case 'crdr':
          endpoint = '/api/credit-notes/upload';
          break;
        case 'rosreceipt':
          endpoint = '/api/ros-receipts/upload';
          break;
        default:
          throw new Error(`Unknown email type: ${emailData.type}`);
      }

      const response = await axios.post(`${this.backendUrl}${endpoint}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${process.env.API_TOKEN}`
        },
        timeout: 30000
      });

      console.log(`✅ Successfully uploaded ${emailData.type} email: ${emailData.subject}`);
      return response.data;

    } catch (error) {
      console.error(`❌ Failed to upload ${emailData.type} email:`, error.response?.data || error.message);
      throw error;
    }
  }

  async processEmail(msg, seqno) {
    let parsed = null;
    
    try {
      parsed = await simpleParser(msg);
      const messageId = parsed.messageId;
      
      // Skip if already processed
      if (this.isEmailProcessed(messageId)) {
        console.log(`⏭️  Skipping already processed email: ${parsed.subject}`);
        return;
      }

      // Only process emails from target sender
      if (!parsed.from.text.includes(this.targetSender)) {
        return;
      }

      const emailType = this.detectEmailType(parsed.subject);
      
      if (emailType === 'unknown') {
        console.log(`❓ Unknown email type, skipping: ${parsed.subject}`);
        this.markEmailAsProcessed(messageId, 'unknown', 'skipped');
        return;
      }

      console.log(`📧 Processing ${emailType} email: ${parsed.subject}`);
      console.log(`📧 From: ${parsed.from.text}`);
      console.log(`📧 Date: ${parsed.date}`);

      // Prepare email data
      const emailData = {
        messageId,
        subject: parsed.subject,
        from: parsed.from.text,
        date: parsed.date?.toISOString(),
        type: emailType,
        text: parsed.text,
        html: parsed.html
      };

      // Extract attachments
      const attachments = [];
      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const attachment of parsed.attachments) {
          if (attachment.contentType === 'application/pdf' || 
              attachment.contentType.includes('image')) {
            attachments.push({
              filename: attachment.filename,
              content: attachment.content,
              contentType: attachment.contentType
            });
          }
        }
      }

      // Upload to backend (or simulate in test mode)
      await this.uploadToBackend(emailData, attachments);
      
      // Mark as processed
      this.markEmailAsProcessed(messageId, emailType, 'success');

    } catch (error) {
      console.error(`❌ Error processing email:`, error);
      if (parsed.messageId) {
        this.markEmailAsProcessed(parsed.messageId, 'error', error.message);
      }
    }
  }

  async fetchEmails() {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.imapConfig);

      imap.once('ready', () => {
        console.log(`🔗 Connected to Gmail (${this.testMode ? 'TEST MODE' : 'PRODUCTION'})`);
        console.log(`🎯 Monitoring sender: ${this.targetSender}`);
        
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          console.log(`📬 Total messages in INBOX: ${box.messages.total}`);

          // Search for unread emails from target sender
          imap.search([['UNSEEN'], ['FROM', this.targetSender]], (err, results) => {
            if (err) {
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              console.log(`📭 No new emails from ${this.targetSender}`);
              imap.end();
              resolve();
              return;
            }

            console.log(`📨 Found ${results.length} new emails from ${this.targetSender}`);

            const fetch = imap.fetch(results, { bodies: '' });
            
            fetch.on('message', (msg, seqno) => {
              this.processEmail(msg, seqno);
            });

            fetch.once('error', (err) => {
              console.error('Fetch error:', err);
              reject(err);
            });

            fetch.once('end', () => {
              console.log('✅ Done fetching all messages');
              imap.end();
              resolve();
            });
          });
        });
      });

      imap.once('error', (err) => {
        console.error('IMAP error:', err);
        reject(err);
      });

      imap.once('end', () => {
        console.log('🔌 Connection ended');
      });

      imap.connect();
    });
  }

  async start() {
    console.log('🚀 Starting email processor...');
    console.log(`📧 Email account: ${this.imapConfig.user}`);
    console.log(`🎯 Target sender: ${this.targetSender}`);
    console.log(`🔄 Upload URL: ${this.backendUrl}`);
    console.log(`🧪 Test mode: ${this.testMode ? 'YES' : 'NO'}`);
    
    try {
      await this.fetchEmails();
      console.log('✅ Email processing completed');
    } catch (error) {
      console.error('❌ Email processing failed:', error);
      throw error;
    }
  }

  // Clear processed emails for testing
  clearProcessedEmails() {
    this.processedEmails = {};
    this.saveProcessedEmails();
    console.log('🗑️  Cleared processed emails history');
  }
}

// Run the processor
if (require.main === module) {
  const testMode = process.argv.includes('--test');
  const clearHistory = process.argv.includes('--clear');
  
  const processor = new TestEmailProcessor(testMode);
  
  if (clearHistory) {
    processor.clearProcessedEmails();
  }
  
  processor.start().catch(console.error);
}

module.exports = TestEmailProcessor;
