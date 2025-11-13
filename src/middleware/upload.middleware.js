import multer from 'multer';

// Store the file in memory as a Buffer
const storage = multer.memoryStorage();

// Basic filter to only accept .txt files for now
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/plain') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .txt files are allowed.'), false);
  }
};

export const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 5 } // 5MB file size limit
});