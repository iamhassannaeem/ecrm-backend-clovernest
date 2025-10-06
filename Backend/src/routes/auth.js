const express = require('express');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { authenticateToken } = require('../middleware/auth');
const { authRateLimitConfig, passwordResetRateLimitConfig } = require('../config/rateLimit');
const { getOrganizations, register, login, refreshToken, logout, forgotPassword, getMe } = require('../controllers/authController');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit(authRateLimitConfig);
const passwordResetLimiter = rateLimit(passwordResetRateLimitConfig);

/**
 * @swagger
 * /api/auth/organizations:
 *   get:
 *     summary: Get available organizations for signup
 *     tags: [Authentication]
 *     description: Get list of organizations that users can request to join
 *     responses:
 *       200:
 *         description: List of available organizations
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
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       domain:
 *                         type: string
 *                       description:
 *                         type: string
 */
// Get available organizations for signup
router.get('/organizations', getOrganizations);

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization endpoints
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with organization selection
 *     tags: [Authentication]
 *     description: Register a new user and create a join request for the selected organization. The user will need admin approval to become a member.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             newUser:
 *               summary: New user registration
 *               value:
 *                 email: "newuser@example.com"
 *                 password: "SecurePass123!"
 *                 firstName: "Jane"
 *                 lastName: "Doe"
 *                 organizationId: "cm456def789ghi012"
 *                 message: "I would like to join your organization"
 *     responses:
 *       201:
 *         description: User registered successfully, join request created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Registration successful. Your request to join the organization is pending approval."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 joinRequest:
 *                   $ref: '#/components/schemas/OrganizationJoinRequest'
 *       400:
 *         description: Validation error, user already exists, or invalid organization
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Register endpoint with organization selection
router.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().optional(),
  body('organizationId').notEmpty().withMessage('Organization selection is required'),
  body('message').optional().trim().isLength({ max: 500 })
], register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     description: Authenticate user and return tokens with user data. For organization admins, includes complete organization details with members, subscriptions, roles, and audit logs.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@example.com"
 *               password:
 *                 type: string
 *                 example: "SecurePassword123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "cm123abc456def789"
 *                     email:
 *                       type: string
 *                       example: "admin@example.com"
 *                     firstName:
 *                       type: string
 *                       example: "John"
 *                     lastName:
 *                       type: string
 *                       example: "Doe"
 *                     emailVerified:
 *                       type: boolean
 *                       example: true
 *                     systemRole:
 *                       type: string
 *                       enum: [SUPER_ADMIN, ORGANIZATION_ADMIN, USER]
 *                       example: "ORGANIZATION_ADMIN"
 *                     organizations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           domain:
 *                             type: string
 *                           description:
 *                             type: string
 *                           logo:
 *                             type: string
 *                           website:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED]
 *                           trialEndsAt:
 *                             type: string
 *                             format: date-time
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           role:
 *                             type: string
 *                             example: "ORGANIZATION_ADMIN"
 *                           createdBy:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
 *                           organization_users:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 role:
 *                                   type: string
 *                                 joinedAt:
 *                                   type: string
 *                                   format: date-time
 *                                 isActive:
 *                                   type: boolean
 *                                 users:
 *                                   type: object
 *                                   properties:
 *                                     id:
 *                                       type: string
 *                                     email:
 *                                       type: string
 *                                     firstName:
 *                                       type: string
 *                                     lastName:
 *                                       type: string
 *                                     isActive:
 *                                       type: boolean
 *                                     emailVerified:
 *                                       type: boolean
 *                                     lastLoginAt:
 *                                       type: string
 *                                       format: date-time
 *                                     createdAt:
 *                                       type: string
 *                                       format: date-time
 *                           subscriptions:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 status:
 *                                   type: string
 *                                   enum: [ACTIVE, CANCELLED, PAST_DUE, UNPAID, TRIALING]
 *                                 currentPeriodStart:
 *                                   type: string
 *                                   format: date-time
 *                                 currentPeriodEnd:
 *                                   type: string
 *                                   format: date-time
 *                                 trialEnd:
 *                                   type: string
 *                                   format: date-time
 *                                 cancelAtPeriodEnd:
 *                                   type: boolean
 *                                 stripeSubscriptionId:
 *                                   type: string
 *                                 stripePriceId:
 *                                   type: string
 *                           roles:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 name:
 *                                   type: string
 *                                 description:
 *                                   type: string
 *                                 isActive:
 *                                   type: boolean
 *                                 isSystem:
 *                                   type: boolean
 *                           auditLogs:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 action:
 *                                   type: string
 *                                 resource:
 *                                   type: string
 *                                 resourceId:
 *                                   type: string
 *                                 createdAt:
 *                                   type: string
 *                                   format: date-time
 *                                 user:
 *                                   type: object
 *                                   properties:
 *                                     firstName:
 *                                       type: string
 *                                     lastName:
 *                                       type: string
 *                                     email:
 *                                       type: string
 *                           organization_join_requests:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 status:
 *                                   type: string
 *                                   enum: [PENDING, APPROVED, REJECTED]
 *                                 requestedRole:
 *                                   type: string
 *                                 message:
 *                                   type: string
 *                                 requestedAt:
 *                                   type: string
 *                                   format: date-time
 *                                 users_organization_join_requests_userIdTousers:
 *                                   type: object
 *                                   properties:
 *                                     id:
 *                                       type: string
 *                                     email:
 *                                       type: string
 *                                     firstName:
 *                                       type: string
 *                                     lastName:
 *                                       type: string
 *                           _count:
 *                             type: object
 *                             properties:
 *                               organization_users:
 *                                 type: integer
 *                                 example: 25
 *                               subscriptions:
 *                                 type: integer
 *                                 example: 1
 *                               roles:
 *                                 type: integer
 *                                 example: 5
 *                               auditLogs:
 *                                 type: integer
 *                                 example: 150
 *                               organization_join_requests:
 *                                 type: integer
 *                                 example: 3
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     refreshToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials or account deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Login endpoint
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: New access token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Refresh token endpoint
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user and revoke refresh token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to revoke (optional)
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logout successful"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Logout endpoint
router.post('/logout', authenticateToken, logout);

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth authentication
 *     tags: [Authentication]
 *     description: Redirects user to Google OAuth consent screen
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 *       500:
 *         description: OAuth configuration error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback endpoint
 *     tags: [Authentication]
 *     description: Handles Google OAuth callback and generates JWT tokens
 *     parameters:
 *       - name: code
 *         in: query
 *         description: Authorization code from Google
 *         required: true
 *         schema:
 *           type: string
 *       - name: state
 *         in: query
 *         description: State parameter for security
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to frontend with tokens
 *       400:
 *         description: OAuth authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Generate tokens
      const accessToken = generateAccessToken(req.user.id);
      const refreshToken = await generateRefreshToken(req.user.id);

      // Redirect to frontend with tokens
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
      res.redirect(redirectUrl);
    } catch (error) {
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
  }
);

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth authentication
 *     tags: [Authentication]
 *     description: Redirects user to GitHub OAuth consent screen
 *     responses:
 *       302:
 *         description: Redirect to GitHub OAuth
 *       500:
 *         description: OAuth configuration error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GitHub OAuth routes
router.get('/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

/**
 * @swagger
 * /api/auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback endpoint
 *     tags: [Authentication]
 *     description: Handles GitHub OAuth callback and generates JWT tokens
 *     parameters:
 *       - name: code
 *         in: query
 *         description: Authorization code from GitHub
 *         required: true
 *         schema:
 *           type: string
 *       - name: state
 *         in: query
 *         description: State parameter for security
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to frontend with tokens
 *       400:
 *         description: OAuth authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Generate tokens
      const accessToken = generateAccessToken(req.user.id);
      const refreshToken = await generateRefreshToken(req.user.id);

      // Redirect to frontend with tokens
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
      res.redirect(redirectUrl);
    } catch (error) {
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
  }
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     description: Send password reset email to user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *                 description: Email address to send reset link to
 *     responses:
 *       200:
 *         description: Password reset email sent (always returns success for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "If an account with that email exists, a password reset link has been sent"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests - rate limited
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Password reset request
router.post('/forgot-password', passwordResetLimiter, [
  body('email').isEmail().normalizeEmail()
], forgotPassword);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get current user
router.get('/me', authenticateToken, getMe);

module.exports = router;
