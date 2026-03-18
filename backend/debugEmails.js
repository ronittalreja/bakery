const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class DebugEmailProcessor {
  constructor() {
    this.targetSender = process.env.TEST_SENDER_EMAIL;
    
    this.imapConfig = {
      user: process.env.GMAIL_EMAIL,
      password: process.env.GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };
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
      const fromText = parsed.from?.text || '';
      
      // Only process emails from target sender
      if (!fromText.includes(this.targetSender)) {
        return;
      }

      const emailType = this.detectEmailType(parsed.subject || '');
      
      console.log(`\n📧 Email ${seqno}:`);
      console.log(`   Subject: "${parsed.subject}"`);
      console.log(`   From: ${fromText}`);
      console.log(`   Date: ${parsed.date}`);
      console.log(`   Detected Type: ${emailType}`);
      console.log(`   Attachments: ${parsed.attachments?.length || 0}`);
      
      if (parsed.attachments && parsed.attachments.length > 0) {
        parsed.attachments.forEach((att, index) => {
          console.log(`   Attachment ${index + 1}: ${att.filename} (${att.contentType})`);
        });
      }

    } catch (error) {
      console.error(`❌ Error processing email ${seqno}:`, error);
    }
  }

  async fetchAllEmails() {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.imapConfig);

      imap.once('ready', () => {
        console.log(`🔗 Connected to Gmail`);
        console.log(`🎯 Showing ALL emails from: ${this.targetSender}`);
        
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          // Search ALL emails from target sender (not just unread)
          imap.search([['FROM', this.targetSender]], (err, results) => {
            if (err) {
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              console.log(`📭 No emails found from ${this.targetSender}`);
              imap.end();
              resolve();
              return;
            }

            console.log(`📨 Found ${results.length} total emails from ${this.targetSender}`);

            const fetch = imap.fetch(results, { bodies: '' });
            
            fetch.on('message', (msg, seqno) => {
              this.processEmail(msg, seqno);
            });

            fetch.once('error', (err) => {
              console.error('Fetch error:', err);
              reject(err);
            });

            fetch.once('end', () => {
              console.log('\n✅ Done fetching all messages');
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
    console.log('🔍 DEBUG: Showing all emails from test sender...');
    
    try {
      await this.fetchAllEmails();
      console.log('✅ Debug complete');
    } catch (error) {
      console.error('❌ Debug failed:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  const processor = new DebugEmailProcessor();
  processor.start().catch(console.error);
}

module.exports = DebugEmailProcessor;
