#!/usr/bin/env node

/**
 * Generate Secure Keys for Environment Variables
 * 
 * This script generates cryptographically secure keys for:
 * - JWT_SECRET
 * - JWT_REFRESH_SECRET  
 * - SESSION_SECRET
 */

const crypto = require('crypto');

console.log('🔐 Generating Secure Keys for Environment Variables');
console.log('==================================================\n');

// Generate secure random keys
const generateSecureKey = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate keys
const jwtSecret = generateSecureKey(64);
const jwtRefreshSecret = generateSecureKey(64);
const sessionSecret = generateSecureKey(32);

console.log('Copy these values to your .env file:\n');

console.log('# JWT Configuration');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
console.log('JWT_EXPIRES_IN=15m');
console.log('JWT_REFRESH_EXPIRES_IN=7d\n');

console.log('# Session Configuration');
console.log(`SESSION_SECRET=${sessionSecret}\n`);

console.log('🔒 Security Notes:');
console.log('- These keys are cryptographically secure');
console.log('- Never share these keys publicly');
console.log('- Use different keys for development and production');
console.log('- Store production keys securely (e.g., environment variables, secrets manager)');
console.log('- Regenerate keys if compromised\n');

console.log('✅ Keys generated successfully!');
