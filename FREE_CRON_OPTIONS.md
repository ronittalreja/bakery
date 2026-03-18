# 🆓 FREE Cron Job Options

## Option 1: GitHub Actions (Recommended - 100% FREE)

### Setup Steps:
1. **Create GitHub Secrets**:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     ```
     GMAIL_EMAIL=monginisshahad@gmail.com
     GMAIL_APP_PASSWORD=guds gpof yslx lkbb
     BACKEND_URL=https://your-backend.onrender.com
     API_TOKEN=your_jwt_secret
     ```

2. **Push the workflow**:
   ```bash
   git add .github/workflows/email-processor.yml
   git commit -m "Add GitHub Actions cron job"
   git push origin main
   ```

3. **That's it!** Runs every 5 minutes for FREE

### Benefits:
- ✅ 100% FREE (GitHub Actions free tier)
- ✅ 2000 minutes/month free (more than enough)
- ✅ Built-in logging
- ✅ Manual trigger available
- ✅ No server costs

## Option 2: EasyCron (Free Tier)

1. Sign up at [easycron.com](https://www.easycron.com)
2. Create free account (1 cron job free)
3. Set URL: `https://your-backend.onrender.com/api/email-trigger`
4. Schedule: Every 5 minutes
5. Add webhook endpoint to your backend

## Option 3: Vercel Cron Jobs (Free)

If you move backend to Vercel:
- Free cron jobs included
- Same workflow file works

## Recommendation: **Use GitHub Actions**

It's completely free and already set up! Just add the secrets and push.
