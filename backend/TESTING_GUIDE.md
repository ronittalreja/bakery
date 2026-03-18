# 🧪 Email Processor Testing Guide

## 🚀 Quick Testing Setup

### Step 1: Configure Environment
Create `.env` file with your details:

```env
# Your Gmail Setup
GMAIL_EMAIL=monginisshahad@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # Your 16-char app password

# Testing Setup  
TEST_SENDER_EMAIL=your-other-email@gmail.com  # Email you'll send test emails from
BACKEND_URL=http://localhost:5000
API_TOKEN=your-jwt-secret-token
NODE_ENV=development
```

### Step 2: Test Gmail Connection
```bash
cd backend
node testImapConnection.js
```

**Expected Output:**
```
✅ Successfully connected to Gmail!
📬 INBOX opened successfully
📊 Total messages: 1234
📊 Unread messages: 5
📨 Found 0 emails from receipt5@mongini.in
```

### Step 3: Test Email Processing

#### Test Mode (with your other email):
```bash
# Run in test mode (monitors your TEST_SENDER_EMAIL)
node testEmailProcessor.js --test
```

#### Clear History & Retest:
```bash
# Clear processed emails and test again
node testEmailProcessor.js --test --clear
```

## 📧 Sending Test Emails

From your `TEST_SENDER_EMAIL`, send emails to `monginisshahad@gmail.com` with these subjects:

### 1. Test Invoice Email
```
Subject: Invoice #12345 - Monginis Bakery
Body: This is a test invoice email
```

### 2. Test CRDR Email  
```
Subject: CRDR Note #67890 - Monginis Bakery
Body: This is a test credit/debit note email
```

### 3. Test ROS Receipt Email
```
Subject: ROS Receipt #54321 - Monginis Bakery  
Body: This is a test ROS receipt email
```

### 4. Test with Attachments
Attach PDF or image files to test attachment processing.

## 🔍 What to Look For

**Successful Test Output:**
```
🔗 Connected to Gmail (TEST MODE)
🎯 Monitoring sender: your-other-email@gmail.com
📨 Found 1 new emails from your-other-email@gmail.com
📧 Processing invoice email: Invoice #12345 - Monginis Bakery
📧 From: Your Name <your-other-email@gmail.com>
🧪 TEST MODE: Would upload invoice email: Invoice #12345 - Monginis Bakery
🧪 TEST MODE: Attachments: 1
✅ Email processing completed
```

## 🔄 Switching to Production

Once testing is successful:

### 1. Update Target Sender
Edit `testEmailProcessor.js` line ~50:
```javascript
// Change this back to production
this.targetSender = 'receipt5@mongini.in';  // Instead of test email
```

### 2. Run Production Mode
```bash
# Production mode (monitors receipt5@mongini.in)
node testEmailProcessor.js
```

### 3. Deploy to Render
Use the original `emailProcessor.js` for production deployment.

## 🚨 Troubleshooting

### "No new emails found"
- Check if emails are marked as "unread" in Gmail
- Verify the sender email matches exactly
- Check spam folder

### "IMAP Connection Error"
- Verify app password is correct (16 characters with spaces)
- Ensure 2FA is enabled on Gmail
- Check IMAP is enabled in Gmail settings

### "Unknown email type"
- Make sure subject contains: "invoice", "crdr", or "rosreceipt"
- Check for typos in subject line

## 📊 Test Results Template

Copy this for your test results:

```
=== Email Processor Test Results ===
Gmail Connection: ✅/❌
Test Email Found: ✅/❌  
Subject Detection: ✅/❌
Attachment Processing: ✅/❌
API Upload (Test Mode): ✅/❌

Test Emails Sent:
- Invoice: ✅/❌
- CRDR: ✅/❌  
- ROS Receipt: ✅/❌

Notes:
[Add any issues or observations]
```

## 🎯 Next Steps After Testing

1. ✅ Gmail connection works
2. ✅ Email detection works  
3. ✅ Test emails process correctly
4. ✅ Switch target sender back to `receipt5@mongini.in`
5. ✅ Deploy to Render as cron job

**Ready for production!** 🚀
