const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const { authenticateToken, requireOrgAdmin } = require('../middleware/auth');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');
const { createRole, getRoles, updateRole, deleteRole, assignRole, getAllPossiblePermissions, getRoleById, getAllNonAgentRoles } = require('../controllers/rolesController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role management endpoints for organization admins
 */

// Custom middleware to allow users with appropriate permissions or super_admin
function requireOrgAdminOrSuperAdmin(req, res, next) {
  const isSuperAdmin = req.user?.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
  
  // Check if user has USER_ROLES permission
  const hasUserRolesPermission = req.user?.permissions && req.user.permissions.some(perm => 
    perm.resource === 'USER_ROLES' && (perm.action === 'READ' || perm.action === 'ALL')
  );
  
  // Check if user has ORGANIZATION_ADMIN permission
  const hasOrgAdminPermission = req.user?.permissions && req.user.permissions.some(perm => 
    perm.resource === 'ORGANIZATION_ADMIN' && (perm.action === 'READ' || perm.action === 'ALL')
  );
  
  if (!isSuperAdmin && !hasUserRolesPermission && !hasOrgAdminPermission) {
    return res.status(403).json({ 
      error: 'Super admin access, USER_ROLES permission, or ORGANIZATION_ADMIN permission required' 
    });
  }
  next();
}

// All routes require authentication and org admin or super admin access
router.use(authenticateToken);


/**
 * @swagger
 * /api/organizations/{organizationId}/roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "Content Manager"
 *               description:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Can manage content and moderate posts"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - action
 *                     - resource
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [CREATE, READ, UPDATE, DELETE, MANAGE]
 *                     resource:
 *                       type: string
 *                       enum: [ORGANIZATION_SETTINGS, SYSTEM_PREFERENCES, USER_MANAGEMENT, USER_ROLES, ORGANIZATION_USERS, ORGANIZATION_INVITATIONS, CONTENT_CREATION, LEAD_ASSIGNMENT, FORM_CUSTOMIZATION, FIELD_TYPE_CONFIGURATION]
 *                       example: "CONTENT_CREATION"
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Role created successfully"
 *                 role:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     description: { type: string }
 *                     isActive: { type: boolean }
 *                     isSystem: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                     rolePermissions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RolePermission'
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OrganizationUser'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Organization admin or super admin access required
 */
// Create a new role
router.post('/:organizationId/roles', requireOrgAdminOrSuperAdmin,  [
  body('name').trim().isLength({ min: 1, max: 50 }),
  body('description').optional().trim().isLength({ max: 200 }),
  body('permissions').isArray({ min: 1 }),
  body('permissions.*.action').isIn(['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE']),
  body('permissions.*.resource').isString()
], createRole);

/**
 * @swagger
 * /api/organizations/{organizationId}/roles:
 *   get:
 *     summary: Get all roles for an organization
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       description: { type: string }
 *                       isActive: { type: boolean }
 *                       isSystem: { type: boolean }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *                       rolePermissions:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/RolePermission'
 *                       users:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/OrganizationUser'
 *       403:
 *         description: Organization admin or super admin access required
 */
// Get all roles for an organization
router.get('/:organizationId/roles',requireOrgAdminOrSuperAdmin, getRoles);

/**
 * @swagger
 * /api/organizations/{organizationId}/roles/{roleId}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: roleId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - action
 *                     - resource
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [CREATE, READ, UPDATE, DELETE, MANAGE]
 *                     resource:
 *                       type: string
 *                       enum: [ORGANIZATION_SETTINGS, SYSTEM_PREFERENCES, USER_MANAGEMENT, USER_ROLES, ORGANIZATION_USERS, ORGANIZATION_INVITATIONS, CONTENT_CREATION, LEAD_ASSIGNMENT, FORM_CUSTOMIZATION, FIELD_TYPE_CONFIGURATION]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Role updated successfully"
 *                 role:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     description: { type: string }
 *                     isActive: { type: boolean }
 *                     isSystem: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                     rolePermissions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RolePermission'
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OrganizationUser'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Organization admin or super admin access required
 *       404:
 *         description: Role not found
 */
// Update a role
router.put('/:organizationId/roles/:roleId', requireOrgAdminOrSuperAdmin, [
  body('name').optional().trim().isLength({ min: 1, max: 50 }),
  body('description').optional().trim().isLength({ max: 200 }),
  body('isActive').optional().isBoolean(),
  body('isAgent').optional().isBoolean(), // Add this line
  body('permissions').optional().isArray()
], updateRole);

/**
 * @swagger
 * /api/organizations/{organizationId}/roles/{roleId}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: roleId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Role deleted successfully"
 *       403:
 *         description: Organization admin or super admin access required
 *       404:
 *         description: Role not found
 */
// Delete a role
router.delete('/:organizationId/roles/:roleId', requireOrgAdminOrSuperAdmin, deleteRole);

/**
 * @swagger
 * /api/organizations/{organizationId}/roles/{roleId}/assign:
 *   post:
 *     summary: Assign role to users
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: roleId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Role assigned successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Organization admin access required
 *       404:
 *         description: Role not found
 */
// Assign role to users
router.post('/:organizationId/roles/:roleId/assign', requireOrgAdminOrSuperAdmin, [
  body('userIds').isArray({ min: 1 }),
  body('userIds.*').isString()
], assignRole);

/**
 * @swagger
 * /api/roles/permissions:
 *   get:
 *     summary: Get all possible permissions for role creation
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All possible permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       action: { type: string, enum: [CREATE, READ, UPDATE, DELETE, MANAGE] }
 *                       resource: { type: string, enum: [ORGANIZATION_SETTINGS, SYSTEM_PREFERENCES, USER_MANAGEMENT, USER_ROLES, ORGANIZATION_USERS, ORGANIZATION_INVITATIONS, CONTENT_CREATION, LEAD_ASSIGNMENT, FORM_CUSTOMIZATION, FIELD_TYPE_CONFIGURATION] }
 *       403:
 *         description: Organization admin or super admin access required
 */
// Add endpoint to get all possible permissions
router.get('/permissions', requireOrgAdminOrSuperAdmin, authenticateToken, getAllPossiblePermissions);

/**
 * @swagger
 * /api/organizations/{organizationId}/roles/non-agents:
 *   get:
 *     summary: Get all non-agent roles for an organization
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *     responses:
 *       200:
 *         description: Non-agent roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Non-agent roles retrieved successfully"
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       description: { type: string }
 *                       isActive: { type: boolean }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *                       rolePermissions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             action: { type: string }
 *                             resource: { type: string }
 *                       _count:
 *                         type: object
 *                         properties:
 *                           users: { type: number }
 *       403:
 *         description: Authentication required
 *       404:
 *         description: Organization not found
 */
// Get all non-agent roles for an organization (accessible to any authenticated user)
router.get('/:organizationId/roles/non-agents', authenticateToken, getAllNonAgentRoles);

/**
 * @swagger
 * /api/organizations/{organizationId}/roles/{roleId}:
 *   get:
 *     summary: Get a single role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: roleId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 role:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     description: { type: string }
 *                     isActive: { type: boolean }
 *                     isSystem: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                     rolePermissions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RolePermission'
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OrganizationUser'
 *       403:
 *         description: Organization admin or super admin access required
 *       404:
 *         description: Role not found
 */
// Get a single role by ID
router.get('/:organizationId/roles/:roleId', authenticateToken, requireOrgAdminOrSuperAdmin, getRoleById);

module.exports = router; 