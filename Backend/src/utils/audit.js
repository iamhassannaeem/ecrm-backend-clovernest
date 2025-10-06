const { prisma } = require('../config/database');

/**
 * Enhanced audit logging utility with organization and role context
 * Ensures all actions include proper organization and role information
 */

/**
 * Create an audit log entry with enhanced context
 * @param {Object} params -   
 * @param {string} params.action  
 * @param {string} params.resource  
 * @param {string} params.resourceId  
 * @param {Object} params.oldValues   
 * @param {Object} params.newValues 
 * @param {Object} params.user 
 * @param {string} params.organizationId 
 * @param {string} params.ipAddress 
 * @param {string} params.userAgent 
 * @param {Object} params.orgUser 
 * @returns {Promise<Object>}   
 */
async function createAuditLog({
  action,
  resource,
  resourceId = null,
  oldValues = null,
  newValues = null,
  user,
  organizationId = null,
  ipAddress = null,
  userAgent = null,
  orgUser = null
}) {
  if (!action || typeof action !== 'string' || !action.trim()) {
    console.error('Audit log error: action is missing or invalid:', action);
    throw new Error('Audit log action is required and must be a non-empty string');
  }
  try {
    // Determine user role context
    let role = null;
    if (user.roles && user.roles.length > 0) {
      // Prioritize SUPER_ADMIN > ORGANIZATION_ADMIN > USER
      if (user.roles.some(r => r.name === 'Super Admin' || r.name === 'SUPER_ADMIN')) role = 'SUPER_ADMIN';
      else if (user.roles.some(r => r.name === 'ORGANIZATION_ADMIN')) role = 'ORGANIZATION_ADMIN';
      else role = user.roles[0].name;
    }

    // Create audit log entry
    const auditLog = await prisma.auditLog.create({
      data: {
        action,
        resource,
        resourceId,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
        userRole: role,
        userId: user?.id || null,
        organizationId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
}

/**
 * Express middleware to extract audit context from request
 * Adds audit helper function to req object
 */
function auditMiddleware(req, res, next) {
  // Helper function to create audit log with request context
  req.createAuditLog = async (params) => {
    return createAuditLog({
      ...params,
      user: req.user,
      organizationId: params.organizationId || req.organizationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      orgUser: req.orgUser
    });
  };

  next();
}

/**
 * Audit log action constants for consistency
 */
const AUDIT_ACTIONS = {
  // User actions
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  ACTIVATE_USER: 'ACTIVATE_USER',
  DEACTIVATE_USER: 'DEACTIVATE_USER',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',

  // Organization actions
  CREATE_ORGANIZATION: 'CREATE_ORGANIZATION',
  UPDATE_ORGANIZATION: 'UPDATE_ORGANIZATION',
  DELETE_ORGANIZATION: 'DELETE_ORGANIZATION',
  UPDATE_ORGANIZATION_STATUS: 'UPDATE_ORGANIZATION_STATUS',

  // Organization user actions
  ADD_USER: 'ADD_USER',
  REMOVE_USER: 'REMOVE_USER',
  UPDATE_USER_ROLE: 'UPDATE_USER_ROLE',
  ACTIVATE_USER: 'ACTIVATE_USER',
  DEACTIVATE_USER: 'DEACTIVATE_USER',

  // Role actions
  CREATE_ROLE: 'CREATE_ROLE',
  UPDATE_ROLE: 'UPDATE_ROLE',
  DELETE_ROLE: 'DELETE_ROLE',
  ASSIGN_ROLE: 'ASSIGN_ROLE',
  UNASSIGN_ROLE: 'UNASSIGN_ROLE',

  // Permission actions
  GRANT_PERMISSION: 'GRANT_PERMISSION',
  REVOKE_PERMISSION: 'REVOKE_PERMISSION',
  UPDATE_PERMISSIONS: 'UPDATE_PERMISSIONS',

  // System actions
  SYSTEM_CONFIGURATION_UPDATE: 'SYSTEM_CONFIGURATION_UPDATE',
  PLATFORM_MAINTENANCE: 'PLATFORM_MAINTENANCE'
};

/**
 * Audit log resource constants for consistency
 */
const AUDIT_RESOURCES = {
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  ORGANIZATION_USER: 'ORGANIZATION_USER',
  ROLE: 'ROLE',
  ROLE_PERMISSION: 'ROLE_PERMISSION',
  PERMISSION: 'PERMISSION',
  SUBSCRIPTION: 'SUBSCRIPTION',
  PAYMENT: 'PAYMENT',
  SYSTEM: 'SYSTEM'
};

/**
 * Get all permissions for a user (across all organizations)
 * Returns an array of { action, resource }
 */
async function getUserPermissions(user) {
  if (!user || !user.id) return [];

  try {
    // Get user with roles and their permissions
    const userWithRoles = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            rolePermissions: true
          }
        }
      }
    });

    if (!userWithRoles) return [];

    // Collect permissions from all roles
    let permissions = [];
    for (const role of userWithRoles.roles) {
      if (role.rolePermissions) {
        permissions.push(...role.rolePermissions.map(p => ({
          action: p.action,
          resource: p.resource
        })));
      }
    }

    // Remove duplicates
    const unique = {};
    permissions.forEach(p => {
      unique[`${p.action}:${p.resource}`] = p;
    });

    return Object.values(unique);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

module.exports = {
  createAuditLog,
  auditMiddleware,
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  getUserPermissions
};
