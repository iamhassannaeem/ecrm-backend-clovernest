const { prisma } = require('../config/database');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');


    const ALL_PERMISSION_ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE', 'CHAT', 'POST'];
const ALL_PERMISSION_RESOURCES = [
  'ORGANIZATION_SETTINGS',
  'SYSTEM_PREFERENCES',
  'USER_MANAGEMENT',
  'USER_ROLES',
  'ORGANIZATION_USERS',
  'LEAD_FORM',
  'FORM_CUSTOMIZATION',
  'FIELD_TYPE_CONFIGURATION',
  'AGENT_TO_AGENT_CHAT',
  'AGENT_TO_TEAM_LEAD_CHAT',
  'CALL_HISTORY',
  'PROFILE',
  'TEAM_LEAD_ALL_CHAT',
  'LEAD_FORM_CUSTOMER_INFO',
  'LEAD_FORM_ADDRESS',
  'LEAD_FORM_SERVICE',
  'LEAD_FORM_PAYMENT',
  'LEAD_FORM_SECURITY',
  'LEAD_FORM_ORDER',
  'LEAD_FORM_INSTALLATION',
  'LEAD_FORM_FOLLOW_UP',
  'LEAD_FORM_WON',
  'LEAD_FORM_CLOSE',
  'CREATE_GROUP_CHAT',
  'SALES_REPORT',
  'MANAGEMENT_REPORT'
];

function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) return false;
  for (const perm of permissions) {
    if (
      !ALL_PERMISSION_ACTIONS.includes(perm.action) ||
      !ALL_PERMISSION_RESOURCES.includes(perm.resource)
    ) {
      return false;
    }
  }
  return true;
}


exports.getAllPossiblePermissions = (req, res) => {
  const permissions = [];
  for (const resource of ALL_PERMISSION_RESOURCES) {
    for (const action of ALL_PERMISSION_ACTIONS) {
      permissions.push({ action, resource });
    }
  }
  res.json({ permissions });
};

exports.createRole = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { name, description, permissions, isAgent } = req.body;
    const { organizationId } = req.params;
    
 
    if (name === 'ORGANIZATION_ADMIN') {
      return res.status(403).json({ 
        error: 'Cannot create ORGANIZATION_ADMIN role', 
        message: 'The ORGANIZATION_ADMIN role is automatically created and cannot be manually created.' 
      });
    }

    if (!/^[A-Z_]+$/.test(name)) {
      return res.status(400).json({ error: 'Role name must be uppercase and use underscores only (e.g., TEAM_LEAD)' });
    }
    if (permissions && !validatePermissions(permissions)) {
      return res.status(400).json({ error: 'Invalid permissions in payload' });
    }
    const existingRole = await prisma.role.findFirst({ where: { organizationId: Number(organizationId), name: { equals: name, mode: 'insensitive' } } });
    if (existingRole) {
      return res.status(400).json({ error: 'Role with this name already exists in this organization' });
    }

    let updatedPermissions = permissions ? [...permissions] : [];
 
    updatedPermissions = updatedPermissions.filter(
      perm =>
        (perm.resource !== 'AGENT_TO_AGENT_CHAT' && perm.resource !== 'AGENT_TO_TEAM_LEAD_CHAT') ||
        (perm.action === 'CHAT')
    );

    if (!updatedPermissions.some(perm => perm.resource === 'AGENT_TO_AGENT_CHAT' && perm.action === 'CHAT')) {
      
    }
    
    if (!updatedPermissions.some(perm => perm.resource === 'AGENT_TO_TEAM_LEAD_CHAT' && perm.action === 'CHAT')) {
      updatedPermissions.push({ action: 'CHAT', resource: 'AGENT_TO_TEAM_LEAD_CHAT' });
    }
    
    updatedPermissions = updatedPermissions.filter(perm => perm.resource !== 'LEAD_FORM_POSTING');
    const result = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name,
          description,
          organizationId: Number(organizationId),
          isAgent: typeof isAgent === 'boolean' ? isAgent : false,
          rolePermissions: {
            create: updatedPermissions.map(perm => ({
              action: perm.action,
              resource: perm.resource,
              organizationId: Number(organizationId) 
            }))
          }
        },
        include: { rolePermissions: true }
      });
      return role;
    });
  
    const organization = await prisma.organization.findUnique({
      where: { id: Number(organizationId) },
      include: {
        roles: {
          include: { rolePermissions: true }
        }
      }
    });
    await req.createAuditLog({ action: AUDIT_ACTIONS.CREATE_ROLE, resource: AUDIT_RESOURCES.ROLE, resourceId: result.id, newValues: { name: result.name, description: result.description, permissionsCount: result.rolePermissions.length }, organizationId: Number(organizationId) });
    res.status(201).json({ message: 'Role created successfully', role: result, organization });
  } catch (error) {
    next(error);
  }
};

