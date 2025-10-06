const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const { authenticateToken, requireSuperAdmin, requireSystemPermission } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');
const bcrypt = require('bcrypt');
const { getAnalytics, getUsers, getOrganizations, createOrganization, updateUserStatus, updateOrganizationStatus, getAuditLogs } = require('../controllers/superAdminController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Super Admin
 *   description: Platform-wide administration and analytics endpoints (Super Admin only)
 */

// Apply authentication and super admin check to all routes
router.use(authenticateToken);
router.use(requireSuperAdmin);

/**
 * @swagger
 * /api/super-admin/analytics:
 *   get:
 *     summary: Get platform-wide analytics
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve comprehensive platform analytics and statistics (Super Admin only)
 *     responses:
 *       200:
 *         description: Platform analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       example: 1250
 *                       description: "Total number of users on the platform"
 *                     totalOrganizations:
 *                       type: integer
 *                       example: 150
 *                       description: "Total number of organizations"
 *                     activeSubscriptions:
 *                       type: integer
 *                       example: 125
 *                       description: "Number of active subscriptions"
 *                     totalRevenue:
 *                       type: integer
 *                       example: 125000
 *                       description: "Total revenue in cents"
 *                     recentUsers:
 *                       type: integer
 *                       example: 85
 *                       description: "New users in last 30 days"
 *                     recentOrganizations:
 *                       type: integer
 *                       example: 12
 *                       description: "New organizations in last 30 days"
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-20T15:30:00.000Z"
 *                       description: "When analytics were generated"
 *             examples:
 *               success:
 *                 summary: Platform analytics
 *                 value:
 *                   analytics:
 *                     totalUsers: 1250
 *                     totalOrganizations: 150
 *                     activeSubscriptions: 125
 *                     totalRevenue: 125000
 *                     recentUsers: 85
 *                     recentOrganizations: 12
 *                     generatedAt: "2024-01-20T15:30:00.000Z"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Super Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get platform-wide analytics and statistics
router.get('/analytics', requireSystemPermission('READ', 'PLATFORM_ANALYTICS'), getAnalytics);

/**
 * @swagger
 * /api/super-admin/users:
 *   get:
 *     summary: Get all platform users
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve paginated list of all users across the platform with search and filtering
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: search
 *         in: query
 *         description: Search users by email, first name, or last name
 *         schema:
 *           type: string
 *           example: "john"
 *       - name: status
 *         in: query
 *         description: Filter by user status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *           example: "active"
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       email: { type: string }
 *                       firstName: { type: string }
 *                       lastName: { type: string }
 *                       avatar: { type: string }
 *                       emailVerified: { type: boolean }
 *                       isActive: { type: boolean }
 *                       lastLoginAt: { type: string, format: date-time }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *                       systemRole: { type: string, enum: [SUPER_ADMIN, ORGANIZATION_ADMIN, USER] }
 *                       organizationMembers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             organization:
 *                               type: object
 *                               properties:
 *                                 id: { type: string }
 *                                 name: { type: string }
 *                                 slug: { type: string }
 *                                 status: { type: string, enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED] }
 *                             role: { type: string, enum: [SUPER_ADMIN, ORGANIZATION_ADMIN, USER] }
 *                             isActive: { type: boolean }
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginatedResponse/properties/pagination'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Super Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all users across the platform
router.get('/users', requireSystemPermission('READ', 'PLATFORM_USERS'), getUsers);

/**
 * @swagger
 * /api/super-admin/organizations:
 *   get:
 *     summary: Get all platform organizations
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve paginated list of all organizations across the platform with search and filtering
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: search
 *         in: query
 *         description: Search organizations by name or slug
 *         schema:
 *           type: string
 *           example: "acme"
 *       - name: status
 *         in: query
 *         description: Filter by organization status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED]
 *           example: "ACTIVE"
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organizations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       slug: { type: string }
 *                       domain: { type: string }
 *                       description: { type: string }
 *                       logo: { type: string }
 *                       website: { type: string }
 *                       status: { type: string, enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED] }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *                       createdBy:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           email: { type: string }
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                       admin:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           email: { type: string }
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                       roles:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/Role'
 *                       organization_users:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/OrganizationUser'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginatedResponse/properties/pagination'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Super Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @swagger
 * /api/super-admin/organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Create a new organization with an automatically created admin user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - adminEmail
 *               - adminPassword
 *               - adminFirstName
 *               - adminLastName
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Acme Corporation"
 *               domain:
 *                 type: string
 *                 example: "acme.com"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "A leading technology company"
 *               website:
 *                 type: string
 *                 example: "https://acme.com"
 *               adminEmail:
 *                 type: string
 *                 format: email
 *                 example: "admin@acme.com"
 *               adminPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "Admin123!"
 *               adminFirstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "John"
 *               adminLastName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "Doe"
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization created successfully"
 *                 organization:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Organization'
 *                     - type: object
 *                       properties:
 *                         admin:
 *                           $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Super Admin access required
 *       409:
 *         description: Organization admin email already exists
 */
// Create organization with admin
router.post('/organizations', requireSystemPermission('CREATE', 'PLATFORM_ORGANIZATIONS'), [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Organization name is required and must be between 1-100 characters'),
  body('domain').optional().trim(),
  body('description').optional().trim().isLength({ max: 500 }),
  body('website').optional().trim(),
  body('adminEmail').isEmail().withMessage('Valid admin email is required'),
  body('adminPassword').isLength({ min: 8 }).withMessage('Admin password must be at least 8 characters'),
  body('adminFirstName').trim().isLength({ min: 1, max: 50 }).withMessage('Admin first name is required'),
  body('adminLastName').trim().isLength({ min: 1, max: 50 }).withMessage('Admin last name is required')
], createOrganization);

// Get all organizations across the platform
router.get('/organizations', requireSystemPermission('READ', 'PLATFORM_ORGANIZATIONS'), getOrganizations);

/**
 * @swagger
 * /api/super-admin/users/{userId}/status:
 *   patch:
 *     summary: Update user status (suspend/activate)
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Suspend or activate a user account across the platform
 *     parameters:
 *       - $ref: '#/components/parameters/userId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 example: false
 *                 description: "Whether the user account should be active"
 *           examples:
 *             suspendUser:
 *               summary: Suspend user account
 *               value:
 *                 isActive: false
 *             activateUser:
 *               summary: Activate user account
 *               value:
 *                 isActive: true
 *     responses:
 *       200:
 *         description: User status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User suspended successfully"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "cm123abc456def789"
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                     firstName:
 *                       type: string
 *                       example: "John"
 *                     lastName:
 *                       type: string
 *                       example: "Doe"
 *                     isActive:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Validation error or cannot deactivate own account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               selfDeactivation:
 *                 summary: Cannot deactivate own account
 *                 value:
 *                   error: "Cannot deactivate your own account"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Super Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Suspend/Activate a user
router.patch('/users/:userId/status', requireSystemPermission('MANAGE', 'PLATFORM_USERS'), updateUserStatus);

/**
 * @swagger
 * /api/super-admin/organizations/{organizationId}/status:
 *   patch:
 *     summary: Update organization status
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Change the status of an organization (active, suspended, trial, cancelled)
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED]
 *                 example: "SUSPENDED"
 *                 description: "New status for the organization"
 *           examples:
 *             suspendOrg:
 *               summary: Suspend organization
 *               value:
 *                 status: "SUSPENDED"
 *             activateOrg:
 *               summary: Activate organization
 *               value:
 *                 status: "ACTIVE"
 *             trialOrg:
 *               summary: Set to trial
 *               value:
 *                 status: "TRIAL"
 *     responses:
 *       200:
 *         description: Organization status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization status updated successfully"
 *                 organization:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "cm456def789ghi012"
 *                     name:
 *                       type: string
 *                       example: "Acme Corporation"
 *                     slug:
 *                       type: string
 *                       example: "acme-corporation"
 *                     status:
 *                       type: string
 *                       example: "SUSPENDED"
 *       400:
 *         description: Invalid status value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidStatus:
 *                 summary: Invalid status
 *                 value:
 *                   error: "Status must be one of: ACTIVE, SUSPENDED, TRIAL, CANCELLED"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Super Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Suspend/Activate an organization
router.patch('/organizations/:organizationId/status', requireSystemPermission('MANAGE', 'PLATFORM_ORGANIZATIONS'), updateOrganizationStatus);

/**
 * @swagger
 * /api/super-admin/audit-logs:
 *   get:
 *     summary: Get platform-wide audit logs
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve paginated audit logs for all platform activities with advanced filtering
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - name: limit
 *         in: query
 *         description: Number of audit logs per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *           example: 50
 *       - name: action
 *         in: query
 *         description: Filter by specific action
 *         schema:
 *           type: string
 *           example: "USER_SUSPENDED"
 *       - name: resource
 *         in: query
 *         description: Filter by resource type
 *         schema:
 *           type: string
 *           example: "USER"
 *       - name: userId
 *         in: query
 *         description: Filter by specific user ID
 *         schema:
 *           type: string
 *           example: "cm123abc456def789"
 *       - name: organizationId
 *         in: query
 *         description: Filter by specific organization ID
 *         schema:
 *           type: string
 *           example: "cm456def789ghi012"
 *     responses:
 *       200:
 *         description: Platform audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auditLogs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       action: { type: string }
 *                       resource: { type: string }
 *                       resourceId: { type: string }
 *                       oldValues: { type: object }
 *                       newValues: { type: object }
 *                       ipAddress: { type: string }
 *                       userAgent: { type: string }
 *                       userRole: { type: string }
 *                       systemRole: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       user:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           email: { type: string }
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                       organization:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                           slug: { type: string }
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginatedResponse/properties/pagination'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Super Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get platform-wide audit logs
router.get('/audit-logs', requireSystemPermission('READ', 'PLATFORM_AUDIT_LOGS'), getAuditLogs);

/**
 * @swagger
 * /api/super-admin/organizations/{organizationId}/org-admin-permissions:
 *   put:
 *     summary: Update Organization Admin role permissions for an organization
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: organizationId
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
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [CREATE, READ, UPDATE, DELETE, MANAGE, CHAT]
 *                     resource:
 *                       type: string
 *                       enum: [ORGANIZATION_SETTINGS, SYSTEM_PREFERENCES, USER_MANAGEMENT, USER_ROLES, ORGANIZATION_USERS, ORGANIZATION_INVITATIONS, CONTENT_CREATION, LEAD_ASSIGNMENT, FORM_CUSTOMIZATION, FIELD_TYPE_CONFIGURATION, AGENT_TO_AGENT_CHAT, AGENT_TO_TEAM_LEAD_CHAT]
 *     responses:
 *       200:
 *         description: Org Admin permissions updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Organization or Org Admin role not found
 */
router.put('/organizations/:organizationId/org-admin-permissions', requireSuperAdmin, async (req, res, next) => {
  try {
    let { organizationId } = req.params;
    organizationId = parseInt(organizationId, 10);
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }
    // Find the Organization Admin role for this org
    const orgAdminRole = await prisma.role.findFirst({
      where: {
        organizationId: organizationId,
        name: 'ORGANIZATION_ADMIN'
      }
    });
    if (!orgAdminRole) {
      return res.status(404).json({ error: 'Organization Admin role not found for this organization' });
    }
    // Remove all current permissions for this role
    await prisma.rolePermission.deleteMany({ where: { roleId: orgAdminRole.id } });
    // Add new permissions, allow all PermissionResource enum values
    const allowedActions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE', 'CHAT', 'POST'];
    // Import all PermissionResource values from the generated Prisma client
    const { PermissionResource } = require('@prisma/client');
    const allowedResources = Object.values(PermissionResource);
    const filteredPermissions = permissions.filter(
      perm => allowedActions.includes(perm.action) && allowedResources.includes(perm.resource)
    );
    if (filteredPermissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: filteredPermissions.map(perm => ({
          action: perm.action,
          resource: perm.resource,
          roleId: orgAdminRole.id,
          organizationId: organizationId
        }))
      });
    }
    res.json({ message: 'Org Admin permissions updated successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/super-admin/organizations/{organizationId}/org-admin-permissions:
 *   get:
 *     summary: Get Organization Admin role permissions for an organization
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: organizationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Org Admin permissions fetched successfully
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
 *                       action:
 *                         type: string
 *                         enum: [CREATE, READ, UPDATE, DELETE, MANAGE, CHAT]
 *                       resource:
 *                         type: string
 *                         enum: [ORGANIZATION_SETTINGS, SYSTEM_PREFERENCES, USER_MANAGEMENT, USER_ROLES, ORGANIZATION_USERS, ORGANIZATION_INVITATIONS, CONTENT_CREATION, LEAD_ASSIGNMENT, FORM_CUSTOMIZATION, FIELD_TYPE_CONFIGURATION, AGENT_TO_AGENT_CHAT, AGENT_TO_TEAM_LEAD_CHAT]
 *       404:
 *         description: Organization or Org Admin role not found
 */
router.get('/organizations/:organizationId/org-admin-permissions', requireSuperAdmin, async (req, res, next) => {
  try {
    let { organizationId } = req.params;
    organizationId = parseInt(organizationId, 10);
    // Find the Organization Admin role for this org
    const orgAdminRole = await prisma.role.findFirst({
      where: {
        organizationId: organizationId,
        name: 'ORGANIZATION_ADMIN'
      }
    });
    if (!orgAdminRole) {
      return res.status(404).json({ error: 'Organization Admin role not found for this organization' });
    }
    // Get permissions for this role
    const permissions = await prisma.rolePermission.findMany({
      where: { roleId: orgAdminRole.id },
      select: { action: true, resource: true }
    });
    res.json({ permissions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
