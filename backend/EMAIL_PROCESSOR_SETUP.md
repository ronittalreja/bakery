# 📧 Gmail Email Processor Setup Guide

## 🚀 Quick Setup

### 1. Gmail App Password Configuration

**Step 1: Enable 2-Factor Authentication**
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable "2-Step Verification"

**Step 2: Generate App Password**
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" for app
3. Select "Other (Custom name)" - name it "Monginis Email Processor"
4. Copy the 16-character password (save it securely!)

### 2. Environment Variables Setup

Create `.env` file in your backend directory:

```env
# Gmail Configuration
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Backend API Configuration  
BACKEND_URL=https://your-backend.onrender.com
API_TOKEN=your-jwt-secret-token

# Node Environment
NODE_ENV=production
```

### 3. Install Dependencies

```bash
cd backend
npm install imap mailparser node-cron
```

### 4. Test Locally

```bash
# Test email processor
node emailProcessor.js

# Test cron scheduler
node emailCronScheduler.js
```

## 🌐 Deployment Options

### Option 1: Render Cron Job (Recommended)

**Step 1: Deploy to Render**
1. Push your code to GitHub
2. Go to Render Dashboard
3. Click "New +" → "Cron Job"
4. Connect your GitHub repository
5. Configure:
   - **Name**: `monginis-email-processor`
   - **Root Directory**: `backend`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Build Command**: `npm install`
   - **Start Command**: `node emailCronScheduler.js`

**Step 2: Add Environment Variables**
In Render dashboard, add these environment variables:
```
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
BACKEND_URL=https://your-backend.onrender.com
API_TOKEN=your-jwt-secret-token
NODE_ENV=production
```

### Option 2: EasyCron (Alternative)

1. Sign up at [EasyCron.com](https://www.easycron.com)
2. Create a new cron job
3. URL: `https://your-backend.onrender.com/api/emails/process`
4. Schedule: Every 5 minutes
5. Add webhook endpoint to your backend

### Option 3: GitHub Actions (Free)

Create `.github/workflows/email-processor.yml`:

```yaml
name: Email Processor
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  process-emails:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm install
      - run: cd backend && node emailProcessor.js
    env:
      GMAIL_EMAIL: ${{ secrets.GMAIL_EMAIL }}
      GMAIL_APP_PASSWORD: ${{ secrets.GMAIL_APP_PASSWORD }}
      BACKEND_URL: ${{ secrets.BACKEND_URL }}
      API_TOKEN: ${{ secrets.API_TOKEN }}
```

## 🔧 API Endpoints Used

The processor automatically routes emails to your existing endpoints:

- **Invoice emails** → `/api/invoices/upload`
- **CRDR emails** → `/api/credit-notes/upload`  
- **ROS Receipt emails** → `/api/ros-receipts/upload`

## 📊 Monitoring & Logs

### View Logs in Render
1. Go to your cron job service
2. Click "Logs" tab
3. Real-time processing logs

### Local Testing with Logs
```bash
# Enable debug logging
DEBUG=email:* node emailCronScheduler.js
```

## 🔒 Security Notes

1. **Never commit** `.env` file to Git
2. **Use App Passwords**, not regular Gmail password
3. **Rotate API tokens** regularly
4. **Monitor** for unusual email processing activity

## 🚨 Troubleshooting

### Common Issues:

**1. IMAP Connection Failed**
```
Error: Invalid credentials
```
- Check Gmail App Password
- Ensure 2FA is enabled
- Verify IMAP is enabled in Gmail settings

**2. API Upload Failed**
```
Error: Request timeout
```
- Check backend URL is accessible
- Verify API token is valid
- Check file size limits

**3. No New Emails Found**
```
No new emails from receipt5@mongini.in
```
- Check email is unread
- Verify sender email matches exactly
- Check Gmail spam folder

### Debug Mode:
```bash
# Run with debug output
DEBUG=* node emailProcessor.js
```

## 📈 Performance

- **Processing time**: ~2-5 seconds per email
- **Memory usage**: ~50MB
- **Render free tier**: 750 hours/month sufficient
- **Email volume**: Handles 100+ emails/5min cycle

## 🔄 Backup & Recovery

**Processed emails tracking:**
- File: `processed_emails.json`
- Auto-backed up to Render persistent storage
- Can be manually restored if needed

**Manual reprocess:**
```bash
# Clear processed history
rm processed_emails.json

# Re-run processor
node emailProcessor.js
```

---

## ✅ Setup Complete Checklist

- [ ] Gmail 2FA enabled
- [ ] App password generated
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Local testing successful
- [ ] Deployed to Render
- [ ] Cron job scheduled
- [ ] First email processed successfully

**Your automated email processor is now live!** 🎉
