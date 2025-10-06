const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function setupSuperAdmin() {
  console.log('🚀 Setting up Super Admin System...');
  console.log('=====================================\n');

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@system.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
  const superAdminFirstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Super';
  const superAdminLastName = process.env.SUPER_ADMIN_LAST_NAME || 'Admin';

  const superOrgDomain = 'elogixit.com';
  const superOrgSlug = 'super-organization';
  const superOrgName = 'Super Organization';

  try {
    // Step 1: Create or get Super Admin User
    console.log('📝 Step 1: Creating Super Admin User...');
    let superAdmin = await prisma.user.findFirst({
      where: {
        email: superAdminEmail
      }
    });

    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash(superAdminPassword, 12);
      superAdmin = await prisma.user.create({
        data: {
          email: superAdminEmail,
          password: hashedPassword,
          firstName: superAdminFirstName,
          lastName: superAdminLastName,
          isActive: true,
        }
      });
      console.log('✅ Super admin user created successfully!');
      console.log(`   Email: ${superAdmin.email}`);
      console.log(`   ID: ${superAdmin.id}`);
      console.log(`   Password: ${superAdminPassword}`);
      console.log('⚠️  Please change the super admin password after first login!');
    } else {
      console.log('✅ Super admin user already exists');
      console.log(`   Email: ${superAdmin.email}`);
      console.log(`   ID: ${superAdmin.id}`);
    }

    // Step 2: Create or get Super Organization
    console.log('\n📝 Step 2: Creating Super Organization...');
    let superOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { domain: superOrgDomain },
          { slug: superOrgSlug }
        ]
      }
    });

    if (!superOrg) {
      superOrg = await prisma.organization.create({
        data: {
          name: superOrgName,
          slug: superOrgSlug,
          domain: superOrgDomain,
          description: 'The super organization for platform-level administration',
          createdById: superAdmin.id
        }
      });
      console.log('✅ Super organization created successfully!');
      console.log(`   Name: ${superOrg.name}`);
      console.log(`   Domain: ${superOrg.domain}`);
      console.log(`   ID: ${superOrg.id}`);
    } else {
      console.log('✅ Super organization already exists');
      console.log(`   Name: ${superOrg.name}`);
      console.log(`   Domain: ${superOrg.domain}`);
      console.log(`   ID: ${superOrg.id}`);
    }

    // Step 3: Update Super Admin User to belong to Super Organization
    console.log('\n📝 Step 3: Assigning Super Admin to Super Organization...');
    if (superAdmin.organizationId !== superOrg.id) {
      await prisma.user.update({
        where: { id: superAdmin.id },
        data: { organizationId: superOrg.id }
      });
      console.log('✅ Super admin user assigned to super organization');
    } else {
      console.log('✅ Super admin user already belongs to super organization');
    }

    // Step 4: Create or get Super Admin Role for the Super Organization
    console.log('\n📝 Step 4: Creating Super Admin Role...');
    let superAdminRole = await prisma.role.findFirst({
      where: {
        name: 'Super Admin',
        organizationId: superOrg.id
      }
    });

    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          name: 'Super Admin',
          description: 'Full access to all features and settings in the super organization',
          organizationId: superOrg.id
        }
      });
      console.log('✅ Super Admin role created for super organization');
    } else {
      console.log('✅ Super Admin role already exists for super organization');
    }

    // Step 5: Assign all permissions to the Super Admin Role
    console.log('\n📝 Step 5: Assigning all permissions to Super Admin Role...');
    
    // Define all available permissions based on actual schema
    const allPermissions = [
      // Organization-level permissions
      { action: 'CREATE', resource: 'ORGANIZATION_SETTINGS' },
      { action: 'READ', resource: 'ORGANIZATION_SETTINGS' },
      { action: 'UPDATE', resource: 'ORGANIZATION_SETTINGS' },
      { action: 'DELETE', resource: 'ORGANIZATION_SETTINGS' },

      { action: 'CREATE', resource: 'SYSTEM_PREFERENCES' },
      { action: 'READ', resource: 'SYSTEM_PREFERENCES' },
      { action: 'UPDATE', resource: 'SYSTEM_PREFERENCES' },
      { action: 'DELETE', resource: 'SYSTEM_PREFERENCES' },

      { action: 'CREATE', resource: 'USER_MANAGEMENT' },
      { action: 'READ', resource: 'USER_MANAGEMENT' },
      { action: 'UPDATE', resource: 'USER_MANAGEMENT' },
      { action: 'DELETE', resource: 'USER_MANAGEMENT' },

      { action: 'CREATE', resource: 'USER_ROLES' },
      { action: 'READ', resource: 'USER_ROLES' },
      { action: 'UPDATE', resource: 'USER_ROLES' },
      { action: 'DELETE', resource: 'USER_ROLES' },

      { action: 'CREATE', resource: 'ORGANIZATION_USERS' },
      { action: 'READ', resource: 'ORGANIZATION_USERS' },
      { action: 'UPDATE', resource: 'ORGANIZATION_USERS' },
      { action: 'DELETE', resource: 'ORGANIZATION_USERS' },

      // Lead form permissions
      { action: 'CREATE', resource: 'LEAD_FORM' },
      { action: 'READ', resource: 'LEAD_FORM' },
      { action: 'UPDATE', resource: 'LEAD_FORM' },
      { action: 'DELETE', resource: 'LEAD_FORM' },
      { action: 'POST', resource: 'LEAD_FORM' },
      { action: 'MANAGE', resource: 'LEAD_FORM' },

      { action: 'CREATE', resource: 'FORM_CUSTOMIZATION' },
      { action: 'READ', resource: 'FORM_CUSTOMIZATION' },
      { action: 'UPDATE', resource: 'FORM_CUSTOMIZATION' },
      { action: 'DELETE', resource: 'FORM_CUSTOMIZATION' },
      { action: 'MANAGE', resource: 'FORM_CUSTOMIZATION' },

      { action: 'CREATE', resource: 'FIELD_TYPE_CONFIGURATION' },
      { action: 'READ', resource: 'FIELD_TYPE_CONFIGURATION' },
      { action: 'UPDATE', resource: 'FIELD_TYPE_CONFIGURATION' },
      { action: 'DELETE', resource: 'FIELD_TYPE_CONFIGURATION' },
      { action: 'MANAGE', resource: 'FIELD_TYPE_CONFIGURATION' },

      { action: 'CREATE', resource: 'LEAD_FORM_CUSTOMER_INFO' },
      { action: 'READ', resource: 'LEAD_FORM_CUSTOMER_INFO' },
      { action: 'UPDATE', resource: 'LEAD_FORM_CUSTOMER_INFO' },
      { action: 'DELETE', resource: 'LEAD_FORM_CUSTOMER_INFO' },
      { action: 'MANAGE', resource: 'LEAD_FORM_CUSTOMER_INFO' },

      { action: 'CREATE', resource: 'LEAD_FORM_ADDRESS' },
      { action: 'READ', resource: 'LEAD_FORM_ADDRESS' },
      { action: 'UPDATE', resource: 'LEAD_FORM_ADDRESS' },
      { action: 'DELETE', resource: 'LEAD_FORM_ADDRESS' },
      { action: 'MANAGE', resource: 'LEAD_FORM_ADDRESS' },

      { action: 'CREATE', resource: 'LEAD_FORM_SERVICE' },
      { action: 'READ', resource: 'LEAD_FORM_SERVICE' },
      { action: 'UPDATE', resource: 'LEAD_FORM_SERVICE' },
      { action: 'DELETE', resource: 'LEAD_FORM_SERVICE' },
      { action: 'MANAGE', resource: 'LEAD_FORM_SERVICE' },

      { action: 'CREATE', resource: 'LEAD_FORM_PAYMENT' },
      { action: 'READ', resource: 'LEAD_FORM_PAYMENT' },
      { action: 'UPDATE', resource: 'LEAD_FORM_PAYMENT' },
      { action: 'DELETE', resource: 'LEAD_FORM_PAYMENT' },
      { action: 'MANAGE', resource: 'LEAD_FORM_PAYMENT' },

      { action: 'CREATE', resource: 'LEAD_FORM_SECURITY' },
      { action: 'READ', resource: 'LEAD_FORM_SECURITY' },
      { action: 'UPDATE', resource: 'LEAD_FORM_SECURITY' },
      { action: 'DELETE', resource: 'LEAD_FORM_SECURITY' },
      { action: 'MANAGE', resource: 'LEAD_FORM_SECURITY' },

      { action: 'CREATE', resource: 'LEAD_FORM_ORDER' },
      { action: 'READ', resource: 'LEAD_FORM_ORDER' },
      { action: 'UPDATE', resource: 'LEAD_FORM_ORDER' },
      { action: 'DELETE', resource: 'LEAD_FORM_ORDER' },
      { action: 'MANAGE', resource: 'LEAD_FORM_ORDER' },

      { action: 'CREATE', resource: 'LEAD_FORM_INSTALLATION' },
      { action: 'READ', resource: 'LEAD_FORM_INSTALLATION' },
      { action: 'UPDATE', resource: 'LEAD_FORM_INSTALLATION' },
      { action: 'DELETE', resource: 'LEAD_FORM_INSTALLATION' },
      { action: 'MANAGE', resource: 'LEAD_FORM_INSTALLATION' },

      { action: 'CREATE', resource: 'LEAD_FORM_FOLLOW_UP' },
      { action: 'READ', resource: 'LEAD_FORM_FOLLOW_UP' },
      { action: 'UPDATE', resource: 'LEAD_FORM_FOLLOW_UP' },
      { action: 'DELETE', resource: 'LEAD_FORM_FOLLOW_UP' },
      { action: 'MANAGE', resource: 'LEAD_FORM_FOLLOW_UP' },

      { action: 'CREATE', resource: 'LEAD_FORM_WON' },
      { action: 'READ', resource: 'LEAD_FORM_WON' },
      { action: 'UPDATE', resource: 'LEAD_FORM_WON' },
      { action: 'DELETE', resource: 'LEAD_FORM_WON' },
      { action: 'MANAGE', resource: 'LEAD_FORM_WON' },

      { action: 'CREATE', resource: 'LEAD_FORM_CLOSE' },
      { action: 'READ', resource: 'LEAD_FORM_CLOSE' },
      { action: 'UPDATE', resource: 'LEAD_FORM_CLOSE' },
      { action: 'DELETE', resource: 'LEAD_FORM_CLOSE' },
      { action: 'MANAGE', resource: 'LEAD_FORM_CLOSE' },

      // Sales and Management Reports
      { action: 'CREATE', resource: 'SALES_REPORT' },
      { action: 'READ', resource: 'SALES_REPORT' },
      { action: 'UPDATE', resource: 'SALES_REPORT' },
      { action: 'DELETE', resource: 'SALES_REPORT' },
      { action: 'MANAGE', resource: 'SALES_REPORT' },

      { action: 'CREATE', resource: 'MANAGEMENT_REPORT' },
      { action: 'READ', resource: 'MANAGEMENT_REPORT' },
      { action: 'UPDATE', resource: 'MANAGEMENT_REPORT' },
      { action: 'DELETE', resource: 'MANAGEMENT_REPORT' },
      { action: 'MANAGE', resource: 'MANAGEMENT_REPORT' },

      // Chat permissions
      { action: 'CHAT', resource: 'AGENT_TO_AGENT_CHAT' },
      { action: 'CHAT', resource: 'AGENT_TO_TEAM_LEAD_CHAT' },
      { action: 'CHAT', resource: 'TEAM_LEAD_ALL_CHAT' },

      // Group chat permissions - CRUD operations
      { action: 'CREATE', resource: 'CREATE_GROUP_CHAT' },
      { action: 'READ', resource: 'CREATE_GROUP_CHAT' },
      { action: 'UPDATE', resource: 'CREATE_GROUP_CHAT' },
      { action: 'DELETE', resource: 'CREATE_GROUP_CHAT' },
      { action: 'MANAGE', resource: 'CREATE_GROUP_CHAT' },

      // Other permissions
      { action: 'CREATE', resource: 'CALL_HISTORY' },
      { action: 'READ', resource: 'CALL_HISTORY' },
      { action: 'UPDATE', resource: 'CALL_HISTORY' },
      { action: 'DELETE', resource: 'CALL_HISTORY' },
      { action: 'MANAGE', resource: 'CALL_HISTORY' },

      { action: 'CREATE', resource: 'PROFILE' },
      { action: 'READ', resource: 'PROFILE' },
      { action: 'UPDATE', resource: 'PROFILE' },
      { action: 'DELETE', resource: 'PROFILE' },
      { action: 'MANAGE', resource: 'PROFILE' },
    ];

    // Map permissions to include roleId and organizationId
    const permissionsToAssign = allPermissions.map(permission => ({
      ...permission,
      roleId: superAdminRole.id,
      organizationId: superOrg.id
    }));

    // Clear existing permissions and assign new ones
    await prisma.rolePermission.deleteMany({ 
      where: { roleId: superAdminRole.id } 
    });
    
    await prisma.rolePermission.createMany({
      data: permissionsToAssign,
      skipDuplicates: true,
    });
    
    console.log(`✅ Assigned ${permissionsToAssign.length} permissions to Super Admin Role`);

    // Step 6: Assign the Super Admin Role to the Super Admin User
    console.log('\n📝 Step 6: Assigning Super Admin Role to User...');
    
    // Connect the user to the role using Prisma's many-to-many relationship
    await prisma.role.update({
      where: { id: superAdminRole.id },
      data: {
        users: {
          connect: { id: superAdmin.id }
        }
      }
    });
    console.log('✅ Super Admin role assigned to user');

    console.log('\n===== SUPER ADMIN SETUP DETAILS =====');
    console.log('Super Admin User:');
    console.log(`  ID: ${superAdmin.id}`);
    console.log(`  Email: ${superAdmin.email}`);
    console.log(`  Name: ${superAdminFirstName} ${superAdminLastName}`);
    console.log(`  Organization ID: ${superAdmin.organizationId}`);
    console.log('');
    console.log('Super Organization:');
    console.log(`  ID: ${superOrg.id}`);
    console.log(`  Name: ${superOrg.name}`);
    console.log(`  Domain: ${superOrg.domain}`);
    console.log(`  Slug: ${superOrg.slug}`);
    console.log(`  Created By: ${superOrg.createdById}`);
    console.log('');
    console.log('Super Admin Role (Organization Role):');
    console.log(`  ID: ${superAdminRole.id}`);
    console.log(`  Name: ${superAdminRole.name}`);
    console.log(`  Description: ${superAdminRole.description}`);
    console.log(`  isActive: ${superAdminRole.isActive}`);
    console.log(`  Organization ID: ${superAdminRole.organizationId}`);
    console.log('=====================================\n');

    console.log('🎉 Super Admin setup completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Login with the super admin credentials');
    console.log('2. Change the default password');
    console.log('3. Create additional organizations and users as needed');
    console.log('4. Configure system settings and preferences');

  } catch (error) {
    console.error('❌ Super admin setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupSuperAdmin()
    .then(() => {
      console.log('✅ Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupSuperAdmin };