require("dotenv").config();
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");

// ======================
// AWS S3 CONFIG
// ======================
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// ======================
// FILE FILTER (IMAGES ONLY)
// ======================
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed."
      )
    );
  }
};

// ======================
// UPLOAD MULTIPLE CAR IMAGES (PUBLIC)
// ======================
const uploadCarImages = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME || "bookusautorentals",
    // acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata(req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key(req, file, cb) {
      const userId = req.user?._id || "anonymous";
      const timestamp = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `cars/${userId}/${timestamp}${ext}`;
      cb(null, filename);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10,
  },
});

// ======================
// UPLOAD SINGLE DOCUMENT (PRIVATE)
// ======================
const uploadSingleFile = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME || "bookusautorentals",
    // acl: "private",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata(req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key(req, file, cb) {
      const userId = req.user?._id || "anonymous";
      const timestamp = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `documents/${userId}/license_${timestamp}${ext}`;
      cb(null, filename);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

// ======================
// DELETE IMAGE FROM S3
// ======================
const deleteImageFromS3 = async (imageUrl) => {
  try {
    if (!imageUrl) return;

    // Handles full S3 URLs safely
    const bucket = process.env.AWS_BUCKET_NAME || "bookusautorentals";
    const key = decodeURIComponent(
      imageUrl.split(`${bucket}/`)[1]
    );

    if (!key) return;

    await s3
      .deleteObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
  } catch (error) {
    console.error("Error deleting image from S3:", error);
    throw new Error("Failed to delete image from S3");
  }
};

// ======================
// EXPORTS
// ======================
module.exports = {
  s3,
  uploadCarImages,
  uploadSingleFile,
  deleteImageFromS3,
};