# 📧 Gmail Setup for monginisshahad@gmail.com

## Step 1: Enable 2-Factor Authentication (Required)
1. Go to: https://myaccount.google.com/security
2. Click on "2-Step Verification" 
3. Turn it ON (if not already enabled)
4. Follow the setup process

## Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Under "Select app", choose "Mail"
3. Under "Select device", choose "Other (Custom name)"
4. Name it: "Monginis Email Processor"
5. Click "Generate"
6. Copy the 16-character password (format: xxxx xxxx xxxx xxxx)
   - Save this password - you'll need it for the .env file

## Step 3: Enable IMAP in Gmail
1. Go to Gmail Settings (click gear icon)
2. Click "See all settings"
3. Go to "Forwarding and POP/IMAP" tab
4. Under "IMAP access", select "Enable IMAP"
5. Click "Save Changes"

## Step 4: Test IMAP Connection
After setup, test with this command:
node testImapConnection.js
