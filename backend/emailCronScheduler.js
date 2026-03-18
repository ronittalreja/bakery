const cron = require('node-cron');
const EmailProcessor = require('./emailProcessor');
require('dotenv').config();

class EmailCronScheduler {
  constructor() {
    this.isRunning = false;
    this.processor = new EmailProcessor();
  }

  async runEmailProcessor() {
    if (this.isRunning) {
      console.log('⏳ Email processor already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    
    try {
      console.log('🕐 Starting scheduled email check at:', new Date().toISOString());
      await this.processor.start();
      console.log('✅ Scheduled email check completed at:', new Date().toISOString());
    } catch (error) {
      console.error('❌ Scheduled email check failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    console.log('🚀 Starting Email Cron Scheduler');
    console.log('⏰ Schedule: Every 5 minutes');
    console.log('📧 Monitoring: receipt5@mongini.in');
    
    // Run immediately on start
    this.runEmailProcessor();
    
    // Schedule every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.runEmailProcessor();
    });

    console.log('✅ Email cron scheduler started successfully');
  }
}

// Start the scheduler
if (require.main === module) {
  const scheduler = new EmailCronScheduler();
  scheduler.start();
}

module.exports = EmailCronScheduler;
