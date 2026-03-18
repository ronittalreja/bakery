# 🚀 Deployment Steps

## ✅ Current Status
- Gmail connection: ✅ Working
- Test mode: ✅ Ready 
- Dependencies: ✅ Installed

## 📧 Send Test Emails

From **talrejaronit16@gmail.com**, send these emails to **monginisshahad@gmail.com**:

### 1. Invoice Test
```
To: monginisshahad@gmail.com
Subject: Invoice #TEST001 - Monginis Bakery
Body: Test invoice email
```

### 2. CRDR Test
```
To: monginisshahad@gmail.com
Subject: CRDR Note #TEST002 - Monginis Bakery
Body: Test credit note email
```

### 3. ROS Receipt Test
```
To: monginisshahad@gmail.com
Subject: ROS Receipt #TEST003 - Monginis Bakery
Body: Test ROS receipt email
```

## 🧪 Test Processing

After sending emails, run:
```bash
node testEmailProcessor.js --test
```

## 📋 Push to GitHub

Once testing works:
```bash
git add .
git commit -m "Add email processor with cron job"
git push origin main
```

## 🌐 Deploy to Render

1. Go to Render Dashboard
2. Create "Cron Job" service
3. Use `render-cron.json` configuration
4. Set environment variables
5. Deploy

## 🔄 Switch to Production

After successful deployment:
1. Change target sender to `receipt5@mongini.in`
2. Update environment variables on Render
3. Restart cron job

**Ready to go!** 🎉
