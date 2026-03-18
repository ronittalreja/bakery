const Imap = require('imap');
require('dotenv').config();

function findAllTestEmails() {
  console.log('🔍 Checking ALL emails from talrejaronit16@gmail.com...');
  
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

      // Search ALL emails from test sender
      imap.search(['ALL', ['FROM', 'talrejaronit16@gmail.com']], (err, results) => {
        if (err) {
          console.error('❌ Search error:', err);
          imap.end();
          return;
        }

        console.log(`📨 Found ${results ? results.length : 0} total emails from talrejaronit16@gmail.com`);

        if (!results || results.length === 0) {
          imap.end();
          return;
        }

        // Get the last 5 most recent emails
        const recentEmails = results.slice(-5);
        console.log(`📊 Showing last ${recentEmails.length} emails:`);

        const fetch = imap.fetch(recentEmails, { bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', struct: true });
        
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
              
              console.log(`\n📧 Email:`);
              console.log(`   ${fromLine.trim()}`);
              console.log(`   ${subjectLine.trim()}`);
              console.log(`   ${dateLine.trim()}`);
              
              // Check for rosreceipt
              if (subjectLine.toLowerCase().includes('rosreceipt')) {
                console.log(`   🎯 ROS RECEIPT FOUND!`);
              }
            });
          });
          
          msg.once('attributes', (attrs) => {
            console.log(`   Flags: ${attrs.flags?.join(', ') || 'none'}`);
            console.log(`   Unseen: ${attrs.flags?.includes('\\Seen') ? 'No' : 'Yes'}`);
          });
        });

        fetch.once('error', (err) => {
          console.error('❌ Fetch error:', err);
          imap.end();
        });

        fetch.once('end', () => {
          console.log('\n✅ Check complete');
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
  findAllTestEmails();
}

module.exports = findAllTestEmails;
