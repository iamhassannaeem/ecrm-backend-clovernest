const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');

const router = express.Router();

// Helper function to serialize BigInt values
const serializeBigInt = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

/**
 * @swagger
 * tags:
 *   name: Calls
 *   description: Call history and management endpoints
 */

// Authentication middleware will be applied individually to protected routes

/**
 * @swagger
 * /api/calls:
 *   get:
 *     summary: Get call history for organization
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve paginated call history for the user's organization with filtering options
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *       - name: limit
 *         in: query
 *         description: Number of calls per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 *       - name: startDate
 *         in: query
 *         description: Filter calls from this date (ISO format)
 *         schema:
 *           type: string
 *           format: date
 *           example: "2023-01-01"
 *       - name: endDate
 *         in: query
 *         description: Filter calls until this date (ISO format)
 *         schema:
 *           type: string
 *           format: date
 *           example: "2023-12-31"
 *       - name: minDuration
 *         in: query
 *         description: Minimum call duration in seconds
 *         schema:
 *           type: integer
 *           example: 60
 *       - name: maxDuration
 *         in: query
 *         description: Maximum call duration in seconds
 *         schema:
 *           type: integer
 *           example: 3600
 *       - name: user
 *         in: query
 *         description: Filter by user
 *         schema:
 *           type: string
 *           example: "agent001"
 *       - name: phone_number
 *         in: query
 *         description: Filter by phone number
 *         schema:
 *           type: string
 *           example: "+1234567890"
 *       - name: campaign
 *         in: query
 *         description: Filter by campaign
 *         schema:
 *           type: string
 *           example: "summer2024"
 *       - name: uniqueid
 *         in: query
 *         description: Filter by unique ID
 *         schema:
 *           type: string
 *           example: "UNIQUE123"
 *     responses:
 *       200:
 *         description: Call history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 calls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       user:
 *                         type: string
 *                         example: "agent001"
 *                       vendor_lead_code:
 *                         type: string
 *                         example: "VLC123"
 *                       source_id:
 *                         type: string
 *                         example: "SRC456"
 *                       list_id:
 *                         type: string
 *                         example: "LIST789"
 *                       phone_number:
 *                         type: string
 *                         example: "+1234567890"
 *                       security_phrase:
 *                         type: string
 *                         example: "SECURE123"
 *                       comments:
 *                         type: string
 *                         example: "Customer interested in premium package"
 *                       external_lead_id:
 *                         type: string
 *                         example: "LEAD123"
 *                       campaign:
 *                         type: string
 *                         example: "summer2024"
 *                       phone_login:
 *                         type: string
 *                         example: "LOGIN001"
 *                       group:
 *                         type: string
 *                         example: "GROUP_A"
 *                       SQLdate:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-01-15T10:30:00.000Z"
 *                       epoch:
 *                         type: integer
 *                         example: 1673782200
 *                       uniqueid:
 *                         type: string
 *                         example: "UNIQUE123"
 *                       server_ip:
 *                         type: string
 *                         example: "192.168.1.100"
 *                       SIPexten:
 *                         type: string
 *                         example: "SIP001"
 *                       session_id:
 *                         type: string
 *                         example: "SESSION123"
 *                       recording_filename:
 *                         type: string
 *                         example: "recording_001.wav"
 *                       recording_id:
 *                         type: string
 *                         example: "REC123"
 *                       entry_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-01-15T10:30:00.000Z"
 *                       called_count:
 *                         type: integer
 *                         example: 3
 *                       agent_log_id:
 *                         type: string
 *                         example: "AGENT_LOG123"
 *                       call_id:
 *                         type: string
 *                         example: "CALL123"
 *                       user_group:
 *                         type: string
 *                         example: "USER_GROUP_A"
 *                       list_name:
 *                         type: string
 *                         example: "Premium Leads"
 *                       talk_time:
 *                         type: integer
 *                         example: 300
 *                       dispo:
 *                         type: string
 *                         example: "ANSWERED"
 *                       call_notes:
 *                         type: string
 *                         example: "Customer was very interested"
 *                       term_reason:
 *                         type: string
 *                         example: "CUSTOMER_HANGUP"
 *                       callback_datetime:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-01-16T14:00:00.000Z"
 *                       organizationId:
 *                         type: integer
 *                         example: 1
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-01-15T10:30:00.000Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-01-15T10:30:00.000Z"
 *                       organization:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 150
 *                     pages:
 *                       type: integer
 *                       example: 8
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalCalls:
 *                       type: integer
 *                       example: 150
 *                     totalTalkTime:
 *                       type: integer
 *                       description: Total talk time in seconds
 *                       example: 45000
 *                     averageTalkTime:
 *                       type: number
 *                       description: Average talk time in seconds
 *                       example: 300.5
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Permission denied - CALL_HISTORY access required
 */
