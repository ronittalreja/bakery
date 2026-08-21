const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Clean up old files from Cloudinary
 * @param {number} daysOld - Delete files older than this many days (default: 7)
 */
async function cleanupCloudinary(daysOld = 7) {
  try {
    console.log('🧹 Starting Cloudinary cleanup...');
    console.log(`📅 Deleting files older than ${daysOld} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    console.log(`🕐 Cutoff date: ${cutoffDateStr}`);

    let totalDeleted = 0;
    let totalErrors = 0;

    // Clean up each folder
    const folders = ['monginis/invoices', 'monginis/credit-notes', 'monginis/ros-receipts'];

    for (const folder of folders) {
      console.log(`\n📁 Processing folder: ${folder}`);

      try {
        // List all resources in the folder
        const result = await cloudinary.api.resources({
          type: 'upload',
          prefix: folder,
          resource_type: 'raw',
          max_results: 500
        });

        console.log(`📊 Found ${result.resources.length} files in ${folder}`);

        if (result.resources.length === 0) {
          console.log(`✅ No files to delete in ${folder}`);
          continue;
        }

        // Filter files older than cutoff date
        const oldFiles = result.resources.filter(resource => {
          const createdAt = new Date(resource.created_at);
          return createdAt < cutoffDate;
        });

        console.log(`🗑️  Found ${oldFiles.length} files older than ${daysOld} days in ${folder}`);

        if (oldFiles.length === 0) {
          console.log(`✅ No old files to delete in ${folder}`);
          continue;
        }

        // Delete old files
        for (const file of oldFiles) {
          try {
            const deleteResult = await cloudinary.uploader.destroy(file.public_id, {
              resource_type: 'raw'
            });

            if (deleteResult.result === 'ok') {
              console.log(`✅ Deleted: ${file.public_id} (${file.created_at})`);
              totalDeleted++;
            } else {
              console.log(`⚠️  Failed to delete: ${file.public_id} - ${deleteResult.result}`);
              totalErrors++;
            }
          } catch (error) {
            console.error(`❌ Error deleting ${file.public_id}:`, error.message);
            totalErrors++;
          }
        }

      } catch (error) {
        console.error(`❌ Error processing folder ${folder}:`, error.message);
        totalErrors++;
      }
    }

    console.log('\n=== CLEANUP SUMMARY ===');
    console.log(`✅ Total files deleted: ${totalDeleted}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    console.log('🧹 Cloudinary cleanup completed');

    return {
      success: true,
      totalDeleted,
      totalErrors
    };

  } catch (error) {
    console.error('❌ Cloudinary cleanup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run cleanup if called directly
if (require.main === module) {
  const daysOld = process.argv[2] ? parseInt(process.argv[2]) : 7;
  cleanupCloudinary(daysOld)
    .then(result => {
      if (result.success) {
        console.log('\n✅ Cleanup completed successfully');
        process.exit(0);
      } else {
        console.log('\n❌ Cleanup failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = cleanupCloudinary;
