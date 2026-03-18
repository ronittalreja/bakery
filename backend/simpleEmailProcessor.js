const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class SimpleEmailProcessor {
  constructor(testMode = false) {
    this.testMode = testMode;
    this.targetSender = testMode ? 
      process.env.TEST_SENDER_EMAIL : 
      'receipt5@mongini.in';
    
    this.processedEmailsFile = testMode ? 
      path.join(__dirname, 'test_processed_emails.json') : 
      path.join(__dirname, 'processed_emails.json');
    
    this.processedEmails = this.loadProcessedEmails();
    
    this.imapConfig = {
      user: process.env.GMAIL_EMAIL,
      password: process.env.GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };
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

  async processEmailStructure(msg, seqno) {
    return new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0);
      
      msg.on('body', (stream, info) => {
        stream.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
        });
        
        stream.once('end', async () => {
          try {
            const parsed = await simpleParser(buffer);
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      });
      
      msg.once('attributes', (attrs) => {
        // Store attributes if needed
      });
      
      msg.once('end', () => {
        // Message processing complete
      });
    });
  }

  async processEmail(msg, seqno) {
    try {
      const parsed = await this.processEmailStructure(msg, seqno);
      const messageId = parsed.messageId || `msg-${seqno}-${Date.now()}`;
      
      // Skip if already processed
      if (this.processedEmails[messageId]) {
        console.log(`⏭️  Skipping already processed email: ${parsed.subject}`);
        return;
      }

      // Only process emails from target sender
      const fromText = parsed.from?.text || '';
      if (!fromText.includes(this.targetSender)) {
        return;
      }

      const emailType = this.detectEmailType(parsed.subject || '');
      
      if (emailType === 'unknown') {
        console.log(`❓ Unknown email type, skipping: ${parsed.subject}`);
        this.markEmailAsProcessed(messageId, 'unknown', 'skipped');
        return;
      }

      console.log(`📧 Processing ${emailType} email: ${parsed.subject}`);
      console.log(`📧 From: ${fromText}`);
      console.log(`📧 Date: ${parsed.date}`);
      console.log(`📧 Attachments: ${parsed.attachments?.length || 0}`);

      // In test mode, just log the details
      if (this.testMode) {
        console.log(`🧪 TEST MODE: Would upload ${emailType} email`);
        console.log(`🧪 TEST MODE: Subject: ${parsed.subject}`);
        console.log(`🧪 TEST MODE: From: ${fromText}`);
        console.log(`🧪 TEST MODE: Attachments: ${parsed.attachments?.length || 0}`);
        
        if (parsed.attachments && parsed.attachments.length > 0) {
          parsed.attachments.forEach((att, index) => {
            console.log(`🧪 Attachment ${index + 1}: ${att.filename} (${att.contentType})`);
          });
        }
        
        this.markEmailAsProcessed(messageId, emailType, 'test-success');
        return;
      }

      // Production mode would upload to backend here
      console.log(`✅ Would upload ${emailType} to backend`);
      this.markEmailAsProcessed(messageId, emailType, 'success');

    } catch (error) {
      console.error(`❌ Error processing email:`, error);
      const messageId = `error-${seqno}-${Date.now()}`;
      this.markEmailAsProcessed(messageId, 'error', error.message);
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
  
  const processor = new SimpleEmailProcessor(testMode);
  
  if (clearHistory) {
    processor.clearProcessedEmails();
  }
  
  processor.start().catch(console.error);
}

module.exports = SimpleEmailProcessor;
