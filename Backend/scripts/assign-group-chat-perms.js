const { prisma } = require('../src/config/database');

/**
 * Quick script to assign CREATE_GROUP_CHAT permissions to Organization Admin roles
 */

async function assignGroupChatPermissions() {
  try {
    console.log('🚀 Assigning Group Chat Permissions...\n');

    // Find all Organization Admin roles (simplified query)
    const adminRoles = await prisma.role.findMany({
      where: {
        name: {
          contains: 'Admin',
          mode: 'insensitive'
        }
      },
      include: {
        organization: {
          select: { name: true }
        }
      }
    });

    if (adminRoles.length === 0) {
      console.log('❌ No Admin roles found');
      return;
    }

    console.log(`Found ${adminRoles.length} admin roles:\n`);

    let totalAdded = 0;
    let totalSkipped = 0;

    // Define permissions to add
    const permissions = [
      { action: 'CREATE', resource: 'CREATE_GROUP_CHAT' },
      { action: 'READ', resource: 'CREATE_GROUP_CHAT' },
      { action: 'UPDATE', resource: 'CREATE_GROUP_CHAT' },
      { action: 'DELETE', resource: 'CREATE_GROUP_CHAT' }
    ];

    for (const role of adminRoles) {
      console.log(`Processing: ${role.name} (${role.organization?.name || 'No Org'})`);
      
      for (const perm of permissions) {
        try {
          // Check if permission exists
          const exists = await prisma.rolePermission.findFirst({
            where: {
              roleId: role.id,
              action: perm.action,
              resource: perm.resource
            }
          });

          if (exists) {
            console.log(`  ⚠️  ${perm.action} already exists`);
            totalSkipped++;
          } else {
            // Add permission
            await prisma.rolePermission.create({
              data: {
                roleId: role.id,
                action: perm.action,
                resource: perm.resource,
                organizationId: role.organizationId
              }
            });
            console.log(`  ✅ Added ${perm.action}`);
            totalAdded++;
          }
        } catch (error) {
          console.log(`  ❌ Error with ${perm.action}: ${error.message}`);
        }
      }
      console.log('');
    }

    console.log('🎯 Summary:');
    console.log(`  ✅ Added: ${totalAdded} permissions`);
    console.log(`  ⚠️  Skipped: ${totalSkipped} permissions`);
    console.log(`  📊 Total roles: ${adminRoles.length}`);
    console.log('\n🎉 Done! Organization Admins can now manage group chats.');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
assignGroupChatPermissions();
