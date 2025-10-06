const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserRoles() {
  try {
    console.log('🔍 Checking user roles and agent status...\n');

    // Find the sale agent user
    const user = await prisma.user.findUnique({
      where: { email: 'sahil@gmail.com' },
      include: {
        roles: {
          include: {
            rolePermissions: true
          }
        },
        organization: true
      }
    });

    if (!user) {
      console.log('❌ User sahil@gmail.com not found');
      return;
    }

    console.log('👤 User Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.firstName} ${user.lastName}`);
    console.log(`  Organization: ${user.organization?.name} (ID: ${user.organizationId})`);
    console.log(`  Active: ${user.isActive}`);

    console.log('\n🎭 User Roles:');
    if (user.roles && user.roles.length > 0) {
      user.roles.forEach((role, index) => {
        console.log(`  ${index + 1}. Role: ${role.name}`);
        console.log(`     Description: ${role.description}`);
        console.log(`     isAgent: ${role.isAgent}`);
        console.log(`     Organization ID: ${role.organizationId}`);
        console.log(`     Active: ${role.isActive}`);
        
        if (role.rolePermissions && role.rolePermissions.length > 0) {
          console.log(`     Permissions: ${role.rolePermissions.length} permissions`);
          role.rolePermissions.forEach(perm => {
            console.log(`       - ${perm.action} ${perm.resource}`);
          });
        } else {
          console.log(`     Permissions: None`);
        }
        console.log('');
      });
    } else {
      console.log('  No roles assigned');
    }

    // Check if any role has isAgent = true
    const hasAgentRole = user.roles.some(role => role.isAgent === true);
    console.log(`🔍 User has agent role: ${hasAgentRole}`);

    // Check all roles in the organization to see what's available
    console.log('\n🏢 All Roles in Organization:');
    const allRoles = await prisma.role.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' }
    });

    allRoles.forEach(role => {
      console.log(`  - ${role.name} (isAgent: ${role.isAgent}, Active: ${role.isActive})`);
    });

  } catch (error) {
    console.error('❌ Error checking user roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRoles(); 