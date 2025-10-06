const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { getProfile, updateProfile, changePassword, changeEmail, deleteAccount } = require('../controllers/usersController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile and account management endpoints
 */

// Note: Authentication and permission checks are now handled globally

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve the authenticated user's profile information including organizations
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *                     organizationMembers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           organization:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               slug: { type: string }
 *                               status: { type: string, enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED] }
 *                           role: { type: string, enum: [SUPER_ADMIN, ORGANIZATION_ADMIN, USER] }
 *                           isActive: { type: boolean }
 *       401:
 *         description: Unauthorized - Invalid or missing token
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
// Get user profile
router.get('/profile', getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Update the authenticated user's profile information
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
 *                 format: uri
 *                 example: "https://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update user profile
router.put('/profile', authenticateToken, [
  body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('avatar').optional().if(body('avatar').notEmpty()).isURL()  // Only validate URL if not empty
], updateProfile);

/**
 * @swagger
 * /api/users/password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Change the authenticated user's password (not available for OAuth users)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "CurrentPassword123!"
 *                 description: "User's current password"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "NewSecurePassword456!"
 *                 description: "New password (min 8 chars, must include uppercase, lowercase, number, special char)"
 *           examples:
 *             changePassword:
 *               summary: Change password
 *               value:
 *                 currentPassword: "CurrentPassword123!"
 *                 newPassword: "NewSecurePassword456!"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password changed successfully"
 *       400:
 *         description: Validation error or incorrect current password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               incorrectPassword:
 *                 summary: Incorrect current password
 *                 value:
 *                   error: "Current password is incorrect"
 *               oauthUser:
 *                 summary: OAuth user error
 *                 value:
 *                   error: "Cannot change password for OAuth users"
 *               weakPassword:
 *                 summary: Weak new password
 *                 value:
 *                   error: "New password does not meet requirements"
 *                   details: ["Password must contain at least one uppercase letter"]
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Change password
router.put('/password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], changePassword);

/**
 * @swagger
 * /api/users/email:
 *   put:
 *     summary: Change user email address
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Change the authenticated user's email address (not available for OAuth users)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *               - password
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *                 example: "newemail@example.com"
 *                 description: "New email address"
 *               password:
 *                 type: string
 *                 example: "CurrentPassword123!"
 *                 description: "Current password for verification"
 *     responses:
 *       200:
 *         description: Email changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email changed successfully. Please verify your new email address."
 *       400:
 *         description: Validation error, incorrect password, or email already taken
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               emailTaken:
 *                 summary: Email already taken
 *                 value:
 *                   error: "Email is already taken"
 *               incorrectPassword:
 *                 summary: Incorrect password
 *                 value:
 *                   error: "Password is incorrect"
 *               oauthUser:
 *                 summary: OAuth user error
 *                 value:
 *                   error: "Cannot change email for OAuth users"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Change email
router.put('/email', authenticateToken, [
  body('newEmail').isEmail().normalizeEmail(),
  body('password').notEmpty()
], changeEmail);

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     summary: Delete user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Delete the authenticated user's account (deactivates account for data integrity)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmation
 *             properties:
 *               password:
 *                 type: string
 *                 example: "CurrentPassword123!"
 *                 description: "Current password for verification"
 *               confirmation:
 *                 type: string
 *                 enum: ["DELETE"]
 *                 example: "DELETE"
 *                 description: "Must be exactly 'DELETE' to confirm account deletion"
 *           examples:
 *             deleteAccount:
 *               summary: Delete account
 *               value:
 *                 password: "CurrentPassword123!"
 *                 confirmation: "DELETE"
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Account deleted successfully"
 *       400:
 *         description: Validation error, incorrect password, or user is sole admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               soleAdmin:
 *                 summary: User is sole admin
 *                 value:
 *                   error: "Cannot delete account. You are the sole admin of one or more organizations. Please transfer ownership or delete the organizations first."
 *                   organizations: ["Acme Corporation", "Tech Startup"]
 *               incorrectPassword:
 *                 summary: Incorrect password
 *                 value:
 *                   error: "Password is incorrect"
 *               oauthUser:
 *                 summary: OAuth user error
 *                 value:
 *                   error: "Cannot delete OAuth user accounts"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Delete account
router.delete('/account', authenticateToken, [
  body('password').notEmpty(),
  body('confirmation').equals('DELETE')
], deleteAccount);

/**
 * @swagger
 * /api/users/non-agents:
 *   get:
 *     summary: Get all users who are not agents
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve all users who are not agents (e.g., regular users, organization admins)
 *     responses:
 *       200:
 *         description: List of non-agent users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all users who are not agents
router.get('/non-agents', require('./../controllers/usersController').getNonAgentUsers);

/**
 * @swagger
 * /api/users/organizations/{organizationId}/non-agents:
 *   get:
 *     summary: Get all users in an organization who are not agents
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     description: Retrieve all users in a specific organization who are not agents (e.g., regular users, organization admins)
 *     responses:
 *       200:
 *         description: List of non-agent users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - Organization ID is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all users in an organization who are not agents
router.get('/organizations/:organizationId/non-agents', require('./../controllers/usersController').getNonAgentUsers);

/**
 * @swagger
 * /api/users/profile/me/{id}:
 *   get:
 *     summary: Get user profile by ID (self-access only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID (must match authenticated user)
 *     description: Retrieve the authenticated user's profile information by ID. Users can only access their own profile.
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *                     organization_users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           organization:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               slug: { type: string }
 *                               status: { type: string, enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED] }
 *                           role: { type: string }
 *                           isActive: { type: boolean }
 *       403:
 *         description: Forbidden - User can only access their own profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You can only access your own profile"
 *                 code:
 *                   type: string
 *                   example: "SELF_ACCESS_ONLY"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get user profile by ID (self-access only)
router.get('/profile/me/:id', require('./../controllers/usersController').getProfileById);

/**
 * @swagger
 * /api/users/profile/me/{id}:
 *   put:
 *     summary: Update user profile by ID (self-access only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID (must match authenticated user)
 *     description: Update the authenticated user's profile information by ID. Users can only update their own profile.
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
 *                 format: uri
 *                 example: "https://example.com/avatar.jpg"
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User can only update their own profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You can only update your own profile"
 *                 code:
 *                   type: string
 *                   example: "SELF_ACCESS_ONLY"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update user profile by ID (self-access only)
router.put('/profile/me/:id', authenticateToken, [
  body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('avatar').optional().if(body('avatar').notEmpty()).isURL(),
  body('phoneNumber').optional().isMobilePhone()
], require('./../controllers/usersController').updateProfileById);

module.exports = router;
