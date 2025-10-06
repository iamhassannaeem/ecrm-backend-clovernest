const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugChatContacts() {
  try {
    console.log('🔍 Debugging Chat Contacts Query...\n');

    // Find the sale agent user to get their organization
    const user = await prisma.user.findUnique({
      where: { email: 'sahil@gmail.com' },
      include: {
        organization: true
      }
    });

    if (!user) {
      console.log('❌ User sahil@gmail.com not found');
      return;
    }

    const organizationId = user.organizationId;
    const userId = user.id;

    console.log(`👤 Current User: ${user.firstName} ${user.lastName} (ID: ${userId})`);
    console.log(`🏢 Organization: ${user.organization?.name} (ID: ${organizationId})\n`);

    // Check all users in the organization
    console.log('👥 All Users in Organization:');
    const allUsers = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true
      },
      include: {
        roles: {
          where: { organizationId }
        }
      },
      orderBy: { firstName: 'asc' }
    });

    allUsers.forEach((u, index) => {
      console.log(`  ${index + 1}. ${u.firstName} ${u.lastName} (ID: ${u.id})`);
      console.log(`     Email: ${u.email}`);
      console.log(`     Active: ${u.isActive}`);
      console.log(`     Roles: ${u.roles.map(r => `${r.name} (isAgent: ${r.isAgent})`).join(', ')}`);
      console.log('');
    });

    // Test the team leads query
    console.log('🎭 Testing Team Leads Query:');
    const teamLeads = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        id: { not: userId },
        roles: {
          some: {
            name: 'TEAM_LEAD',
            organizationId
          }
        }
      },
      include: {
        roles: {
          where: { organizationId }
        }
      }
    });

    console.log(`Found ${teamLeads.length} team leads:`);
    teamLeads.forEach((u, index) => {
      console.log(`  ${index + 1}. ${u.firstName} ${u.lastName} (ID: ${u.id})`);
      console.log(`     Roles: ${u.roles.map(r => r.name).join(', ')}`);
    });

    // Test the agents query
    console.log('\n👨‍💼 Testing Agents Query:');
    const agents = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        id: { not: userId },
        roles: {
          some: {
            isAgent: true,
            organizationId
          }
        }
      },
      include: {
        roles: {
          where: { organizationId }
        }
      }
    });

    console.log(`Found ${agents.length} agents:`);
    agents.forEach((u, index) => {
      console.log(`  ${index + 1}. ${u.firstName} ${u.lastName} (ID: ${u.id})`);
      console.log(`     Roles: ${u.roles.map(r => `${r.name} (isAgent: ${r.isAgent})`).join(', ')}`);
    });

    // Check if there are any TEAM_LEAD roles in the organization
    console.log('\n🏢 Checking TEAM_LEAD Roles:');
    const teamLeadRoles = await prisma.role.findMany({
      where: {
        organizationId,
        name: 'TEAM_LEAD'
      }
    });

    console.log(`Found ${teamLeadRoles.length} TEAM_LEAD roles:`);
    teamLeadRoles.forEach((role, index) => {
      console.log(`  ${index + 1}. ${role.name} (isAgent: ${role.isAgent}, Active: ${role.isActive})`);
    });

    // Check all roles in the organization
    console.log('\n🏢 All Roles in Organization:');
    const allRoles = await prisma.role.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' }
    });

    allRoles.forEach(role => {
      console.log(`  - ${role.name} (isAgent: ${role.isAgent}, Active: ${role.isActive})`);
    });

  } catch (error) {
    console.error('❌ Error debugging chat contacts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugChatContacts(); 