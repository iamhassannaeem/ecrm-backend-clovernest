const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function wipeDatabase() {
  // Order matters due to foreign key constraints
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatParticipant.deleteMany();
  await prisma.chatSession.deleteMany();
}

async function main() {
  await wipeDatabase();

  // --- Super Admin/Org/Role/Permissions Setup ---
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@system.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
  const superAdminFirstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Super';
  const superAdminLastName = process.env.SUPER_ADMIN_LAST_NAME || 'Admin';
  const superOrgName = 'Super Organization';
  const superOrgDomain = 'elogixit.com';
  const superOrgSlug = 'super-organization';

  // 1. Create Super Admin User
  const hashedPassword = await bcrypt.hash(superAdminPassword, 12);
  const superAdmin = await prisma.user.create({
    data: {
      email: superAdminEmail,
      password: hashedPassword,
      firstName: superAdminFirstName,
      lastName: superAdminLastName,
      isActive: true
    }
  });
  console.log(`Super admin created: email=${superAdmin.email}, id=${superAdmin.id}`);

  // 2. Create Super Organization with createdById set to superAdmin.id
  const superOrg = await prisma.organization.create({
    data: {
      name: superOrgName,
      slug: superOrgSlug,
      domain: superOrgDomain,
      description: 'The root organization for platform super admin',
      createdById: superAdmin.id
    }
  });

  // 3. Create Super Admin Role in Super Organization
  const superAdminRole = await prisma.role.create({
    data: {
      name: 'SUPER_ADMIN',
      description: 'Full access to all features and settings in the super organization',
      isActive: true,
      organizationId: superOrg.id
    }
  });

  // 4. Assign super admin to SUPER_ADMIN role (add to users[] on Role and to users[] on Organization)
  // This is handled by the relations in the schema, so no join table is needed.
  // Optionally, you can update the user to connect to the organization and role if needed.
  await prisma.user.update({
    where: { id: superAdmin.id },
    data: {
      organizationId: superOrg.id,
      roles: {
        connect: { id: superAdminRole.id }
      }
    }
  });

  // 5. Create organization-level permissions for the Super Organization
  const orgPermissions = [
    { action: 'MANAGE', resource: 'ORGANIZATION_SETTINGS' },
    { action: 'CREATE', resource: 'USER_MANAGEMENT' },
    { action: 'READ', resource: 'USER_MANAGEMENT' },
    { action: 'UPDATE', resource: 'USER_MANAGEMENT' },
    { action: 'DELETE', resource: 'USER_MANAGEMENT' },
    { action: 'MANAGE', resource: 'USER_MANAGEMENT' },
    { action: 'MANAGE', resource: 'USER_ROLES' },
    { action: 'MANAGE', resource: 'FORM_CUSTOMIZATION' },
    { action: 'MANAGE', resource: 'FIELD_TYPE_CONFIGURATION' },
    { action: 'READ', resource: 'CALL_HISTORY' },
    { action: 'MANAGE', resource: 'PROFILE' },
    { action: 'CHAT', resource: 'AGENT_TO_AGENT_CHAT' },
    { action: 'CHAT', resource: 'AGENT_TO_TEAM_LEAD_CHAT' },
    { action: 'CHAT', resource: 'TEAM_LEAD_ALL_CHAT' },
  ];

  for (const perm of orgPermissions) {
    await prisma.rolePermission.create({
      data: {
        action: perm.action,
        resource: perm.resource,
        roleId: superAdminRole.id,
        organizationId: superOrg.id
      }
    });
  }

  console.log('\n🎉 Database reset and super admin seeded!');
}

main()
  .catch((e) => {
    console.error('Error during super admin creation:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
