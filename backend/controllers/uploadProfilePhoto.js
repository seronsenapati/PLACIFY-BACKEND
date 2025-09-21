import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow common image formats
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (JPEG, PNG, GIF)"), false);
  }
};

const uploadProfilePhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit
});

export default uploadProfilePhoto;