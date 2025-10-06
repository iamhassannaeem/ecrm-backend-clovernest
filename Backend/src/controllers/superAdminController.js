const { prisma } = require('../config/database');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');
const bcrypt = require('bcrypt');

exports.getAnalytics = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalOrganizations,
      recentUsers,
      recentOrganizations
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.organization.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } })
    ]);
    res.json({
      analytics: {
        totalUsers,
        totalOrganizations,
        recentUsers,
        recentOrganizations,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (page - 1) * limit;
    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (status) {
      where.isActive = status === 'active';
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { 
            select: {
              name: true
            }
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);
   
    const usersWithDisplayRole = users.map(user => ({
      ...user,
      displayRole: user.roles.length > 0 ? user.roles[0].name : null
    }));
    res.json({
      users: usersWithDisplayRole,
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

exports.getOrganizations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (page - 1) * limit;
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (status) {
      where.status = status.toUpperCase();
    }
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          users: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, createdAt: true, roles: { select: { name: true } } } },
          _count: { select: { users: true } },
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.organization.count({ where })
    ]);
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
};

exports.createOrganization = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const {
      name,
      domain,
      description,
      website,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName
    } = req.body;
    const existingAdmin = await prisma.user.findFirst({ 
      where: { 
        email: {
          equals: adminEmail,
          mode: 'insensitive'
        }
      }
    });
    if (existingAdmin) {
      return res.status(409).json({ error: 'Admin user with this email already exists' });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          domain,
          description,
          website,
          isActive: true,
          createdById: req.user.id,

        },
        include: {
          roles: true
        }
      });
      
      const orgAdminRole = await tx.role.create({
        data: {
          name: 'ORGANIZATION_ADMIN',
          description: 'Full access to organization settings and user management',
          organizationId: organization.id
        }
      });
     
      const orgAdminUser = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: adminFirstName,
          lastName: adminLastName,
          isActive: true,
          organizationId: organization.id, 
          roles: { 
            connect:[
               {
              id: orgAdminRole.id
            }
          ]
          }
        },
        include: {
          roles: true
        }
      });
      
      return { organization, admin: orgAdminUser };
    });
    await req.createAuditLog({
      action: AUDIT_ACTIONS.CREATE_ORGANIZATION,
      resource: AUDIT_RESOURCES.ORGANIZATION,
      resourceId: result.organization.id,
      newValues: {
        organizationId: result.organization.id,
        organizationName: result.organization.name,
      
        adminEmail: result.admin.email
      },
      userId: req.user.id,
      organizationId: result.organization.id,
      userRole: req.userRole,
      role: req.user.roles[0].name,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(201).json({
      message: 'Organization created successfully',
      organization: result.organization,
      admin: result.admin
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean value' });
    }
    if (userId === req.user.id && !isActive) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true }
    });
    await req.createAuditLog({
      action: isActive ? AUDIT_ACTIONS.ACTIVATE_USER : AUDIT_ACTIONS.DEACTIVATE_USER,
      resource: AUDIT_RESOURCES.USER,
      resourceId: userId,
      newValues: { isActive }
    });
    res.json({ message: `User ${isActive ? 'activated' : 'suspended'} successfully`, user });
  } catch (error) {
    next(error);
  }
};

exports.updateOrganizationStatus = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { status } = req.body;
    const validStatuses = ['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: { status },
      select: { id: true, name: true, slug: true, status: true }
    });
    await req.createAuditLog({
      action: AUDIT_ACTIONS.UPDATE_ORGANIZATION_STATUS,
      resource: AUDIT_RESOURCES.ORGANIZATION,
      resourceId: organizationId,
      newValues: { status },
      organizationId
    });
    res.json({ message: 'Organization status updated successfully', organization });
  } catch (error) {
    next(error);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, resource, userId, organizationId } = req.query;
    const skip = (page - 1) * limit;
    const where = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;
    if (organizationId) where.organizationId = organizationId;
    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          organization: { select: { id: true, name: true, slug: true } }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ]);
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