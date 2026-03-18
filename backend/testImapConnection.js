const Imap = require('imap');
require('dotenv').config();

function testImapConnection() {
  console.log('🔧 Testing Gmail IMAP Connection...');
  console.log(`📧 Email: ${process.env.GMAIL_EMAIL}`);
  
  const imapConfig = {
    user: process.env.GMAIL_EMAIL,
    password: process.env.GMAIL_APP_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  };

  const imap = new Imap(imapConfig);

  imap.once('ready', () => {
    console.log('✅ Successfully connected to Gmail!');
    
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('❌ Error opening INBOX:', err);
        imap.end();
        return;
      }

      console.log(`📬 INBOX opened successfully`);
      console.log(`📊 Total messages: ${box.messages.total}`);
      console.log(`📊 Unread messages: ${box.messages.unseen}`);
      
      // Test search for receipt5@mongini.in
      imap.search([['FROM', 'receipt5@mongini.in']], (err, results) => {
        if (err) {
          console.error('❌ Search error:', err);
        } else {
          console.log(`📨 Found ${results ? results.length : 0} emails from receipt5@mongini.in`);
        }
        
        imap.end();
      });
    });
  });

  imap.once('error', (err) => {
    console.error('❌ IMAP Connection Error:', err);
    if (err.code === 'ENOTFOUND') {
      console.log('💡 Check your internet connection');
    } else if (err.code === 'EAUTH') {
      console.log('💡 Check your email and app password');
      console.log('💡 Make sure 2FA is enabled and app password is generated');
    } else if (err.code === 'ECONNREFUSED') {
      console.log('💡 Check if IMAP is enabled in Gmail settings');
    }
  });

  imap.once('end', () => {
    console.log('🔌 Connection ended');
  });

  imap.connect();
}

if (require.main === module) {
  testImapConnection();
}

module.exports = testImapConnection;
