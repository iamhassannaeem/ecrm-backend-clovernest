const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;


const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
     
      let { organizationId, userId, chatId, messageId } = req.body;
      if (!organizationId && req.user) {
        organizationId = req.user.organizationId;
      }
      
      if (!userId && req.user) {
        userId = req.user.id;
      }
     
      if (!chatId) {
        chatId = req.params.conversationId || req.params.groupId;
      }
      
      if (!organizationId || !userId || !chatId) {
        return cb(new Error('Missing required parameters for file upload. Need organizationId, userId, and chatId.'));
      }

      const messageIdForPath = messageId || 'temp';

     
      const uploadPath = path.join(
        'uploads',
        `org_${organizationId}`,
        `user_${userId}`,
        `chat_${chatId}`,
        `message_${messageIdForPath}`
      );

     
      await fs.mkdir(uploadPath, { recursive: true });
      
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
   
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedName}_${timestamp}${ext}`;
    
    cb(null, filename);
  }
});


const fileFilter = (req, file, cb) => {
 
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};


const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  }
});


const uploadSingle = upload.single('file');


const uploadMultiple = upload.array('files', 5);


const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum 5 files per request.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message.includes('File type')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  if (error.message.includes('Missing required parameters')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  next(error);
};


const getFileInfo = (file, organizationId, userId, chatId, messageId) => {
  return {
    fileName: file.originalname,
    filePath: path.relative('uploads', file.path),
    mimeType: file.mimetype,
    size: file.size,
    organizationId: parseInt(organizationId),
    userId: parseInt(userId),
    chatId: chatId,
    messageId: messageId
  };
};


const cleanupFiles = async (files) => {
  try {
    if (Array.isArray(files)) {
      for (const file of files) {
        await fs.unlink(file.path);
      }
    } else if (files && files.path) {
      await fs.unlink(files.path);
    }
  } catch (error) {
    console.error('Error cleaning up files:', error);
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  getFileInfo,
  cleanupFiles
};


const supportStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadPath = path.join('uploads', 'support');
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedName}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const supportUpload = multer({
  storage: supportStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

module.exports.uploadSupportImage = supportUpload.single('image');