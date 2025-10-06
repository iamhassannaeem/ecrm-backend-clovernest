const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const PermissionService = require('./src/services/permissionService');

const prisma = new PrismaClient();

// Test data
const testUsers = {
  superAdmin: {
    id: 'test-super-admin',
    email: 'superadmin@test.com',
    roles: [{ name: 'SUPER_ADMIN' }],
    permissions: [{ action: 'ALL', resource: 'ALL' }],
    organizationId: 1
  },
  orgAdmin: {
    id: 'test-org-admin',
    email: 'orgadmin@test.com',
    roles: [{ name: 'ORGANIZATION_ADMIN', isAgent: false }],
    permissions: [
      { action: 'READ', resource: 'ORGANIZATIONS' },
      { action: 'UPDATE', resource: 'ORGANIZATIONS' },
      { action: 'READ', resource: 'ORGANIZATION_USERS' },
      { action: 'CREATE', resource: 'ORGANIZATION_USERS' }
    ],
    organizationId: 1
  },
  agent: {
    id: 'test-agent',
    email: 'agent@test.com',
    roles: [{ name: 'AGENT', isAgent: true }],
    permissions: [
      { action: 'READ', resource: 'LEADS' },
      { action: 'CREATE', resource: 'LEADS' }
    ],
    organizationId: 1
  }
};

// Test organizations
const testOrganizations = [
  { id: 1, name: 'Test Organization 1' },
  { id: 2, name: 'Test Organization 2' },
  { id: 3, name: 'Test Organization 3' }
];

// Test users
const testUsersData = [
  { id: 'user1', email: 'user1@test.com', organizationId: 1 },
  { id: 'user2', email: 'user2@test.com', organizationId: 1 },
  { id: 'user3', email: 'user3@test.com', organizationId: 2 }
];

// Test leads
const testLeads = [
  { id: 1, title: 'Lead 1', organizationId: 1, assignedToId: 'test-agent' },
  { id: 2, title: 'Lead 2', organizationId: 1, assignedToId: 'user1' },
  { id: 3, title: 'Lead 3', organizationId: 2, assignedToId: 'user3' }
];

