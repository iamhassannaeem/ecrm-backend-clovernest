const ALLOWED_MIME_TYPES = [
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

function validateFileType(mimeType) {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

function validateFileSize(size, maxSize = 10 * 1024 * 1024) {
  return size <= maxSize;
}

module.exports = {
  validateFileType,
  validateFileSize,
  ALLOWED_MIME_TYPES
};
