// utils/logoUpload.js or middleware/logoUpload.js
import multer from "multer";

// 1. Store file in memory for Cloudinary
const storage = multer.memoryStorage();

// 2. Accept only image types
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only image files are allowed"),
      false
    );
  }
};

// 3. Limit file size to 3MB
const logoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

export { logoUpload };
