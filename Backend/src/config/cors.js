const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://localhost:3000',
      'https://localhost:3001',
      'https://localhost:3002',
      'https://localhost:5173', 
      'https://localhost:5174',
      'https://crm-admin-sandbox.elogixit.com',
      'https://crm-sandbox.elogixit.com',
      'https://crm-admin-api-sandbox.elogixit.com',
      'https://jptech.elogixit.com',
      'https://growlatics.elogixit.com',
      'https://clovernest.elogixit.com'
    ];

    // In production, you might want to be more restrictive
    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push('https://yourdomain.com');
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Organization-Id'
  ]
};

module.exports = { corsOptions };
