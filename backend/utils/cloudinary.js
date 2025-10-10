// File: backend/utils/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create storage configurations for different file types
const createStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `monginis/${folder}`,
      allowed_formats: ['pdf', 'txt'],
      resource_type: 'raw', // For PDF files
      public_id: (req, file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        return `${folder}-${uniqueSuffix}`;
      }
    }
  });
};

// Storage configurations
const creditNoteStorage = createStorage('credit-notes');
const invoiceStorage = createStorage('invoices');
const rosReceiptStorage = createStorage('ros-receipts');

// Multer configurations
const creditNoteUpload = multer({
  storage: creditNoteStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const invoiceUpload = multer({
  storage: invoiceStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const rosReceiptUpload = multer({
  storage: rosReceiptStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Utility function to download file from Cloudinary for parsing
const downloadFileFromCloudinary = async (publicId) => {
  try {
    const url = cloudinary.url(publicId, {
      resource_type: 'raw',
      secure: true
    });
    
    // Fetch the file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading file from Cloudinary:', error);
    throw error;
  }
};

// Utility function to get file URL
const getFileUrl = (publicId) => {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    secure: true
  });
};

// Utility function to delete file from Cloudinary
const deleteFileFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw'
    });
    return result;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  creditNoteUpload,
  invoiceUpload,
  rosReceiptUpload,
  downloadFileFromCloudinary,
  getFileUrl,
  deleteFileFromCloudinary
};
