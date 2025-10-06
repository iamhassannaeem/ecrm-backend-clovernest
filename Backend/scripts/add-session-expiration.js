const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addSessionExpiration() {
  try {
    console.log('Adding expiresAt column to ChatSession table...');
    
    // Add the expiresAt column
    await prisma.$executeRaw`
      ALTER TABLE "ChatSession" 
      ADD COLUMN "expiresAt" TIMESTAMP;
    `;
    
    console.log('Successfully added expiresAt column to ChatSession table');
    
    // Update existing sessions to have a default expiration (24 hours from creation)
    await prisma.$executeRaw`
      UPDATE "ChatSession" 
      SET "expiresAt" = "createdAt" + INTERVAL '24 hours'
      WHERE "expiresAt" IS NULL AND "isActive" = true;
    `;
    
    console.log('Updated existing active sessions with default expiration');
    
  } catch (error) {
    console.error('Error adding session expiration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSessionExpiration(); 