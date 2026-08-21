const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

class EmailProcessor {
  constructor() {
    this.imapConfig = {
      user: process.env.GMAIL_EMAIL,
      password: process.env.GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };
    
    this.processedEmailsFile = path.join(__dirname, 'processed_emails.json');
    this.processedEmails = this.loadProcessedEmails();
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
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
    try {
      const parsed = await simpleParser(msg);
      const messageId = parsed.messageId;
      
      // Skip if already processed
      if (this.isEmailProcessed(messageId)) {
        console.log(`⏭️  Skipping already processed email: ${parsed.subject}`);
        return;
      }

      // Only process emails from receipt5@mongini.in
      if (!parsed.from.text.includes('receipt5@mongini.in')) {
        return;
      }

      const emailType = this.detectEmailType(parsed.subject);
      
      if (emailType === 'unknown') {
        console.log(`❓ Unknown email type, skipping: ${parsed.subject}`);
        this.markEmailAsProcessed(messageId, 'unknown', 'skipped');
        return;
      }

      console.log(`📧 Processing ${emailType} email: ${parsed.subject}`);

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

      // Upload to backend
      await this.uploadToBackend(emailData, attachments);
      
      // Mark as processed locally
      this.markEmailAsProcessed(messageId, emailType, 'success');
      
      // Add BAKERY-PROCESSED label to email in Gmail
      try {
        msg.addFlags(['BAKERY-PROCESSED'], (err) => {
          if (err) {
            console.error('Failed to add label to email:', err);
          } else {
            console.log(`✅ Added BAKERY-PROCESSED label to email: ${parsed.subject}`);
          }
        });
      } catch (labelError) {
        console.error('Error adding label:', labelError);
      }

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
        console.log('🔗 Connected to Gmail');
        
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          console.log(`📬 Total messages in INBOX: ${box.messages.total}`);

          // Get today's date in the format IMAP expects (DD-MMM-YYYY)
          const today = new Date();
          const todayStr = today.toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          }).replace(',', '');

          console.log(`📅 Searching for emails from: ${todayStr}`);

          // Search for emails from today that are NOT labeled as "BAKERY-PROCESSED"
          // This allows processing even if email was read on phone
          // We use a custom label to track processed emails instead of UNSEEN
          imap.search(
            [['FROM', 'receipt5@mongini.in'], ['SINCE', todayStr], ['UNKEYWORD', 'BAKERY-PROCESSED']],
            (err, results) => {
            if (err) {
              console.error('Search error:', err);
              imap.end();
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              console.log('📭 No new emails from receipt5@mongini.in for today');
              imap.end();
              resolve();
              return;
            }

            console.log(`📨 Found ${results.length} new emails from receipt5@mongini.in for today`);

            // Process emails sequentially to avoid overwhelming the system
            const fetch = imap.fetch(results, { bodies: '', struct: true });
            let processedCount = 0;
            let errorCount = 0;
            
            fetch.on('message', (msg, seqno) => {
              msg.on('body', (stream, info) => {
                this.processEmail(msg, seqno)
                  .then(() => {
                    processedCount++;
                    console.log(`✅ Processed ${processedCount}/${results.length} emails`);
                  })
                  .catch((error) => {
                    errorCount++;
                    console.error(`❌ Error processing email ${processedCount + errorCount}:`, error.message);
                  });
              });
            });

            fetch.once('error', (err) => {
              console.error('Fetch error:', err);
              imap.end();
              reject(err);
            });

            fetch.once('end', () => {
              console.log(`✅ Done fetching all messages. Success: ${processedCount}, Errors: ${errorCount}`);
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

      // Add timeout to prevent infinite loops
      setTimeout(() => {
        console.log('⏱️ Timeout reached, forcing connection close');
        imap.end();
        resolve();
      }, 300000); // 5 minutes max

      imap.connect();
    });
  }

  async start() {
    console.log('🚀 Starting email processor...');
    console.log(`📧 Monitoring: ${this.imapConfig.user}`);
    console.log(`🎯 Target sender: receipt5@mongini.in`);
    console.log(`🔄 Upload URL: ${this.backendUrl}`);
    
    try {
      await this.fetchEmails();
      console.log('✅ Email processing completed');
    } catch (error) {
      console.error('❌ Email processing failed:', error);
      throw error;
    }
  }
}

// Run the processor
if (require.main === module) {
  const processor = new EmailProcessor();
  processor.start().catch(console.error);
}

module.exports = EmailProcessor;
