import multer from 'multer';

// Store the file in memory as a Buffer
const storage = multer.memoryStorage();

// --- UPDATE THE FILE FILTER ---
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'text/plain' ||
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
  ) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .txt, .pdf, and .docx files are allowed.'), false);
  }
};

export const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 10 } // Increased to 10MB for PDFs
});