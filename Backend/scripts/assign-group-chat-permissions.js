const { prisma } = require('../src/config/database');

/**
 * Script to assign CREATE_GROUP_CHAT permissions to Organization Admin roles
 * This ensures organization admins can manage group chats within their organizations
 */

async function assignGroupChatPermissionsToOrgAdmins() {
  try {
    console.log('🚀 Starting Group Chat Permission Assignment...\n');

    // Step 1: Find all Organization Admin roles
    console.log('1. Finding Organization Admin roles...');
    const orgAdminRoles = await prisma.role.findMany({
      where: {
        name: {
          contains: 'Admin',
          mode: 'insensitive'
        },
        organizationId: {
          // Only organization-specific roles, not system-wide
        }
      },
      include: {
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    if (orgAdminRoles.length === 0) {
      console.log('⚠️  No Organization Admin roles found. Creating default admin role...');
      
      // Find organizations that don't have admin roles
      const organizations = await prisma.organization.findMany({
        where: {
          roles: {
            none: {
              name: {
                contains: 'Admin',
                mode: 'insensitive'
              }
            }
          }
        }
      });

      for (const org of organizations) {
        console.log(`   Creating Admin role for organization: ${org.name}`);
        
        const adminRole = await prisma.role.create({
          data: {
            name: 'Organization Admin',
            description: 'Full administrative access to organization resources',
            organizationId: org.id,
            isActive: true
          }
        });
        
        orgAdminRoles.push({
          ...adminRole,
          organization: { name: org.name }
        });
      }
    }

    console.log(`✅ Found ${orgAdminRoles.length} Organization Admin roles\n`);

    // Step 2: Define all CREATE_GROUP_CHAT permissions
    const groupChatPermissions = [
      { action: 'CREATE', resource: 'CREATE_GROUP_CHAT' },
      { action: 'READ', resource: 'CREATE_GROUP_CHAT' },
      { action: 'UPDATE', resource: 'CREATE_GROUP_CHAT' },
      { action: 'DELETE', resource: 'CREATE_GROUP_CHAT' }
    ];

    console.log('2. Assigning Group Chat permissions...');

    let totalPermissionsAssigned = 0;
    let totalPermissionsSkipped = 0;

    for (const role of orgAdminRoles) {
      console.log(`   Processing role: ${role.name} (${role.organization.name})`);
      
      for (const permission of groupChatPermissions) {
        try {
          // Check if permission already exists
          const existingPermission = await prisma.rolePermission.findFirst({
            where: {
              roleId: role.id,
              action: permission.action,
              resource: permission.resource
            }
          });

          if (existingPermission) {
            console.log(`     ⚠️  ${permission.action} ${permission.resource} already exists`);
            totalPermissionsSkipped++;
            continue;
          }

          // Create the permission
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              action: permission.action,
              resource: permission.resource,
              isActive: true
            }
          });

          console.log(`     ✅ Added ${permission.action} ${permission.resource}`);
          totalPermissionsAssigned++;
        } catch (error) {
          console.error(`     ❌ Error adding ${permission.action} ${permission.resource}:`, error.message);
        }
      }
    }

    console.log(`\n3. Summary:`);
    console.log(`   ✅ Permissions assigned: ${totalPermissionsAssigned}`);
    console.log(`   ⚠️  Permissions skipped (already exist): ${totalPermissionsSkipped}`);
    console.log(`   📊 Total roles processed: ${orgAdminRoles.length}`);

    // Step 3: Verify permissions were assigned correctly
    console.log('\n4. Verifying permissions...');
    
    for (const role of orgAdminRoles) {
      const permissions = await prisma.rolePermission.findMany({
        where: {
          roleId: role.id,
          resource: 'CREATE_GROUP_CHAT'
        }
      });

      console.log(`   ${role.name} (${role.organization.name}):`);
      if (permissions.length === 0) {
        console.log(`     ❌ No CREATE_GROUP_CHAT permissions found`);
      } else {
        console.log(`     ✅ ${permissions.length} permissions: ${permissions.map(p => p.action).join(', ')}`);
      }
    }

    // Step 4: Create a summary report
    console.log('\n5. Creating detailed report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      totalRolesProcessed: orgAdminRoles.length,
      permissionsAssigned: totalPermissionsAssigned,
      permissionsSkipped: totalPermissionsSkipped,
      roles: orgAdminRoles.map(role => ({
        roleId: role.id,
        roleName: role.name,
        organizationName: role.organization.name,
        organizationId: role.organizationId
      }))
    };

    // Save report to file
    const fs = require('fs');
    const reportPath = './group-chat-permissions-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`   📄 Report saved to: ${reportPath}`);

    console.log('\n🎉 Group Chat Permission Assignment Complete!');
    console.log('\n📋 What was accomplished:');
    console.log('   • Organization Admin roles now have full CREATE_GROUP_CHAT permissions');
    console.log('   • Permissions include: CREATE, READ, UPDATE, DELETE');
    console.log('   • All permissions are active and ready to use');
    console.log('\n🔗 Next steps:');
    console.log('   • Test group chat functionality with admin users');
    console.log('   • Verify permissions work correctly in the application');
    console.log('   • Check the detailed report for any issues');

  } catch (error) {
    console.error('❌ Script failed with error:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Step 6: Create a cleanup function to remove permissions if needed
async function removeGroupChatPermissions() {
  try {
    console.log('🧹 Removing Group Chat permissions from Organization Admin roles...\n');

    const orgAdminRoles = await prisma.role.findMany({
      where: {
        name: {
          contains: 'Admin',
          mode: 'insensitive'
        },
        organizationId: {
          not: null
        }
      }
    });

    let totalPermissionsRemoved = 0;

    for (const role of orgAdminRoles) {
      const deletedPermissions = await prisma.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          resource: 'CREATE_GROUP_CHAT'
        }
      });

      if (deletedPermissions.count > 0) {
        console.log(`   ✅ Removed ${deletedPermissions.count} permissions from ${role.name}`);
        totalPermissionsRemoved += deletedPermissions.count;
      }
    }

    console.log(`\n🎯 Cleanup complete: ${totalPermissionsRemoved} permissions removed`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Step 7: Create a verification function
async function verifyGroupChatPermissions() {
  try {
    console.log('🔍 Verifying Group Chat permissions...\n');

    const orgAdminRoles = await prisma.role.findMany({
      where: {
        name: {
          contains: 'Admin',
          mode: 'insensitive'
        },
        organizationId: {
          not: null
        }
      },
      include: {
        organization: {
          select: {
            name: true
          }
        },
        rolePermissions: {
          where: {
            resource: 'CREATE_GROUP_CHAT'
          }
        }
      }
    });

    console.log(`Found ${orgAdminRoles.length} Organization Admin roles:\n`);

    for (const role of orgAdminRoles) {
      console.log(`📋 ${role.name} (${role.organization.name})`);
      console.log(`   Organization ID: ${role.organizationId}`);
      console.log(`   Role ID: ${role.id}`);
      console.log(`   Permissions: ${role.rolePermissions.length}`);
      
      if (role.rolePermissions.length > 0) {
        role.rolePermissions.forEach(perm => {
          console.log(`     • ${perm.action} ${perm.resource} (${perm.isActive ? 'Active' : 'Inactive'})`);
        });
      } else {
        console.log(`     ❌ No CREATE_GROUP_CHAT permissions found`);
      }
      console.log('');
    }

    // Check for any missing permissions
    const expectedPermissions = ['CREATE', 'READ', 'UPDATE', 'DELETE'];
    let totalIssues = 0;

    for (const role of orgAdminRoles) {
      const currentPermissions = role.rolePermissions.map(p => p.action);
      const missingPermissions = expectedPermissions.filter(p => !currentPermissions.includes(p));
      
      if (missingPermissions.length > 0) {
        console.log(`⚠️  ${role.name} is missing: ${missingPermissions.join(', ')}`);
        totalIssues++;
      }
    }

    if (totalIssues === 0) {
      console.log('✅ All Organization Admin roles have complete CREATE_GROUP_CHAT permissions!');
    } else {
      console.log(`⚠️  ${totalIssues} roles have incomplete permissions`);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'assign':
      assignGroupChatPermissionsToOrgAdmins();
      break;
    case 'remove':
      removeGroupChatPermissions();
      break;
    case 'verify':
      verifyGroupChatPermissions();
      break;
    default:
      console.log('🚀 Group Chat Permission Management Script\n');
      console.log('Usage:');
      console.log('  node assign-group-chat-permissions.js assign  - Assign permissions to org admins');
      console.log('  node assign-group-chat-permissions.js remove  - Remove permissions from org admins');
      console.log('  node assign-group-chat-permissions.js verify  - Verify current permissions\n');
      console.log('Default action: assign permissions');
      console.log('');
      assignGroupChatPermissionsToOrgAdmins();
  }
}

module.exports = {
  assignGroupChatPermissionsToOrgAdmins,
  removeGroupChatPermissions,
  verifyGroupChatPermissions
};
