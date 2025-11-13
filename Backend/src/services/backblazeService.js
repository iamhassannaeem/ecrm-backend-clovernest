require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET_NAME = process.env.B2_BUCKET_NAME;
const B2_ENDPOINT = process.env.B2_ENDPOINT;
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_REGION = process.env.B2_REGION || 'us-west-002';

if (!BUCKET_NAME) {
  throw new Error('B2_BUCKET_NAME environment variable is required');
}

if (!B2_ENDPOINT) {
  throw new Error('B2_ENDPOINT environment variable is required');
}

if (!B2_KEY_ID) {
  throw new Error('B2_KEY_ID environment variable is required');
}

if (!B2_APP_KEY) {
  throw new Error('B2_APP_KEY environment variable is required');
}

if (process.env.NODE_ENV !== 'production') {
  console.log('Backblaze Configuration:');
  console.log('  BUCKET_NAME:', BUCKET_NAME ? '✓ Set' : '✗ Missing');
  console.log('  B2_ENDPOINT:', B2_ENDPOINT ? '✓ Set' : '✗ Missing');
  console.log('  B2_KEY_ID:', B2_KEY_ID ? '✓ Set' : '✗ Missing');
  console.log('  B2_APP_KEY:', B2_APP_KEY ? '✓ Set' : '✗ Missing');
  console.log('  B2_REGION:', B2_REGION);
}

const s3Client = new S3Client({
  region: B2_REGION,
  endpoint: B2_ENDPOINT,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY,
  },
  forcePathStyle: true,
});

function generateFileKey(type, organizationId, userId, contextId, fileName) {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  if (type === 'logo') {
    return `logos/org_${organizationId}/${timestamp}_${sanitizedFileName}`;
  }
  
  if (type === 'chat') {
    return `chat/org_${organizationId}/user_${userId}/chat_${contextId}/${timestamp}_${sanitizedFileName}`;
  }
  
  if (type === 'group') {
    return `group/org_${organizationId}/user_${userId}/group_${contextId}/${timestamp}_${sanitizedFileName}`;
  }
  
  return `uploads/${timestamp}_${sanitizedFileName}`;
}

async function generatePresignedUploadUrl(fileName, fileType, options = {}) {
  if (!BUCKET_NAME) {
    throw new Error('B2_BUCKET_NAME is not configured');
  }

  const {
    type = 'chat',
    organizationId,
    userId,
    contextId,
    expiresIn = 900
  } = options;

  const key = generateFileKey(type, organizationId, userId, contextId, fileName);
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  
  const fileUrl = `${B2_ENDPOINT}/${BUCKET_NAME}/${key}`;
  
  return {
    uploadUrl,
    fileUrl,
    key
  };
}

async function generatePresignedViewUrl(key, expiresIn = 3600) {
  if (!BUCKET_NAME) {
    throw new Error('B2_BUCKET_NAME is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const viewUrl = await getSignedUrl(s3Client, command, { expiresIn });
  
  return viewUrl;
}

async function deleteFile(key) {
  if (!BUCKET_NAME) {
    throw new Error('B2_BUCKET_NAME is not configured');
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from Backblaze:', error);
    return false;
  }
}

function extractKeyFromUrl(url) {
  if (!url || !BUCKET_NAME || !B2_ENDPOINT) {
    console.error('extractKeyFromUrl: Missing parameters', { url: !!url, BUCKET_NAME: !!BUCKET_NAME, B2_ENDPOINT: !!B2_ENDPOINT });
    return null;
  }
  
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('extractKeyFromUrl debug:', {
        url,
        pathname: urlObj.pathname,
        pathParts,
        BUCKET_NAME,
        B2_ENDPOINT
      });
    }
    
    const bucketIndex = pathParts.findIndex(part => part === BUCKET_NAME);
    
    if (bucketIndex === -1) {
      console.error('extractKeyFromUrl: Bucket not found in path', { pathParts, BUCKET_NAME });
      return null;
    }
    
    const keyParts = pathParts.slice(bucketIndex + 1);
    
    if (keyParts.length === 0) {
      console.error('extractKeyFromUrl: No key parts after bucket');
      return null;
    }
    
    const key = keyParts.join('/');
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('extractKeyFromUrl: Extracted key:', key);
    }
    
    return key;
  } catch (error) {
    console.error('Error extracting key from URL:', error, { url });
    return null;
  }
}

module.exports = {
  generatePresignedUploadUrl,
  generatePresignedViewUrl,
  deleteFile,
  extractKeyFromUrl,
  generateFileKey,
  s3Client,
  BUCKET_NAME
};

