import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary and delete the local temp file.
 * @param filePath - Local path of the file saved by multer
 * @param folder - Cloudinary folder to organize uploads (e.g. 'courses', 'topics')
 * @param resourceType - 'image', 'video', or 'raw' (for PDFs, etc.)
 * @returns Cloudinary secure URL
 */
export const uploadToCloudinary = async (
  filePath: string,
  folder: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<string> => {
  try {
    // Use upload_large for videos to handle files > 100MB safely
    const result: any = await (resourceType === 'video' 
      ? cloudinary.uploader.upload_large(filePath, {
          folder: `prokodex/${folder}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
          timeout: 600000, // 10 minutes timeout for slow networks
          chunk_size: 6000000 // 6MB chunks
        })
      : cloudinary.uploader.upload(filePath, {
          folder: `prokodex/${folder}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
          timeout: 600000,
        })
    );

    // Delete local temp file after successful upload
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Could not delete temp file:', filePath);
    });

    return result.secure_url;
  } catch (error) {
    // Still try to clean up temp file on error
    fs.unlink(filePath, () => { });
    throw error;
  }
};

/**
 * Upload a base64 encoded image to Cloudinary
 * @param base64String - Base64 Data URL
 * @param folder - Cloudinary folder
 * @returns Cloudinary secure URL
 */
export const uploadBase64ToCloudinary = async (
  base64String: string,
  folder: string
): Promise<string> => {
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder: `prokodex/${folder}`,
      resource_type: 'auto',
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary base64 upload error:', error);
    throw error;
  }
};

/**
 * Delete a file from Cloudinary by URL
 */
export const deleteFromCloudinary = async (url: string) => {
  try {
    // Extract public_id from Cloudinary URL
    const parts = url.split('/upload/');
    if (parts.length < 2) return;

    // Remove version prefix (v123456/) and file extension
    let publicId = parts[1].replace(/^v\d+\//, '');
    publicId = publicId.replace(/\.[^.]+$/, '');

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn('Could not delete from Cloudinary:', error);
  }
};

export default cloudinary;
