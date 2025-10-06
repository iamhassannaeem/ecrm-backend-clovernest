const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { corsOptions } = require('./config/cors');
const { sessionConfig } = require('./config/session');
const { rateLimitConfig } = require('./config/rateLimit');
const { swaggerUi, specs } = require('./config/swagger');
const { prisma } = require('./config/database');
require('./config/passport');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const { auditMiddleware } = require('./utils/audit');
const { globalPermissionMiddleware } = require('./middleware/globalPermissions');

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const organizationsRoutes = require('./routes/organizations');
const adminRoutes = require('./routes/admin');
const superAdminRoutes = require('./routes/super-admin');
const orgAdminRoutes = require('./routes/org-admin');
const rolesRoutes = require('./routes/roles');
const leadsRoutes = require('./routes/leads');
const userTeamsRoutes = require('./routes/userTeams');
const chatRoutes = require('./routes/chat');
const lookupRoutes = require('./routes/lookup');
const callsRoutes = require('./routes/calls');
const notificationRoutes = require('./routes/notifications');

// Initialize Express app
const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make socket.io instance globally available for logout functionality
global.io = io;

// Register Socket.IO handlers
require('./socket')(io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://cdn.socket.io"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http://localhost:3001"],
      connectSrc: ["'self'", "https://api.stripe.com", "wss:", "ws:"],
      frameSrc: ["'self'", "https://js.stripe.com"],
    },
  },
}));
app.use(cors(corsOptions));

// Rate limiting
app.use(rateLimit(rateLimitConfig));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(session(sessionConfig));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Audit middleware for enhanced logging
app.use(auditMiddleware);

// Log every API call and its response status
const { logger } = require('./middleware/errorHandler');
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      message: 'API Request',
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      userId: req.user?.id,
      organizationId: req.organizationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      durationMs: duration
    });
  });
  next();
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #3b82f6; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .swagger-ui .btn.authorize { background-color: #059669; border-color: #059669; }
    .swagger-ui .btn.authorize:hover { background-color: #047857; }
    .swagger-ui .opblock.opblock-post { border-color: #059669; }
    .swagger-ui .opblock.opblock-get { border-color: #0ea5e9; }
    .swagger-ui .opblock.opblock-put { border-color: #f59e0b; }
    .swagger-ui .opblock.opblock-delete { border-color: #dc2626; }
  `,
  customSiteTitle: '🚀 SaaS Backend API - Interactive Testing Suite',
  customfavIcon: '/favicon.ico'
}));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     description: Check if the API server is running and healthy
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "OK"
 *               timestamp: "2024-01-20T15:30:00.000Z"
 *               uptime: 3600.5
 *               environment: "development"
 */
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Serve test.html at /test-lead
app.get('/test-lead', (req, res) => {
  res.sendFile(path.join(__dirname, '../test.html'));
});

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, '../public')));

// Serve test pages directly
app.get('/group-chat-test', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/group-chat-test.html'));
});

app.get('/chat-test', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chat-test.html'));
});

// Global permission middleware - applies to all routes AFTER test routes
app.use(globalPermissionMiddleware);

// Serve uploaded files with CORS and remove cross-origin headers
app.use('/uploads', (req, res, next) => {
  res.removeHeader('cross-origin-resource-policy');
  res.removeHeader('cross-origin-opener-policy');
  next();
}, cors(), express.static('uploads'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/org-admin', orgAdminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/organizations', rolesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/user-teams', userTeamsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/lookup', lookupRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  console.error('Stack:', err.stack);
  // Don't exit the process in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  // Don't exit the process in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Make sure your DATABASE_URL is correct and the database is accessible');
    return false;
  }
}


async function broadcastLeadNotifications() {
  try {
    console.log('📡 Real-time notification system active');
  } catch (error) {
    console.error('❌ Error in real-time notification system:', error.message);
  }
}


setInterval(broadcastLeadNotifications, 30 * 1000);

// Start server
if (require.main === module) {
  // Test database connection first
  testDatabaseConnection().then((connected) => {
    if (!connected) {
      console.error('⚠️  Starting server without database connection. Some features may not work.');
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🗄️  Database: ${connected ? 'Connected' : 'Disconnected'}`);
      console.log(`🟢 Socket.IO enabled on port ${PORT}`);
    });

    // Handle server errors
    server.on('error', (err) => {
      console.error('❌ Server Error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please use a different port or stop the existing process.`);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed.');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed.');
        process.exit(0);
      });
    });
  });
}

module.exports = { app, server, io };
