const express = require('express');
const router = express.Router();
const https = require('https');
const { URL } = require('url');
const { authenticateToken } = require('../middleware/auth');
const backblazeService = require('../services/backblazeService');

router.post('/presigned-url', authenticateToken, async (req, res) => {
  try {
    const { fileName, fileType, type = 'chat', contextId } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    if (!fileName || !fileType) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileType are required'
      });
    }

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

    if (!allowedMimeTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: `File type ${fileType} is not allowed`
      });
    }

    const result = await backblazeService.generatePresignedUploadUrl(
      fileName,
      fileType,
      {
        type,
        organizationId,
        userId,
        contextId
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    
    let errorMessage = error.message;
    if (errorMessage.includes('B2_BUCKET_NAME') || errorMessage.includes('Bucket')) {
      errorMessage = 'Backblaze configuration error: B2_BUCKET_NAME environment variable is not set. Please configure Backblaze credentials in your .env file.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

router.post('/direct-upload', authenticateToken, async (req, res) => {
  try {
    const { fileName, fileType, fileData, type = 'chat', contextId } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    if (!fileName || !fileType || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'fileName, fileType, and fileData are required'
      });
    }

    const fileBuffer = Buffer.from(fileData, 'base64');
    const key = backblazeService.generateFileKey(type, organizationId, userId, contextId, fileName);
    
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const { s3Client, BUCKET_NAME } = backblazeService;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: fileType,
    });

    await s3Client.send(command);

    const fileUrl = `${process.env.B2_ENDPOINT}/${BUCKET_NAME}/${key}`;

    res.json({
      success: true,
      data: {
        fileUrl,
        key,
        fileName,
        mimeType: fileType,
        size: fileBuffer.length
      }
    });
  } catch (error) {
    console.error('Error in direct upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/proxy-upload', authenticateToken, async (req, res) => {
  try {
    const { uploadUrl, fileData, contentType } = req.body;

    if (!uploadUrl || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'uploadUrl and fileData are required'
      });
    }

    const fileBuffer = Buffer.from(fileData, 'base64');
    const urlObj = new URL(uploadUrl);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': fileBuffer.length
      }
    };

    return new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let responseData = '';

        response.on('data', (chunk) => {
          responseData += chunk;
        });

        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            res.json({
              success: true,
              message: 'File uploaded successfully'
            });
            resolve();
          } else {
            let errorMessage = `Upload failed with status ${response.statusCode}`;
            
            if (responseData.includes('<Error>')) {
              const messageMatch = responseData.match(/<Message>(.*?)<\/Message>/);
              const codeMatch = responseData.match(/<Code>(.*?)<\/Code>/);
              if (messageMatch) {
                errorMessage = messageMatch[1];
              }
              if (codeMatch) {
                errorMessage = `${codeMatch[1]}: ${errorMessage}`;
              }
            } else {
              errorMessage = responseData || errorMessage;
            }

            console.error('Backblaze upload error:', {
              status: response.statusCode,
              statusMessage: response.statusMessage,
              data: responseData,
              headers: response.headers
            });

            res.status(response.statusCode).json({
              success: false,
              error: errorMessage,
              details: responseData
            });
            resolve();
          }
        });
      });

      request.on('error', (error) => {
        console.error('Request error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
        reject(error);
      });

      request.write(fileBuffer);
      request.end();
    });
  } catch (error) {
    console.error('Error proxying upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/test-credentials', authenticateToken, async (req, res) => {
  try {
    const { ListBucketsCommand } = require('@aws-sdk/client-s3');
    const { s3Client } = backblazeService;
    
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    
    res.json({
      success: true,
      message: 'Backblaze credentials are valid',
      buckets: response.Buckets?.map(b => ({ name: b.Name, creationDate: b.CreationDate })) || []
    });
  } catch (error) {
    console.error('Credential test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Please verify your B2_KEY_ID and B2_APP_KEY in .env file'
    });
  }
});

