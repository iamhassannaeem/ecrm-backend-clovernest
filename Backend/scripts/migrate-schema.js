#!/usr/bin/env node

/**
 * Schema Migration Script
 * 
 * This script handles the migration from the old schema to the new schema
 * for the updated organization flow.
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function migrateSchema() {
  console.log('🔄 Starting schema migration...');
  console.log('============================\n');

  try {
    // Check if migration is needed
    const organizations = await prisma.organization.findMany({
      include: {
        admin: true
      }
    });

    console.log(`Found ${organizations.length} organizations to migrate`);

    for (const org of organizations) {
      console.log(`\n📝 Migrating organization: ${org.name}`);

      // If organization doesn't have an admin, create one
      if (!org.admin) {
        console.log('  - Creating organization admin...');
        
        // Create admin user
        const adminEmail = `admin@${org.domain}`;
        const adminPassword = 'Admin123!'; // This should be changed by the admin
        
        const admin = await prisma.user.create({
          data: {
            email: adminEmail,
            password: adminPassword, // In production, this should be hashed
            firstName: 'Organization',
            lastName: 'Admin',
            emailVerified: true,
            emailVerifiedAt: new Date(),
            isActive: true,
            systemRole: 'ORGANIZATION_ADMIN'
          }
        });

        // Update organization with admin
        await prisma.organization.update({
          where: { id: org.id },
          data: { adminId: admin.id }
        });

        // Add admin to organization
        await prisma.organization_users.create({
          data: {
            id: `org_user_${admin.id}_${org.id}`,
            userId: admin.id,
            organizationId: org.id,
            role: 'ORGANIZATION_ADMIN'
          }
        });

        console.log(`  ✅ Created admin: ${admin.email}`);
        console.log(`  🔑 Admin password: ${adminPassword}`);
      } else {
        console.log(`  ✅ Admin already exists: ${org.admin.email}`);
      }

      // Ensure default roles exist
      const existingRoles = await prisma.role.findMany({
        where: { organizationId: org.id }
      });

      if (existingRoles.length === 0) {
        console.log('  - Creating default roles...');
        
        const defaultRoles = [
          {
            name: 'Organization Admin',
            description: 'Full access to organization settings and user management',
            isSystem: true,
            organizationId: org.id
          },
          {
            name: 'User',
            description: 'Standard user with basic access',
            isSystem: true,
            organizationId: org.id
          }
        ];

        for (const roleData of defaultRoles) {
          await prisma.role.create({
            data: roleData
          });
        }

        console.log('  ✅ Created default roles');
      } else {
        console.log(`  ✅ Roles already exist (${existingRoles.length} roles)`);
      }
    }

    console.log('\n🎉 Schema migration completed successfully!');
    console.log('\n📋 Migration Summary:');
    console.log(`- Organizations processed: ${organizations.length}`);
    console.log(`- Total users: ${await prisma.user.count()}`);
    console.log(`- Total roles: ${await prisma.role.count()}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  migrateSchema()
    .then(() => {
      console.log('\n🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { migrateSchema }; 