exports.getRoles = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    console.log('getRoles called for org:', organizationId, 'by user:', req.user?.id, 'role:', req.user?.systemRole);
   
    const org = await prisma.organization.findUnique({ where: { id: Number(organizationId) } });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const roles = await prisma.role.findMany({
      where: { organizationId: Number(organizationId) },
      include: {
        rolePermissions: true,
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ roles });
  } catch (error) {
    next(error);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { name, description, isActive, isAgent, permissions } = req.body; // Add isAgent here
    const { organizationId, roleId } = req.params;
    const existingRole = await prisma.role.findFirst({ where: { id: Number(roleId), organizationId: Number(organizationId) } });
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    const highestPrivilegeRole = req.user.roles.reduce((highest, current) => {
      if (current.isSystem) {
        return current;
      }
      return highest;
    }, null);

    if (highestPrivilegeRole && highestPrivilegeRole.isSystem) {
      return res.status(403).json({ error: 'System roles cannot be modified' });
    }
    
   
    if (existingRole.name === 'ORGANIZATION_ADMIN' && name && name !== 'ORGANIZATION_ADMIN') {
      return res.status(403).json({ 
        error: 'Cannot modify ORGANIZATION_ADMIN role name', 
        message: 'The ORGANIZATION_ADMIN role name cannot be changed as it is essential for organization management.' 
      });
    }
    
    if (name && name !== existingRole.name) {
      const nameConflict = await prisma.role.findFirst({ where: { organizationId: Number(organizationId), name: { equals: name, mode: 'insensitive' }, id: { not: Number(roleId) } } });
      if (nameConflict) {
        return res.status(400).json({ error: 'Role with this name already exists in this organization' });
      }
    }
    if (permissions && !validatePermissions(permissions)) {
      return res.status(400).json({ error: 'Invalid permissions in payload' });
    }
   
    let updatedPermissions = permissions ? [...permissions] : [];
   
    updatedPermissions = updatedPermissions.filter(
      perm =>
        (perm.resource !== 'AGENT_TO_AGENT_CHAT' && perm.resource !== 'AGENT_TO_TEAM_LEAD_CHAT') ||
        (perm.action === 'CHAT')
    );
  
    if (!updatedPermissions.some(perm => perm.resource === 'AGENT_TO_AGENT_CHAT' && perm.action === 'CHAT')) {
    
    }
   
    if (!updatedPermissions.some(perm => perm.resource === 'AGENT_TO_TEAM_LEAD_CHAT' && perm.action === 'CHAT')) {
      updatedPermissions.push({ action: 'CHAT', resource: 'AGENT_TO_TEAM_LEAD_CHAT' });
    }
   
    updatedPermissions = updatedPermissions.filter(perm => perm.resource !== 'LEAD_FORM_POSTING');
    const result = await prisma.$transaction(async (tx) => {
      const updatedRole = await tx.role.update({
        where: { id: Number(roleId) },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
          ...(isAgent !== undefined && { isAgent })
        }
      });
     
      const validResources = ALL_PERMISSION_RESOURCES;
      let filteredPermissions = updatedPermissions;
      if (updatedPermissions) {
        filteredPermissions = updatedPermissions.filter(perm => validResources.includes(perm.resource));
      }
      if (filteredPermissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: Number(roleId) } });
        if (filteredPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: filteredPermissions.map(perm => ({
              roleId: Number(roleId),
              action: perm.action,
              resource: perm.resource,
              organizationId: Number(organizationId) 
            }))
          });
        }
      }
      return await tx.role.findUnique({ where: { id: Number(roleId) }, include: { rolePermissions: true } });
    });
    await req.createAuditLog({ action: AUDIT_ACTIONS.UPDATE_ROLE, resource: AUDIT_RESOURCES.ROLE, resourceId: result.id, oldValues: { name: existingRole.name, description: existingRole.description, isActive: existingRole.isActive }, newValues: { name: result.name, description: result.description, isActive: result.isActive, permissionsCount: result.rolePermissions.length }, organizationId: Number(organizationId) });
    res.json({ message: 'Role updated successfully', role: result });
  } catch (error) {
    next(error);
  }
};