// Get call history for organization
router.get('/', async (req, res, next) => {
  try {
    console.log('Calls route accessed');
    console.log('req.user:', req.user);
    console.log('req.organizationId:', req.organizationId);
    
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      minTalkTime,
      maxTalkTime,
      user,
      phone_number,
      campaign,
      uniqueid
    } = req.query;

    const organizationId = req.user?.organizationId || req.organizationId;
    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause = {
      organizationId: Number(organizationId),
      ...(startDate && { entry_date: { gte: new Date(startDate) } }),
      ...(endDate && { 
        entry_date: { 
          ...(startDate ? { gte: new Date(startDate) } : {}),
          lte: new Date(endDate + 'T23:59:59.999Z')
        }
      }),
      ...(minTalkTime && { talk_time: { gte: Number(minTalkTime) } }),
      ...(maxTalkTime && { 
        talk_time: { 
          ...(minTalkTime ? { gte: Number(minTalkTime) } : {}),
          lte: Number(maxTalkTime)
        }
      }),
      ...(user && { user: user }),
      ...(phone_number && { phone_number: phone_number }),
      ...(campaign && { campaign: campaign }),
      ...(uniqueid && { uniqueid: uniqueid })
    };

    // Get calls with related data
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where: whereClause,
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { entry_date: 'desc' },
        skip: Number(skip),
        take: Number(limit)
      }),
      prisma.call.count({ where: whereClause })
    ]);

    // Calculate summary statistics
    const summary = await prisma.call.aggregate({
      where: whereClause,
      _count: { id: true },
      _sum: { talk_time: true },
      _avg: { talk_time: true }
    });

    res.json(serializeBigInt({
      calls,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      summary: {
        totalCalls: summary._count.id,
        totalTalkTime: summary._sum.talk_time || 0,
        averageTalkTime: summary._avg.talk_time || 0
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/calls/{callId}:
 *   get:
 *     summary: Get specific call details
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: callId
 *         in: path
 *         required: true
 *         description: Call ID
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Call details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 call:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     user:
 *                       type: string
 *                       example: "agent001"
 *                     vendor_lead_code:
 *                       type: string
 *                       example: "VLC123"
 *                     source_id:
 *                       type: string
 *                       example: "SRC456"
 *                     list_id:
 *                       type: string
 *                       example: "LIST789"
 *                     phone_number:
 *                       type: string
 *                       example: "+1234567890"
 *                     security_phrase:
 *                       type: string
 *                       example: "SECURE123"
 *                     comments:
 *                       type: string
 *                       example: "Customer interested in premium package"
 *                     external_lead_id:
 *                       type: string
 *                       example: "LEAD123"
 *                     campaign:
 *                       type: string
 *                       example: "summer2024"
 *                     phone_login:
 *                       type: string
 *                       example: "LOGIN001"
 *                     group:
 *                       type: string
 *                       example: "GROUP_A"
 *                     SQLdate:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-01-15T10:30:00.000Z"
 *                     epoch:
 *                       type: integer
 *                       example: 1673782200
 *                     uniqueid:
 *                       type: string
 *                       example: "UNIQUE123"
 *                     server_ip:
 *                       type: string
 *                       example: "192.168.1.100"
 *                     SIPexten:
 *                       type: string
 *                       example: "SIP001"
 *                     session_id:
 *                       type: string
 *                       example: "SESSION123"
 *                     recording_filename:
 *                       type: string
 *                       example: "recording_001.wav"
 *                     recording_id:
 *                       type: string
 *                       example: "REC123"
 *                     entry_date:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-01-15T10:30:00.000Z"
 *                     called_count:
 *                       type: integer
 *                       example: 3
 *                     agent_log_id:
 *                       type: string
 *                       example: "AGENT_LOG123"
 *                     call_id:
 *                       type: string
 *                       example: "CALL123"
 *                     user_group:
 *                       type: string
 *                       example: "USER_GROUP_A"
 *                     list_name:
 *                       type: string
 *                       example: "Premium Leads"
 *                     talk_time:
 *                       type: integer
 *                       example: 300
 *                     dispo:
 *                       type: string
 *                       example: "ANSWERED"
 *                     call_notes:
 *                       type: string
 *                       example: "Customer was very interested"
 *                     term_reason:
 *                       type: string
 *                       example: "CUSTOMER_HANGUP"
 *                     callback_datetime:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-01-16T14:00:00.000Z"
 *                     organizationId:
 *                       type: integer
 *                       example: 1
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-01-15T10:30:00.000Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-01-15T10:30:00.000Z"
 *                     organization:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Permission denied - CALL_HISTORY access required
 *       404:
 *         description: Call not found
 */
// Get specific call details
router.get('/:callId', async (req, res, next) => {
  try {
    const { callId } = req.params;
    const organizationId = req.user?.organizationId || req.organizationId;

    const call = await prisma.call.findFirst({
      where: {
        id: Number(callId),
        organizationId: Number(organizationId)
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json(serializeBigInt({ call }));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/calls:
 *   post:
 *     summary: Create a new call record
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organizationId
 *             properties:
 *               user:
 *                 type: string
 *                 description: User identifier
 *                 example: "agent001"
 *               vendor_lead_code:
 *                 type: string
 *                 description: Vendor lead code
 *                 example: "VLC123"
 *               source_id:
 *                 type: string
 *                 description: Source identifier
 *                 example: "SRC456"
 *               list_id:
 *                 type: string
 *                 description: List identifier
 *                 example: "LIST789"
 *               phone_number:
 *                 type: string
 *                 description: Phone number
 *                 example: "+1234567890"
 *               security_phrase:
 *                 type: string
 *                 description: Security phrase
 *                 example: "SECURE123"
 *               comments:
 *                 type: string
 *                 description: Comments
 *                 example: "Customer interested in premium package"
 *               external_lead_id:
 *                 type: string
 *                 description: External lead identifier
 *                 example: "LEAD123"
 *               campaign:
 *                 type: string
 *                 description: Campaign name
 *                 example: "summer2024"
 *               phone_login:
 *                 type: string
 *                 description: Phone login
 *                 example: "LOGIN001"
 *               group:
 *                 type: string
 *                 description: Group identifier
 *                 example: "GROUP_A"
 *               SQLdate:
 *                 type: string
 *                 format: date-time
 *                 description: SQL date
 *                 example: "2023-01-15T10:30:00.000Z"
 *               epoch:
 *                 type: integer
 *                 description: Epoch timestamp
 *                 example: 1673782200
 *               uniqueid:
 *                 type: string
 *                 description: Unique identifier
 *                 example: "UNIQUE123"
 *               server_ip:
 *                 type: string
 *                 description: Server IP address
 *                 example: "192.168.1.100"
 *               SIPexten:
 *                 type: string
 *                 description: SIP extension
 *                 example: "SIP001"
 *               session_id:
 *                 type: string
 *                 description: Session identifier
 *                 example: "SESSION123"
 *               recording_filename:
 *                 type: string
 *                 description: Recording filename
 *                 example: "recording_001.wav"
 *               recording_id:
 *                 type: string
 *                 description: Recording identifier
 *                 example: "REC123"
 *               entry_date:
 *                 type: string
 *                 format: date-time
 *                 description: Entry date
 *                 example: "2023-01-15T10:30:00.000Z"
 *               called_count:
 *                 type: integer
 *                 description: Number of times called
 *                 example: 3
 *               agent_log_id:
 *                 type: string
 *                 description: Agent log identifier
 *                 example: "AGENT_LOG123"
 *               call_id:
 *                 type: string
 *                 description: Call identifier
 *                 example: "CALL123"
 *               user_group:
 *                 type: string
 *                 description: User group
 *                 example: "USER_GROUP_A"
 *               list_name:
 *                 type: string
 *                 description: List name
 *                 example: "Premium Leads"
 *               talk_time:
 *                 type: integer
 *                 description: Talk time in seconds
 *                 example: 300
 *               dispo:
 *                 type: string
 *                 description: Disposition
 *                 example: "ANSWERED"
 *               call_notes:
 *                 type: string
 *                 description: Call notes
 *                 example: "Customer was very interested"
 *               term_reason:
 *                 type: string
 *                 description: Termination reason
 *                 example: "CUSTOMER_HANGUP"
 *               callback_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Callback datetime
 *                 example: "2023-01-16T14:00:00.000Z"
 *               organizationId:
 *                 type: integer
 *                 description: Organization ID
 *                 example: 1
 *     responses:
 *       201:
 *         description: Call record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Call record created successfully"
 *                 call:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     user:
 *                       type: string
 *                       example: "agent001"
 *                     vendor_lead_code:
 *                       type: string
 *                       example: "VLC123"
 *                     source_id:
 *                       type: string
 *                       example: "SRC456"
 *                     list_id:
 *                       type: string
 *                       example: "LIST789"
 *                     phone_number:
 *                       type: string
 *                       example: "+1234567890"
 *                     security_phrase:
 *                       type: string
 *                       example: "SECURE123"
 *                     comments:
 *                       type: string
 *                       example: "Customer interested in premium package"
 *                     external_lead_id:
 *                       type: string
 *                       example: "LEAD123"
 *                     campaign:
 *                       type: string
 *                       example: "summer2024"
 *                     phone_login:
 *                       type: string
 *                       example: "LOGIN001"
 *                     group:
 *                       type: string
 *                       example: "GROUP_A"
 *                     SQLdate:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-01-15T10:30:00.000Z"
 *                     epoch:
 *                       type: integer
 *                       example: 1673782200
 *                     uniqueid:
 *                       type: string
 *                       example: "UNIQUE123"
 *                     server_ip:
 *                       type: string
 *                       example: "192.168.1.100"
 *                     SIPexten:
 *                       type: string
 *                       example: "SIP001"
 *                     session_id:
 *                       type: string
 *                       example: "SESSION123"
 *                     recording_filename:
 *                       type: string
 *                       example: "recording_001.wav"
 *                     recording_id:
 *                       type: string
 *                       example: "REC123"
 *                     entry_date:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-01-15T10:30:00.000Z"
 *                     called_count:
 *                       type: integer
 *                       example: 3
 *                     agent_log_id:
 *                       type: string
 *                       example: "AGENT_LOG123"
 *                     call_id:
 *                       type: string
 *                       example: "CALL123"
 *                     user_group:
 *                       type: string
 *                       example: "USER_GROUP_A"
 *                     list_name:
 *                       type: string
 *                       example: "Premium Leads"
 *                     talk_time:
 *                       type: integer
 *                       example: 300
 *                     dispo:
 *                       type: string
 *                       example: "ANSWERED"
 *                     call_notes:
 *                       type: string
 *                       example: "Customer was very interested"
 *                     term_reason:
 *                       type: string
 *                       example: "CUSTOMER_HANGUP"
 *                     callback_datetime:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-01-16T14:00:00.000Z"
 *                     organizationId:
 *                       type: integer
 *                       example: 1
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Permission denied
 */
// Create a new call record - Public route, no authentication required
router.post('/', [
  body('organizationId').isInt().withMessage('Organization ID must be an integer'),
  body('user').optional().isString().withMessage('User must be a string'),
  body('vendor_lead_code').optional().isString().withMessage('Vendor lead code must be a string'),
  body('source_id').optional().isString().withMessage('Source ID must be a string'),
  body('list_id').optional().isString().withMessage('List ID must be a string'),
  body('phone_number').optional().isString().withMessage('Phone number must be a string'),
  body('security_phrase').optional().isString().withMessage('Security phrase must be a string'),
  body('comments').optional().isString().withMessage('Comments must be a string'),
  body('external_lead_id').optional().isString().withMessage('External lead ID must be a string'),
  body('campaign').optional().isString().withMessage('Campaign must be a string'),
  body('phone_login').optional().isString().withMessage('Phone login must be a string'),
  body('group').optional().isString().withMessage('Group must be a string'),
  body('SQLdate').optional().isISO8601().withMessage('SQL date must be a valid ISO date'),
  body('epoch').optional().isInt().withMessage('Epoch must be an integer'),
  body('uniqueid').optional().isString().withMessage('Unique ID must be a string'),
  body('server_ip').optional().isString().withMessage('Server IP must be a string'),
  body('SIPexten').optional().isString().withMessage('SIP extension must be a string'),
  body('session_id').optional().isString().withMessage('Session ID must be a string'),
  body('recording_filename').optional().isString().withMessage('Recording filename must be a string'),
  body('recording_id').optional().isString().withMessage('Recording ID must be a string'),
  body('entry_date').optional().isISO8601().withMessage('Entry date must be a valid ISO date'),
  body('called_count').optional().isInt({ min: 0 }).withMessage('Called count must be a positive integer'),
  body('agent_log_id').optional().isString().withMessage('Agent log ID must be a string'),
  body('call_id').optional().isString().withMessage('Call ID must be a string'),
  body('user_group').optional().isString().withMessage('User group must be a string'),
  body('list_name').optional().isString().withMessage('List name must be a string'),
  body('talk_time').optional().isInt({ min: 0 }).withMessage('Talk time must be a positive integer'),
  body('dispo').optional().isString().withMessage('Disposition must be a string'),
  body('call_notes').optional().isString().withMessage('Call notes must be a string'),
  body('term_reason').optional().isString().withMessage('Termination reason must be a string'),
  body('callback_datetime').optional().isISO8601().withMessage('Callback datetime must be a valid ISO date')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { 
      user,
      vendor_lead_code,
      source_id,
      list_id,
      phone_number,
      security_phrase,
      comments,
      external_lead_id,
      campaign,
      phone_login,
      group,
      SQLdate,
      epoch,
      uniqueid,
      server_ip,
      SIPexten,
      session_id,
      recording_filename,
      recording_id,
      entry_date,
      called_count,
      agent_log_id,
      call_id,
      user_group,
      list_name,
      talk_time,
      dispo,
      call_notes,
      term_reason,
      callback_datetime,
      organizationId
    } = req.body;

    // Verify organization exists
    const organization = await prisma.organization.findFirst({
      where: {
        id: Number(organizationId)
      }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const call = await prisma.call.create({
      data: {
        user: user || null,
        vendor_lead_code: vendor_lead_code || null,
        source_id: source_id || null,
        list_id: list_id || null,
        phone_number: phone_number || null,
        security_phrase: security_phrase || null,
        comments: comments || null,
        external_lead_id: external_lead_id || null,
        campaign: campaign || null,
        phone_login: phone_login || null,
        group: group || null,
        SQLdate: SQLdate ? new Date(SQLdate) : null,
        epoch: epoch ? BigInt(epoch) : null,
        uniqueid: uniqueid || null,
        server_ip: server_ip || null,
        SIPexten: SIPexten || null,
        session_id: session_id || null,
        recording_filename: recording_filename || null,
        recording_id: recording_id || null,
        entry_date: entry_date ? new Date(entry_date) : null,
        called_count: called_count ? Number(called_count) : null,
        agent_log_id: agent_log_id || null,
        call_id: call_id || null,
        user_group: user_group || null,
        list_name: list_name || null,
        talk_time: talk_time ? Number(talk_time) : null,
        dispo: dispo || null,
        call_notes: call_notes || null,
        term_reason: term_reason || null,
        callback_datetime: callback_datetime ? new Date(callback_datetime) : null,
        organizationId: Number(organizationId)
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json(serializeBigInt({
      message: 'Call record created successfully',
      call
    }));
  } catch (error) {
    next(error);
  }
});

module.exports = router; 