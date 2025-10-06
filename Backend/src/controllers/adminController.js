// Get organization dashboard data
exports.getDashboard = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
     
    });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const recentActivity = await prisma.auditLog.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
 
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const activityStats = {
      totalActions: await prisma.auditLog.count({ where: { organizationId } }),
      todayActions: await prisma.auditLog.count({
        where: {
          organizationId,
          createdAt: { gte: todayStart }
        }
      }),
      weekActions: await prisma.auditLog.count({
        where: {
          organizationId,
          createdAt: { gte: weekStart }
        }
      })
    };
    res.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        description: organization.description,
        logo: organization.logo,
        website: organization.website,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      },
      analytics: {
        activityStats,

        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
};


exports.getAuditLogs = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { page = 1, limit = 50, action, resource } = req.query;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const skip = (page - 1) * limit;
    const whereClause = {
      organizationId,
      ...(action && { action }),
      ...(resource && { resource })
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
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });
    const total = await prisma.auditLog.count({
      where: whereClause
    });
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
}; 