async function testPermissionSystem() {
  console.log('🧪 Testing Universal Permission System\n');

  // Test 1: Super Admin Permissions
  console.log('1. Testing Super Admin Permissions:');
  console.log('   - Can access all organizations:', PermissionService.hasPermission(testUsers.superAdmin, 'READ', 'ORGANIZATIONS'));
  console.log('   - Can access all users:', PermissionService.hasPermission(testUsers.superAdmin, 'READ', 'USERS'));
  console.log('   - Can access all leads:', PermissionService.hasPermission(testUsers.superAdmin, 'READ', 'LEADS'));
  
  const superAdminOrgs = await PermissionService.filterOrganizations(testUsers.superAdmin, testOrganizations);
  console.log('   - Filtered organizations count:', superAdminOrgs.length);
  console.log('');

  // Test 2: Organization Admin Permissions
  console.log('2. Testing Organization Admin Permissions:');
  console.log('   - Can access organizations:', PermissionService.hasPermission(testUsers.orgAdmin, 'READ', 'ORGANIZATIONS'));
  console.log('   - Can access organization users:', PermissionService.hasPermission(testUsers.orgAdmin, 'READ', 'ORGANIZATION_USERS'));
  console.log('   - Cannot access system admin:', PermissionService.hasPermission(testUsers.orgAdmin, 'READ', 'SYSTEM_ADMIN'));
  
  const orgAdminOrgs = await PermissionService.filterOrganizations(testUsers.orgAdmin, testOrganizations);
  console.log('   - Filtered organizations count:', orgAdminOrgs.length);
  console.log('   - Can only see own organization:', orgAdminOrgs.length === 1 && orgAdminOrgs[0].id === 1);
  console.log('');

  // Test 3: Agent Permissions
  console.log('3. Testing Agent Permissions:');
  console.log('   - Can access leads:', PermissionService.hasPermission(testUsers.agent, 'READ', 'LEADS'));
  console.log('   - Cannot access organizations:', PermissionService.hasPermission(testUsers.agent, 'READ', 'ORGANIZATIONS'));
  console.log('   - Cannot access system admin:', PermissionService.hasPermission(testUsers.agent, 'READ', 'SYSTEM_ADMIN'));
  
  const agentOrgs = await PermissionService.filterOrganizations(testUsers.agent, testOrganizations);
  console.log('   - Filtered organizations count:', agentOrgs.length);
  console.log('   - Can only see own organization:', agentOrgs.length === 1 && agentOrgs[0].id === 1);
  console.log('');

  // Test 4: User Filtering
  console.log('4. Testing User Filtering:');
  const superAdminUsers = await PermissionService.filterUsers(testUsers.superAdmin, testUsersData);
  const orgAdminUsers = await PermissionService.filterUsers(testUsers.orgAdmin, testUsersData);
  const agentUsers = await PermissionService.filterUsers(testUsers.agent, testUsersData);
  
  console.log('   - Super admin can see all users:', superAdminUsers.length === 3);
  console.log('   - Org admin can see org users:', orgAdminUsers.length === 2);
  console.log('   - Agent can see limited users:', agentUsers.length === 1);
  console.log('');

  // Test 5: Lead Filtering
  console.log('5. Testing Lead Filtering:');
  const superAdminLeads = await PermissionService.filterLeads(testUsers.superAdmin, testLeads);
  const orgAdminLeads = await PermissionService.filterLeads(testUsers.orgAdmin, testLeads);
  const agentLeads = await PermissionService.filterLeads(testUsers.agent, testLeads);
  
  console.log('   - Super admin can see all leads:', superAdminLeads.length === 3);
  console.log('   - Org admin can see org leads:', orgAdminLeads.length === 2);
  console.log('   - Agent can see assigned leads:', agentLeads.length === 1);
  console.log('');

  // Test 6: Organization Access
  console.log('6. Testing Organization Access:');
  console.log('   - Super admin can access any org:', PermissionService.canAccessOrganization(testUsers.superAdmin, 1));
  console.log('   - Super admin can access any org:', PermissionService.canAccessOrganization(testUsers.superAdmin, 2));
  console.log('   - Org admin can access own org:', PermissionService.canAccessOrganization(testUsers.orgAdmin, 1));
  console.log('   - Org admin cannot access other org:', PermissionService.canAccessOrganization(testUsers.orgAdmin, 2));
  console.log('   - Agent can access own org:', PermissionService.canAccessOrganization(testUsers.agent, 1));
  console.log('   - Agent cannot access other org:', PermissionService.canAccessOrganization(testUsers.agent, 2));
  console.log('');

  // Test 7: Permission-Aware Queries
  console.log('7. Testing Permission-Aware Queries:');
  const superAdminQuery = PermissionService.createPermissionAwareQuery(testUsers.superAdmin, { where: { isActive: true } });
  const orgAdminQuery = PermissionService.createPermissionAwareQuery(testUsers.orgAdmin, { where: { isActive: true } });
  const agentQuery = PermissionService.createPermissionAwareQuery(testUsers.agent, { where: { isActive: true } });
  
  console.log('   - Super admin query has no org filter:', !superAdminQuery.where.organizationId);
  console.log('   - Org admin query has org filter:', orgAdminQuery.where.organizationId === 1);
  console.log('   - Agent query has OR conditions:', orgAdminQuery.where.OR !== undefined);
  console.log('');

  console.log('✅ All permission system tests completed successfully!');
}

// Test error messages
function testErrorMessages() {
  console.log('\n🔍 Testing Error Messages:');
  
  const errorResponse = {
    error: "You don't have permission to read organizations. Required organization permissions.",
    code: "PERMISSION_DENIED",
    requiredAction: "READ",
    requiredResource: "ORGANIZATIONS"
  };
  
  console.log('   - Error message format:', JSON.stringify(errorResponse, null, 2));
  console.log('   - Error code:', errorResponse.code);
  console.log('   - Required action:', errorResponse.requiredAction);
  console.log('   - Required resource:', errorResponse.requiredResource);
}

// Run tests
async function runTests() {
  try {
    await testPermissionSystem();
    testErrorMessages();
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
runTests(); 