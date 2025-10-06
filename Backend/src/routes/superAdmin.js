const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Super Admin
 *   description: Platform-wide administration and analytics endpoints
 */

// All routes require super admin authentication
router.use(authenticateToken);
router.use(requireSuperAdmin);

/**
 * @swagger
 * /api/super-admin/stats:
 *   get:
 *     summary: Get comprehensive platform statistics
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Get detailed analytics and statistics for the entire platform
 *     responses:
 *       200:
 *         description: Platform statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 1250 }
 *                         active: { type: integer, example: 1180 }
 *                         newToday: { type: integer, example: 15 }
 *                         newThisWeek: { type: integer, example: 85 }
 *                         newThisMonth: { type: integer, example: 320 }
 *                     organizations:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 150 }
 *                         active: { type: integer, example: 142 }
 *                         trial: { type: integer, example: 25 }
 *                         suspended: { type: integer, example: 3 }
 *                         newThisMonth: { type: integer, example: 12 }
 *                     subscriptions:
 *                       type: object
 *                       properties:
 *                         active: { type: integer, example: 125 }
 *                         trialing: { type: integer, example: 18 }
 *                         pastDue: { type: integer, example: 5 }
 *                         cancelled: { type: integer, example: 8 }
 *                     revenue:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 125000, description: 'Total revenue in cents' }
 *                         thisMonth: { type: integer, example: 15000 }
 *                         lastMonth: { type: integer, example: 12500 }
 *                         growth: { type: number, example: 20.5, description: 'Growth percentage' }
 *                     activity:
 *                       type: object
 *                       properties:
 *                         totalActions: { type: integer, example: 25000 }
 *                         todayActions: { type: integer, example: 450 }
 *                         weekActions: { type: integer, example: 2800 }
 *       403:
 *         description: Super admin access required
 */
// Get platform statistics
router.get('/stats', async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      // User statistics
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,

      // Organization statistics
      totalOrganizations,
      activeOrganizations,
      trialOrganizations,
      suspendedOrganizations,
      newOrganizationsMonth,

      // Subscription statistics
      activeSubscriptions,
      trialingSubscriptions,
      pastDueSubscriptions,
      cancelledSubscriptions,

      // Revenue statistics
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,

      // Activity statistics
      totalActions,
      todayActions,
      weekActions
    ] = await Promise.all([
      // Users
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),

      // Organizations
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.count({ where: { status: 'TRIAL' } }),
      prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      prisma.organization.count({ where: { createdAt: { gte: monthStart } } }),

      // Subscriptions
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'TRIALING' } }),
      prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
      prisma.subscription.count({ where: { status: 'CANCELLED' } }),

      // Revenue
      prisma.payment.aggregate({
        where: { status: 'succeeded' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: monthStart }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd }
        },
        _sum: { amount: true }
      }),

      // Activity
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: weekStart } } })
    ]);

    // Calculate revenue growth
    const thisMonth = thisMonthRevenue._sum.amount || 0;
    const lastMonth = lastMonthRevenue._sum.amount || 0;
    const revenueGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    res.json({
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newToday: newUsersToday,
          newThisWeek: newUsersWeek,
          newThisMonth: newUsersMonth
        },
        organizations: {
          total: totalOrganizations,
          active: activeOrganizations,
          trial: trialOrganizations,
          suspended: suspendedOrganizations,
          newThisMonth: newOrganizationsMonth
        },
        subscriptions: {
          active: activeSubscriptions,
          trialing: trialingSubscriptions,
          pastDue: pastDueSubscriptions,
          cancelled: cancelledSubscriptions
        },
        revenue: {
          total: totalRevenue._sum.amount || 0,
          thisMonth: thisMonth,
          lastMonth: lastMonth,
          growth: Math.round(revenueGrowth * 100) / 100
        },
        activity: {
          totalActions,
          todayActions,
          weekActions
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all organizations
router.get('/organizations', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', status } = req.query;
    const skip = (page - 1) * limit;

    const whereClause = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(status && { status })
    };

    const organizations = await prisma.organization.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        members: {
          where: { isActive: true },
          select: { id: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.organization.count({ where: whereClause });

    res.json({
      organizations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update organization status
router.put('/organizations/:organizationId/status', [
  body('status').isIn(['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { organizationId } = req.params;
    const { status } = req.body;

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: { status },
      include: {
        members: {
          where: { isActive: true },
          select: { id: true, role: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_ORGANIZATION_STATUS',
        resource: 'ORGANIZATION',
        resourceId: organizationId,
        newValues: { status },
        userId: req.user.id
      }
    });

    res.json({
      message: 'Organization status updated successfully',
      organization
    });
  } catch (error) {
    next(error);
  }
});

// Get all users
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', isActive } = req.query;
    const skip = (page - 1) * limit;

    const whereClause = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(isActive !== undefined && { isActive: isActive === 'true' })
    };

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        emailVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        organization_users: {
          where: { isActive: true },
          include: {
            organizations: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.user.count({ where: whereClause });

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user status
router.put('/users/:userId/status', [
  body('isActive').isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId } = req.params;
    const { isActive } = req.body;

    // Prevent deactivating super admin (yourself)
    if (!isActive && userId === req.user.id) {
      return res.status(400).json({
        error: 'Cannot deactivate your own account'
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        resource: 'USER',
        resourceId: userId,
        newValues: { isActive },
        userId: req.user.id
      }
    });

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    next(error);
  }
});

// Get all subscriptions
router.get('/subscriptions', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const whereClause = {
      ...(status && { status })
    };

    const subscriptions = await prisma.subscription.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.subscription.count({ where: whereClause });

    res.json({
      subscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get platform audit logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, resource, userId } = req.query;
    const skip = (page - 1) * limit;

    const whereClause = {
      ...(action && { action }),
      ...(resource && { resource }),
      ...(userId && { userId })
    };

    const auditLogs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        organization: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.auditLog.count({ where: whereClause });

    res.json({
      auditLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/super-admin/organizations/{organizationId}/analytics:
 *   get:
 *     summary: Get organization analytics
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *     responses:
 *       200:
 *         description: Organization analytics
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
 *                     status:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     activityTrends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           actions:
 *                             type: integer
 *                     totalActions:
 *                       type: integer
 *                     activeSubscription:
 *                       type: object
 */
// Get organization analytics
router.get('/organizations/:organizationId/analytics', async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100
        }
      }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Calculate activity trends
    const activityTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const actions = organization.auditLogs.filter(log =>
        log.createdAt >= dayStart && log.createdAt < dayEnd
      ).length;

      activityTrends.push({
        date: dayStart.toISOString().split('T')[0],
        actions
      });
    }

    res.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        createdAt: organization.createdAt
      },
      analytics: {
        activityTrends,
        totalActions: organization.auditLogs.length,
        activeSubscription: organization.subscriptions.find(s =>
          ['ACTIVE', 'TRIALING'].includes(s.status)
        )
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
