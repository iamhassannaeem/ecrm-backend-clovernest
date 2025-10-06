const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Running notification system migration...');

try {
  // Change to the Backend directory
  process.chdir(path.join(__dirname));
  
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('🗄️ Running database migration...');
  execSync('npx prisma migrate dev --name add_notifications', { stdio: 'inherit' });
  
  console.log('✅ Notification system migration completed successfully!');
  console.log('🎉 The notification system is now ready to use.');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.log('💡 Make sure your database is running and accessible.');
  process.exit(1);
} 