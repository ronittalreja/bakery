// Utility functions for handling image URLs, especially Google Drive links

/**
 * Convert Google Drive shareable link to direct image URL
 * @param {string} driveUrl - Google Drive shareable URL
 * @returns {string} - Direct image URL
 */
const convertGoogleDriveUrl = (driveUrl) => {
  if (!driveUrl || typeof driveUrl !== 'string') {
    return null;
  }

  // Handle different Google Drive URL formats
  const patterns = [
    // Format 1: https://drive.google.com/file/d/FILE_ID/view
    /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view/,
    // Format 2: https://drive.google.com/open?id=FILE_ID
    /https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    // Format 3: https://drive.google.com/file/d/FILE_ID/edit
    /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/edit/,
    // Format 4: https://drive.google.com/uc?id=FILE_ID (already direct)
    /https:\/\/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = driveUrl.match(pattern);
    if (match) {
      const fileId = match[1];
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  }

  // If no pattern matches, return the original URL (might already be direct)
  return driveUrl;
};

/**
 * Validate if URL is a valid image URL
 * @param {string} url - Image URL to validate
 * @returns {boolean} - True if valid image URL
 */
const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Check if it's a valid URL
  try {
    new URL(url);
  } catch {
    return false;
  }

  // Check if it's an image URL (common image extensions)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const lowerUrl = url.toLowerCase();
  
  return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
         lowerUrl.includes('drive.google.com') ||
         lowerUrl.includes('imgur.com') ||
         lowerUrl.includes('postimg.cc') ||
         lowerUrl.includes('ibb.co');
};

/**
 * Process image URL - convert Google Drive links and validate
 * @param {string} imageUrl - Raw image URL
 * @returns {string|null} - Processed image URL or null if invalid
 */
const processImageUrl = (imageUrl) => {
  if (!imageUrl) {
    return null;
  }

  // Convert Google Drive URL if needed
  const processedUrl = convertGoogleDriveUrl(imageUrl);
  
  // Validate the processed URL
  if (isValidImageUrl(processedUrl)) {
    return processedUrl;
  }

  return null;
};

module.exports = {
  convertGoogleDriveUrl,
  isValidImageUrl,
  processImageUrl
};
