const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        organizationId: true,
        roles: {
          select: {
            name: true,
            isAgent: true
          }
        }
      }
    });
    
    console.log(`Found ${users.length} users in database:`);
    
    users.forEach(user => {
      console.log(`- ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.firstName} ${user.lastName}`);
      console.log(`  Active: ${user.isActive}`);
      console.log(`  Organization ID: ${user.organizationId}`);
      console.log(`  Roles: ${user.roles.map(r => r.name).join(', ')}`);
      console.log('');
    });
    
    if (users.length === 0) {
      console.log('❌ No users found in database. You may need to run the seed script:');
      console.log('   npm run seed');
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers(); 