exports.deleteRole = async (req, res, next) => {
  try {
    const { organizationId, roleId } = req.params;
    const existingRole = await prisma.role.findFirst({ where: { id: Number(roleId), organizationId: Number(organizationId) }, include: { users: true } });
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    
    if (existingRole.name === 'ORGANIZATION_ADMIN') {
      return res.status(403).json({ 
        error: 'Cannot delete ORGANIZATION_ADMIN role', 
        message: 'The ORGANIZATION_ADMIN role cannot be deleted as it is essential for organization management.' 
      });
    }
    
 
    const highestPrivilegeRole = req.user.roles.reduce((highest, current) => {
      if (current.isSystem) {
        return current;
      }
      return highest;
    }, null);

    if (highestPrivilegeRole && highestPrivilegeRole.isSystem) {
      return res.status(403).json({ error: 'System roles cannot be deleted' });
    }
    if (existingRole.users.length > 0) {
      return res.status(400).json({ error: 'Cannot delete role that is assigned to users. Please reassign users first.' });
    }
    await prisma.role.delete({ where: { id: Number(roleId) } });
    await req.createAuditLog({ action: AUDIT_ACTIONS.DELETE_ROLE, resource: AUDIT_RESOURCES.ROLE, resourceId: Number(roleId), oldValues: { name: existingRole.name, description: existingRole.description }, organizationId: Number(organizationId) });
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.assignRole = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { userIds } = req.body;
    const { organizationId, roleId } = req.params;
    const existingRole = await prisma.role.findFirst({ where: { id: Number(roleId), organizationId: Number(organizationId) } });
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    const result = await prisma.$transaction(async (tx) => {
      const assignments = [];
      for (const userId of userIds) {
        const orgUser = await tx.organizationUser.findUnique({ where: { userId_organizationId: { userId: Number(userId), organizationId: Number(organizationId) } } });
        if (!orgUser) {
          throw new Error(`User ${userId} is not a member of this organization`);
        }
        const updatedUser = await tx.organizationUser.update({ where: { userId_organizationId: { userId: Number(userId), organizationId: Number(organizationId) } }, data: { roleId: Number(roleId) } });
        assignments.push(updatedUser);
      }
      return assignments;
    });
    await req.createAuditLog({ action: AUDIT_ACTIONS.ASSIGN_ROLE, resource: AUDIT_RESOURCES.ROLE, resourceId: Number(roleId), newValues: { roleName: existingRole.name, assignedUserIds: userIds }, organizationId: Number(organizationId) });
    res.json({ message: 'Role assigned successfully', assignments: result });
  } catch (error) {
    if (error.message.includes('is not a member of this organization')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

exports.getRoleById = async (req, res, next) => {
  try {
    const { organizationId, roleId } = req.params;
    const role = await prisma.role.findFirst({
      where: { id: Number(roleId), organizationId: Number(organizationId) },
      include: {
        rolePermissions: true,
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ role });
  } catch (error) {
    next(error);
  }
};

exports.getAllNonAgentRoles = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
   
    if (!organizationId || isNaN(Number(organizationId))) {
      return res.status(400).json({ 
        error: 'Invalid organization ID. Please provide a valid numeric organization ID.',
        receivedValue: organizationId,
        example: 'Use /api/organizations/13/roles/non-agents instead of /api/organizations/{organizationId}/roles/non-agents'
      });
    }
    
    const org = await prisma.organization.findUnique({ 
      where: { id: Number(organizationId) } 
    });
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

  
    const roles = await prisma.role.findMany({
      where: { 
        organizationId: Number(organizationId),
        isAgent: false 
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        rolePermissions: {
          select: {
            action: true,
            resource: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      message: 'Non-agent roles retrieved successfully',
      roles 
    });
  } catch (error) {
    next(error);
  }
}; 