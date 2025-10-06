const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, 
  max: 5000, 
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, 
  legacyHeaders: false, 
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    return req.ip;
  }
};


const authRateLimitConfig = {
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
};


const passwordResetRateLimitConfig = {
  windowMs: 60 * 60 * 1000, 
  max: 3, 
  message: {
    error: 'Too many password reset attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
};

module.exports = {
  rateLimitConfig,
  authRateLimitConfig,
  passwordResetRateLimitConfig
};
