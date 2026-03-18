const Imap = require('imap');
require('dotenv').config();

function diagnoseEmails() {
  console.log('🔍 Diagnosing emails from talrejaronit16@gmail.com...');
  
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

      // Search ALL emails from test sender (not just unread)
      imap.search([['FROM', 'talrejaronit16@gmail.com']], (err, results) => {
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

        // Fetch just the headers to see subjects
        const fetch = imap.fetch(results, { bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', struct: true });
        
        let emailCount = 0;
        
        fetch.on('message', (msg, seqno) => {
          emailCount++;
          
          msg.on('body', (stream, info) => {
            let buffer = '';
            
            stream.on('data', (chunk) => {
              buffer += chunk.toString('ascii');
            });
            
            stream.once('end', () => {
              console.log(`\n📧 Email ${emailCount}:`);
              console.log(`   Subject: ${buffer}`);
              console.log(`   Seq: ${seqno}`);
            });
          });
          
          msg.once('attributes', (attrs) => {
            console.log(`   Flags: ${attrs.flags.join(', ')}`);
            console.log(`   Unseen: ${attrs.flags.includes('\\Seen') ? 'No' : 'Yes'}`);
          });
        });

        fetch.once('error', (err) => {
          console.error('❌ Fetch error:', err);
          imap.end();
        });

        fetch.once('end', () => {
          console.log('\n✅ Diagnosis complete');
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
  diagnoseEmails();
}

module.exports = diagnoseEmails;
