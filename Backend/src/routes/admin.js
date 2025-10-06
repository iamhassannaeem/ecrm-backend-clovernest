const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Import middleware
const { authenticateToken } = require('../middleware/auth');
const { requireOrgAdmin } = require('../middleware/auth');

// Import audit constants
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');

// Import controller functions
const { getDashboard, getAuditLogs } = require('../controllers/adminController');

/**
 * @swagger
 * /api/admin/dashboard/{organizationId}:
 *   get:
 *     summary: Get organization dashboard data
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Get comprehensive dashboard data for organization including analytics and recent activity
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *     responses:
 *       200:
 *         description: Organization dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organization:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     slug: { type: string }
 *                     status: { type: string, enum: [ACTIVE, SUSPENDED, TRIAL, CANCELLED] }
 *                     description: { type: string }
 *                     logo: { type: string }
 *                     website: { type: string }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     activityStats:
 *                       type: object
 *                       properties:
 *                         totalActions: { type: integer }
 *                         todayActions: { type: integer }
 *                         weekActions: { type: integer }
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           action: { type: string }
 *                           resource: { type: string }
 *                           createdAt: { type: string, format: date-time }
 *                           user:
 *                             type: object
 *                             properties:
 *                               firstName: { type: string }
 *                               lastName: { type: string }
 *                               email: { type: string }
 *       401:
 *         description: Unauthorized - Invalid token or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Organization admin access required
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
// Get organization dashboard data
router.get('/dashboard/:organizationId', requireOrgAdmin, getDashboard);

/**
 * @swagger
 * /api/admin/audit-logs/{organizationId}:
 *   get:
 *     summary: Get organization audit logs
 *     tags: [Organization Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve paginated audit logs for organization activities with filtering options
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
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
 *           example: "UPDATE_ORGANIZATION"
 *       - name: resource
 *         in: query
 *         description: Filter by resource type
 *         schema:
 *           type: string
 *           example: "ORGANIZATION"
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
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
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                           email: { type: string }
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginatedResponse/properties/pagination'
 *       401:
 *         description: Unauthorized - Invalid token or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Organization admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get organization audit logs
router.get('/audit-logs/:organizationId', requireOrgAdmin, getAuditLogs);

module.exports = router;
