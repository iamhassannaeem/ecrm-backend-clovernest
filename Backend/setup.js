#!/usr/bin/env node

/**
 * Setup Script for SaaS Backend System
 * 
 * This script helps users set up the database and initial configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 SaaS Backend Setup Script');
console.log('============================\n');

// Check if .env exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('Please copy .env.example to .env and configure your environment variables.');
  process.exit(1);
}

console.log('✅ Environment file found');

// Check database connection
console.log('\n📊 Setting up database...');

try {
  // Generate Prisma client
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated');

  // Push database schema
  console.log('🔧 Pushing database schema...');
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('✅ Database schema updated');

  // Create super admin
  console.log('👑 Creating super admin...');
  execSync('node scripts/create-super-admin.js', { stdio: 'inherit' });
  console.log('✅ Super admin created');

  // Seed database
  console.log('🌱 Seeding database...');
  execSync('node prisma/seed.js', { stdio: 'inherit' });
  console.log('✅ Database seeded');

} catch (error) {
  console.log('\n❌ Database setup failed!');
  console.log('\nPossible solutions:');
  console.log('1. Make sure PostgreSQL is running (docker-compose up -d postgres)');
  console.log('2. Check your DATABASE_URL in .env file');
  console.log('3. Ensure database credentials are correct');
  console.log('\nFor SQLite alternative, see README.md');
  process.exit(1);
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 System Architecture:');
console.log('• Super Admin: Platform-wide administration');
console.log('• Organization Admin: Organization-specific administration');
console.log('• Users: Organization members with assigned roles');
console.log('\n🔐 Authentication Flow:');
console.log('1. Super Admin creates organizations');
console.log('2. Organization Admin is automatically created');
console.log('3. Organization Admin manages users and roles');
console.log('\n🚀 Next steps:');
console.log('1. Start the development server: npm run dev');
console.log('2. Open API documentation: http://localhost:3001/api-docs');
console.log('3. Test the health endpoint: http://localhost:3001/health');
console.log('4. Login as Super Admin to create organizations');
console.log('\nHappy coding! 🚀');
