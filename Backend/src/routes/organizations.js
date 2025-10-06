const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

const router = express.Router();

// Import middleware
const { authenticateToken } = require('../middleware/auth');
const { requireOrgAdmin, requireOrgUser } = require('../middleware/auth');
const { getOrganizationById, updateOrganization } = require('../controllers/organizationsController');

/**
 * @swagger
 * tags:
 *   name: Organizations
 *   description: Organization management endpoints
 */

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/organizations/{organizationId}:
 *   get:
 *     summary: Get organization details
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *     description: Get detailed information about a specific organization
 *     responses:
 *       200:
 *         description: Organization details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organization:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     slug:
 *                       type: string
 *                     domain:
 *                       type: string
 *                     description:
 *                       type: string
 *                     logo:
 *                       type: string
 *                     website:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     createdBy:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         email: { type: string }
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         email: { type: string }
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                     roles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Role'
 *                     organization_users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OrganizationUser'
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Organization not found"
 */
// Get organization by ID
router.get('/:organizationId', requireOrgUser, getOrganizationById);

/**
 * @swagger
 * /api/organizations/{organizationId}:
 *   put:
 *     summary: Update organization
 *     tags: [Organizations]
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Acme Corporation"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "A leading technology company"
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: "https://acme.com"
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization updated successfully"
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Organization admin access required
 *       404:
 *         description: Organization not found
 */
// Update organization
router.put('/:organizationId', requireOrgAdmin, upload.single('logo'), [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('website').optional().isURL(),
  body('currency').optional().isString(),
  body('language').optional().isString()
], updateOrganization);

// Get all Team Leads for an organization
router.get('/:organizationId/team-leads', authenticateToken, async (req, res) => {
  const { organizationId } = req.params;
  try {
    const teamLeadRole = await prisma.role.findFirst({
      where: { organizationId, name: 'Team Lead', isActive: true }
    });
    if (!teamLeadRole) return res.json([]);
    const orgUsers = await prisma.organization_users.findMany({
      where: { organizationId, roleId: teamLeadRole.id, isActive: true },
      include: { users: true }
    });
    const teamLeads = orgUsers.map(ou => ({
      id: ou.users.id,
      name: `${ou.users.firstName || ''} ${ou.users.lastName || ''}`.trim() || ou.users.email
    }));
    res.json(teamLeads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team leads' });
  }
});

module.exports = router;
