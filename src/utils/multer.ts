/* eslint-disable @typescript-eslint/no-explicit-any */

import multer from "multer";
import path from "path";
import fs from "fs";

interface UploadConfig {
  destination?: string;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  maxFileSize?: number;
  filenamePrefix?: string;
}

export const createUploadMiddleware = (config: UploadConfig = {}) => {
  const {
    destination = path.join(__dirname, "../uploads"),
    allowedMimeTypes = [],
    allowedExtensions = [],
    maxFileSize = 5 * 1024 * 1024,
    filenamePrefix = ""
  } = config;

  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      const uniqueName = `${filenamePrefix}${Date.now()}_${nameWithoutExt}${ext}`;
      cb(null, uniqueName);
    }
  });

  const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(", ")}`));
    }

    if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
      return cb(new Error(`Invalid file extension. Allowed extensions: ${allowedExtensions.join(", ")}`));
    }

    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxFileSize }
  });
};

// Predefined configurations
export const uploadConfigs = {
  docx: {
    allowedMimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    allowedExtensions: [".docx"],
    destination: path.join(__dirname, "../templates"),
    filenamePrefix: "template_"
  },
  images: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    destination: path.join(__dirname, "../uploads/images"),
    maxFileSize: 10 * 1024 * 1024,
    filenamePrefix: "img_"
  },
  pdf: {
    allowedMimeTypes: ["application/pdf"],
    allowedExtensions: [".pdf"],
    destination: path.join(__dirname, "../uploads/documents"),
    filenamePrefix: "doc_"
  },
  excel: {
    allowedMimeTypes: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    allowedExtensions: [".xls", ".xlsx"],
    destination: path.join(__dirname, "../uploads/spreadsheets"),
    filenamePrefix: "sheet_"
  },

  csv: {
    allowedMimeTypes: ["text/csv", "application/csv"],
    allowedExtensions: [".csv"],
    destination: path.join(__dirname, "../uploads/csv"),
    filenamePrefix: "data_"
  }
};

// For templates - use memory storage to upload to R2
// export const uploadDocxMiddleware = multer({
//   storage: multer.memoryStorage(),
//   fileFilter: (req, file, cb) => {
//     const allowedMimes = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
//     const ext = path.extname(file.originalname).toLowerCase();
//     const allowedExts = [".docx"];

//     if (!allowedMimes.includes(file.mimetype) || !allowedExts.includes(ext)) {
//       return cb(new Error("Invalid file type. Only .docx files are allowed."));
//     }

//     cb(null, true);
//   },
//   limits: {
//     fileSize: 10 * 1024 * 1024
//   }
// }).single("template");

// Keep logo middleware as is
export const uploadLogoMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    if (!allowedMimes.includes(file.mimetype) || !allowedExts.includes(ext)) {
      return cb(new Error("Invalid file type. Only images are allowed."));
    }

    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
}).single("logo");

// Export ready-to-use middleware
export const uploadImageMiddleware = createUploadMiddleware(uploadConfigs.images).single("image");
export const uploadPdfMiddleware = createUploadMiddleware(uploadConfigs.pdf).single("document");
export const uploadExcelMiddleware = createUploadMiddleware(uploadConfigs.excel).single("spreadsheet");
export const uploadCsvMiddleware = createUploadMiddleware(uploadConfigs.csv).single("data");

// For multiple files
export const uploadMultipleImagesMiddleware = createUploadMiddleware(uploadConfigs.images).array("images", 10);

// Single template upload (for ATTAINMENT and CERTIFICATE_SINGLE)
export const uploadDocxMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".docx"];

    if (!allowedMimes.includes(file.mimetype) || !allowedExts.includes(ext)) {
      return cb(new Error("Invalid file type. Only .docx files are allowed."));
    }

    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB max
  }
}).single("template");

// Multiple template upload (for CERTIFICATE_DOUBLE)
export const uploadMultipleDocxMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".docx"];

    if (!allowedMimes.includes(file.mimetype) || !allowedExts.includes(ext)) {
      return cb(new Error("Invalid file type. Only .docx files are allowed."));
    }

    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB max per file
  }
}).fields([
  { name: "template", maxCount: 1 },
  { name: "templatePage1", maxCount: 1 },
  { name: "templatePage2", maxCount: 1 }
]);