router.post('/presigned-view-url', authenticateToken, async (req, res) => {
  try {
    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: 'fileUrl is required'
      });
    }

    const key = backblazeService.extractKeyFromUrl(fileUrl);
    
    if (!key) {
      console.error('Failed to extract key from URL:', fileUrl);
      console.error('BUCKET_NAME:', backblazeService.BUCKET_NAME);
      console.error('B2_ENDPOINT:', process.env.B2_ENDPOINT);
      return res.status(400).json({
        success: false,
        error: 'Invalid file URL. Could not extract key from URL.',
        details: {
          providedUrl: fileUrl,
          bucketName: backblazeService.BUCKET_NAME,
          endpoint: process.env.B2_ENDPOINT
        }
      });
    }

    const viewUrl = await backblazeService.generatePresignedViewUrl(key);

    res.json({
      success: true,
      data: { url: viewUrl }
    });
  } catch (error) {
    console.error('Error generating presigned view URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/view-url', authenticateToken, async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'key is required'
      });
    }

    const viewUrl = await backblazeService.generatePresignedViewUrl(key);

    res.json({
      success: true,
      data: { url: viewUrl }
    });
  } catch (error) {
    console.error('Error generating view URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Handle OPTIONS preflight for CORS
router.options('/download-proxy', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.status(200).end();
});

// GET endpoint to proxy file downloads with CORS headers
router.get('/download-proxy', authenticateToken, async (req, res) => {
  try {
    const { fileUrl, attachmentId, inline } = req.query;
    const shouldInline = inline === 'true' || inline === '1';

    let filePath = fileUrl;
    let fileName = null;
    let mimeType = null;

    // If attachmentId is provided, fetch the file path from database
    if (attachmentId && !fileUrl) {
      const { prisma } = require('../config/database');
      const userId = req.user.id;

      const attachment = await prisma.attachment.findFirst({
        where: {
          OR: [
            {
              id: parseInt(attachmentId),
              message: {
                chatSession: {
                  participants: {
                    some: { userId }
                  }
                }
              }
            },
            {
              id: parseInt(attachmentId),
              groupMessage: {
                groupChat: {
                  participants: {
                    some: { userId }
                  }
                }
              }
            }
          ]
        }
      });

      if (!attachment) {
        return res.status(404).json({
          success: false,
          error: 'Attachment not found or access denied'
        });
      }

      filePath = attachment.filePath;
      fileName = attachment.fileName;
      mimeType = attachment.mimeType;
    }

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'fileUrl or attachmentId is required'
      });
    }

    // Extract the key from the URL
    const key = backblazeService.extractKeyFromUrl(filePath);
    
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file URL. Could not extract key from URL.'
      });
    }

    // Generate a fresh presigned URL (valid for 1 hour)
    const signedUrl = await backblazeService.generatePresignedViewUrl(key, 3600);

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');

    // Fetch the file from Backblaze and stream it to the client
    const urlObj = new URL(signedUrl);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Node.js/Backend'
      }
    };

    https.get(options, (backblazeResponse) => {
      // Set content type and disposition headers
      if (mimeType) {
        res.setHeader('Content-Type', mimeType);
      } else if (backblazeResponse.headers['content-type']) {
        res.setHeader('Content-Type', backblazeResponse.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }

      if (fileName) {
        const disposition = shouldInline ? 'inline' : 'attachment';
        res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileName)}"`);
      } else {
        const disposition = shouldInline ? 'inline' : 'attachment';
        res.setHeader('Content-Disposition', disposition);
      }

      // Copy content length if available
      if (backblazeResponse.headers['content-length']) {
        res.setHeader('Content-Length', backblazeResponse.headers['content-length']);
      }

      // Set status code
      res.status(backblazeResponse.statusCode);

      // Handle errors
      backblazeResponse.on('error', (error) => {
        console.error('Error fetching file from Backblaze:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to fetch file from storage'
          });
        }
      });

      // Stream the file to the client
      backblazeResponse.pipe(res);
    }).on('error', (error) => {
      console.error('Error making request to Backblaze:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to connect to storage service'
        });
      }
    });

  } catch (error) {
    console.error('Error in download proxy:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// POST endpoint to get download URL (for compatibility)
router.post('/download-proxy', authenticateToken, async (req, res) => {
  try {
    const { fileUrl, attachmentId } = req.body;

    let filePath = fileUrl;

    if (attachmentId && !fileUrl) {
      const { prisma } = require('../config/database');
      const userId = req.user.id;

      const attachment = await prisma.attachment.findFirst({
        where: {
          OR: [
            {
              id: parseInt(attachmentId),
              message: {
                chatSession: {
                  participants: {
                    some: { userId }
                  }
                }
              }
            },
            {
              id: parseInt(attachmentId),
              groupMessage: {
                groupChat: {
                  participants: {
                    some: { userId }
                  }
                }
              }
            }
          ]
        }
      });

      if (!attachment) {
        return res.status(404).json({
          success: false,
          error: 'Attachment not found or access denied'
        });
      }

      filePath = attachment.filePath;
    }

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'fileUrl or attachmentId is required'
      });
    }

    // Extract the key from the URL
    const key = backblazeService.extractKeyFromUrl(filePath);
    
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file URL. Could not extract key from URL.'
      });
    }

    // Generate a fresh presigned URL (valid for 1 hour)
    const signedUrl = await backblazeService.generatePresignedViewUrl(key, 3600);

    res.json({
      success: true,
      data: { 
        url: signedUrl,
        fileUrl: filePath
      }
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
