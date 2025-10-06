const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to calculate session expiration time based on JWT token
function calculateSessionExpiration() {
  const tokenExpiry = process.env.JWT_EXPIRES_IN || '15m';
  const expiryMinutes = parseInt(tokenExpiry.replace(/[^0-9]/g, ''));
  const expiryDate = new Date();
  expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);
  return expiryDate;
}

// Helper function to check if session is expired
function isSessionExpired(session) {
  if (!session.expiresAt) return false;
  return new Date() > session.expiresAt;
}

async function testChatSessionExpiration() {
  try {
    console.log('🧪 Testing Chat Session Expiration Functionality...\n');

    // Test 1: Create a session with expiration
    console.log('1. Creating a test chat session with expiration...');
    const sessionExpiry = calculateSessionExpiration();
    
    const testSession = await prisma.chatSession.create({
      data: {
        organizationId: 1, // Assuming org ID 1 exists
        expiresAt: sessionExpiry,
        participants: {
          create: [
            { userId: 1, organizationId: 1 },
            { userId: 2, organizationId: 1 }
          ]
        }
      },
      include: { participants: true }
    });
    
    console.log(`✅ Created session ID: ${testSession.id}`);
    console.log(`   Expires at: ${testSession.expiresAt}`);
    console.log(`   Is expired: ${isSessionExpired(testSession)}\n`);

    // Test 2: Create an expired session
    console.log('2. Creating an expired chat session...');
    const expiredDate = new Date();
    expiredDate.setMinutes(expiredDate.getMinutes() - 10); // 10 minutes ago
    
    const expiredSession = await prisma.chatSession.create({
      data: {
        organizationId: 1,
        expiresAt: expiredDate,
        participants: {
          create: [
            { userId: 1, organizationId: 1 },
            { userId: 3, organizationId: 1 }
          ]
        }
      },
      include: { participants: true }
    });
    
    console.log(`✅ Created expired session ID: ${expiredSession.id}`);
    console.log(`   Expires at: ${expiredSession.expiresAt}`);
    console.log(`   Is expired: ${isSessionExpired(expiredSession)}\n`);

    // Test 3: Test cleanup function
    console.log('3. Testing cleanup of expired sessions...');
    const cleanupResult = await prisma.chatSession.updateMany({
      where: {
        isActive: true,
        expiresAt: {
          lt: new Date()
        }
      },
      data: {
        isActive: false,
        endedAt: new Date()
      }
    });
    
    console.log(`✅ Cleaned up ${cleanupResult.count} expired sessions\n`);

    // Test 4: Verify cleanup worked
    console.log('4. Verifying cleanup results...');
    const activeSessions = await prisma.chatSession.findMany({
      where: { isActive: true },
      include: { participants: true }
    });
    
    const expiredSessions = await prisma.chatSession.findMany({
      where: { isActive: false },
      include: { participants: true }
    });
    
    console.log(`✅ Active sessions: ${activeSessions.length}`);
    console.log(`✅ Inactive sessions: ${expiredSessions.length}\n`);

    // Test 5: Test session expiration calculation
    console.log('5. Testing session expiration calculation...');
    const testExpiry = calculateSessionExpiration();
    console.log(`✅ Calculated expiry: ${testExpiry}`);
    console.log(`   Current time: ${new Date()}`);
    console.log(`   Minutes until expiry: ${Math.round((testExpiry - new Date()) / (1000 * 60))}\n`);

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testChatSessionExpiration(); 