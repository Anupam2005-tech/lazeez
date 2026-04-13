const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Cloudinary config will automatically pick up CLOUDINARY_URL from .env
// No manual config needed if the ENV variable is set.

// Accept all image formats up to 10MB
const multerMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

/**
 * Middleware factory that returns [multerSingle, compressAndUploadToCloudinary].
 * @param {Object} options
 * @param {string} options.prefix     - Filename prefix (e.g. 'dish', 'cat', 'offer')
 * @param {string} options.uploadDir  - Subdirectory on Cloudinary (e.g. '' or 'categories')
 */
function imageUpload(options) {
  const { prefix, uploadDir = '' } = options;

  const compressAndUpload = async (req, res, next) => {
    if (!req.file || !req.file.buffer) return next();

      try {
        console.log('Processing image upload for file:', req.file.originalname);
        // Process buffer with sharp
        const buffer = await sharp(req.file.buffer)
          .resize(3840, 2160, { fit: 'inside', withoutEnlargement: true })
          .avif({
            quality: 80,
            effort: 4,
            chromaSubsampling: '4:4:4'
          })
          .toBuffer();
        console.log('Image successfully compressed with sharp');

        // Cloudinary folder path
        const folderPath = uploadDir ? `resto/${uploadDir}` : 'resto';
        console.log('Uploading to Cloudinary folder:', folderPath);

        // Upload stream to cloudinary
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: folderPath,
              resource_type: 'image',
              format: 'avif' // Explicitly tell Cloudinary to store it as AVIF
            },
            (error, result) => {
              if (error) {
                console.error('Cloudinary upload_stream error:', error);
                return reject(error);
              }
              resolve(result);
            }
          );
          uploadStream.end(buffer);
        });
        console.log('Cloudinary upload successful. URL:', result.secure_url);

        // Pass the complete URL directly to standard filename parameter
        req.file.filename = result.secure_url;
        
        next();
      } catch (err) {
        console.error('Detailed Cloudinary Image upload failure:', err);
        next(new Error('Failed to process and upload image. Please try a different file.'));
      }
  };

  return [multerMemory.single('image'), compressAndUpload];
}

// Helper to destroy images if needed
const deleteImage = async (url) => {
  if (!url || !url.includes('cloudinary.com')) return;
  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return;
    const idWithExt = parts.slice(uploadIndex + 2).join('/');
    const publicId = idWithExt.split('.')[0];
    await cloudinary.uploader.destroy(publicId);
  } catch(e) {
    console.error('Failed to delete image from Cloudinary:', e);
  }
};

module.exports = { imageUpload, deleteImage };
