const Imap = require('imap');
require('dotenv').config();

function checkRecentEmails() {
  console.log('🔍 Checking recent emails from last 10 minutes...');
  
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
    console.log('🔗 Connected to Gmail');
    
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('❌ Error opening INBOX:', err);
        imap.end();
        return;
      }

      // Search for ALL recent emails (last 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      imap.search(['SINCE', tenMinutesAgo], (err, results) => {
        if (err) {
          console.error('❌ Search error:', err);
          imap.end();
          return;
        }

        console.log(`📨 Found ${results ? results.length : 0} emails in last 10 minutes`);

        if (!results || results.length === 0) {
          imap.end();
          return;
        }

        // Fetch just the headers to see all recent emails
        const fetch = imap.fetch(results, { bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', struct: true });
        
        fetch.on('message', (msg, seqno) => {
          msg.on('body', (stream, info) => {
            let buffer = '';
            
            stream.on('data', (chunk) => {
              buffer += chunk.toString('ascii');
            });
            
            stream.once('end', () => {
              const lines = buffer.split('\n');
              const subjectLine = lines.find(line => line.startsWith('Subject:')) || 'Subject: (none)';
              const fromLine = lines.find(line => line.startsWith('From:')) || 'From: (none)';
              const dateLine = lines.find(line => line.startsWith('Date:')) || 'Date: (none)';
              
              console.log(`\n📧 Recent Email:`);
              console.log(`   ${fromLine.trim()}`);
              console.log(`   ${subjectLine.trim()}`);
              console.log(`   ${dateLine.trim()}`);
              
              // Highlight if from test sender
              if (fromLine.includes('talrejaronit16@gmail.com')) {
                console.log(`   ⭐ TEST EMAIL DETECTED!`);
              }
            });
          });
        });

        fetch.once('error', (err) => {
          console.error('❌ Fetch error:', err);
          imap.end();
        });

        fetch.once('end', () => {
          console.log('\n✅ Recent emails check complete');
          imap.end();
        });
      });
    });
  });

  imap.once('error', (err) => {
    console.error('❌ IMAP error:', err);
  });

  imap.once('end', () => {
    console.log('🔌 Connection ended');
  });

  imap.connect();
}

if (require.main === module) {
  checkRecentEmails();
}

module.exports = checkRecentEmails;
