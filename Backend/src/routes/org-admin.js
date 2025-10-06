const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const { authenticateToken, requireOrgAdminAccess, allowSelfOrPermission } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');
const bcrypt = require('bcryptjs');
const { createUser, updateUserRole, updateUserStatus, createRole, getOrganizationUsers, getUserProfileById, updateUserProfile, deleteUser } = require('../controllers/orgAdminController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Organization Admin
 *   description: Organization administration endpoints (Organization Admin only)
 */

// Note: Authentication and permission checks are now handled globally
// Individual route permission checks can be added here if needed

/**
 * @swagger
 * /api/org-admin/users:
 *   post:
 *     summary: Create a new user in the organization
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - roleId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "User123!"
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "Doe"
 *               roleId:
 *                 type: string
 *                 example: "role_123"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [CREATE, READ, UPDATE, DELETE, MANAGE]
 *                     resource:
 *                       type: string
 *                       enum: [ORGANIZATION_SETTINGS, SYSTEM_PREFERENCES, USER_MANAGEMENT, USER_ROLES, ORGANIZATION_USERS, ORGANIZATION_INVITATIONS, CONTENT_CREATION, LEAD_ASSIGNMENT, FORM_CUSTOMIZATION, FIELD_TYPE_CONFIGURATION]
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User created successfully"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     avatar: { type: string }
 *                     emailVerified: { type: boolean }
 *                     isActive: { type: boolean }
 *                     lastLoginAt: { type: string, format: date-time }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                     systemRole: { type: string, enum: [SUPER_ADMIN, ORGANIZATION_ADMIN, USER] }
 *                 orgUser:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     role: { type: string, enum: [ORGANIZATION_ADMIN, USER] }
 *                     roleId: { type: string }
 *                     joinedAt: { type: string, format: date-time }
 *                     isActive: { type: boolean }
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action: { type: string }
 *                           resource: { type: string }
 *       400:
 *         description: Validation error
 *       403:
 *         description: Organization admin access required
 *       409:
 *         description: User with this email already exists
 */
// Create user in organization
router.post('/users', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name is required'),
  body('roleId').custom(value => value !== undefined && value !== null && value !== '').withMessage('Role ID is required'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array')
], createUser);

/**
 * @swagger
 * /api/org-admin/users/{userId}/role:
 *   put:
 *     summary: Update user role and permissions
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
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
 *               roleId:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [ORGANIZATION_SETTINGS, SYSTEM_PREFERENCES, USER_MANAGEMENT, USER_ROLES, ORGANIZATION_USERS, ORGANIZATION_INVITATIONS, CONTENT_CREATION, LEAD_ASSIGNMENT, FORM_CUSTOMIZATION, FIELD_TYPE_CONFIGURATION]
 *                     resource:
 *                       type: string
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
// Update user role and permissions
router.put('/users/:userId/role', [
  body('roleId').optional().isString(),
  body('permissions').optional().isArray()
], updateUserRole);

/**
 * @swagger
 * /api/org-admin/users/{userId}/status:
 *   put:
 *     summary: Update user status
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
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
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       404:
 *         description: User not found
 */
// Update user status
router.put('/users/:userId/status', [
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], updateUserStatus);

/**
 * @swagger
 * /api/org-admin/roles:
 *   post:
 *     summary: Create a new organization role
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [ORGANIZATION_SETTINGS, SYSTEM_PREFERENCES, USER_MANAGEMENT, USER_ROLES, ORGANIZATION_USERS, ORGANIZATION_INVITATIONS, CONTENT_CREATION, LEAD_ASSIGNMENT, FORM_CUSTOMIZATION, FIELD_TYPE_CONFIGURATION]
 *                     resource:
 *                       type: string
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Role with this name already exists
 */
// Create organization role
router.post('/roles', [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Role name is required'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('permissions').optional().isArray()
], createRole);

/**
 * @swagger
 * /api/org-admin/users:
 *   get:
 *     summary: Get all users in the organization
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users in the organization
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   email: { type: string }
 *                   firstName: { type: string }
 *                   lastName: { type: string }
 *                   avatar: { type: string }
 *                   emailVerified: { type: boolean }
 *                   isActive: { type: boolean }
 *                   lastLoginAt: { type: string, format: date-time }
 *                   createdAt: { type: string, format: date-time }
 *                   updatedAt: { type: string, format: date-time }
 *                   systemRole: { type: string, enum: [SUPER_ADMIN, ORGANIZATION_ADMIN, USER] }
 *                   orgUser:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       role: { type: string, enum: [ORGANIZATION_ADMIN, USER] }
 *                       roleId: { type: string }
 *                       joinedAt: { type: string, format: date-time }
 *                       isActive: { type: boolean }
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             action: { type: string }
 *                             resource: { type: string }
 */
// Add this route for listing users in the organization
router.get('/users', getOrganizationUsers);

const profileActions = ['CREATE', 'DELETE', 'UPDATE', 'READ', 'MANAGE'];
/**
 * @swagger
 * /api/org-admin/users/{userId}:
 *   get:
 *     summary: Get a user's profile by ID
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 email: { type: string }
 *                 firstName: { type: string }
 *                 lastName: { type: string }
 *                 avatar: { type: string }
 *                 emailVerified: { type: boolean }
 *                 isActive: { type: boolean }
 *                 lastLoginAt: { type: string, format: date-time }
 *                 createdAt: { type: string, format: date-time }
 *                 updatedAt: { type: string, format: date-time }
 *                 systemRole: { type: string, enum: [SUPER_ADMIN, ORGANIZATION_ADMIN, USER] }
 *                 orgUser:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     role: { type: string, enum: [ORGANIZATION_ADMIN, USER] }
 *                     roleId: { type: string }
 *                     joinedAt: { type: string, format: date-time }
 *                     isActive: { type: boolean }
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action: { type: string }
 *                           resource: { type: string }
 *       404:
 *         description: User not found
 */
// Add this route for getting a user's profile by id
router.get('/users/:userId', authenticateToken, allowSelfOrPermission(profileActions, 'PROFILE'), getUserProfileById);

/**
 * @swagger
 * /api/org-admin/users/{userId}:
 *   put:
 *     summary: Update a user's profile
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
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
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "Doe"
 *               avatar:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *               emailVerified:
 *                 type: boolean
 *                 example: true
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               lastLoginAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2023-10-27T10:00:00.000Z"
 *               systemRole:
 *                 type: string
 *                 enum: [SUPER_ADMIN, ORGANIZATION_ADMIN, USER]
 *                 example: "ORGANIZATION_ADMIN"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: "New password for the user (only organization admins can update passwords)"
 *                 example: "NewPassword123!"
 *               orgUser:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   role: { type: string, enum: [ORGANIZATION_ADMIN, USER] }
 *                   roleId: { type: string }
 *                   joinedAt: { type: string, format: date-time }
 *                   isActive: { type: boolean }
 *                   permissions:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         action: { type: string }
 *                         resource: { type: string }
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
// Add this route for updating a user's profile by id
router.put('/users/:userId', [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters'),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phoneNumber').optional().trim(),
  body('bio').optional().trim(),
  // update filed isactive is boolean 
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], authenticateToken, allowSelfOrPermission(profileActions, 'PROFILE'), updateUserProfile);

/**
 * @swagger
 * /api/org-admin/users/{userId}:
 *   delete:
 *     summary: Deactivate a user
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       404:
 *         description: User not found
 */
// Add this route for deleting (deactivating) a user by id
router.delete('/users/:userId', deleteUser);

module.exports = router; 