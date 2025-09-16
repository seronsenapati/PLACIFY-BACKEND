import multer from "multer";

// Store file in memory buffer
const storage = multer.memoryStorage();

// Allow PDF and DOCX files
const fileFilter = (req, file, cb) => {
  // Check for PDF files (both by MIME type and extension)
  const isPdf = file.mimetype === "application/pdf" || 
                file.originalname.toLowerCase().endsWith(".pdf");
  
  // Check for DOCX files
  const isDocx = file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                 file.originalname.toLowerCase().endsWith(".docx");

  if (isPdf || isDocx) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and DOCX files are allowed"), false);
  }
};

// Configure multer
const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max (matching the validation in applyToJob)
});

export default uploadResume;