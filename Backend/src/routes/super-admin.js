const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const { authenticateToken, requireSuperAdmin, requireSystemPermission } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');
const bcrypt = require('bcrypt');
const { getAnalytics, getUsers, getOrganizations, createOrganization, updateUserStatus, updateOrganizationStatus, getAuditLogs } = require('../controllers/superAdminController');

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get('/analytics', requireSystemPermission('READ', 'PLATFORM_ANALYTICS'), getAnalytics);


router.get('/users', requireSystemPermission('READ', 'PLATFORM_USERS'), getUsers);

router.post(
  '/store-test-users',
  requireSystemPermission('CREATE', 'PLATFORM_USERS'),
  [
    body('organizationId').isInt().withMessage('organizationId is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').optional().trim().isLength({ max: 50 }),
    body('lastName').optional().trim().isLength({ max: 50 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const organizationId = Number(req.body.organizationId);
      const email = String(req.body.email).trim();
      const password = String(req.body.password);
      const firstName = req.body.firstName != null ? String(req.body.firstName).trim() : null;
      const lastName = req.body.lastName != null ? String(req.body.lastName).trim() : null;

      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, isActive: true },
      });
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      if (organization.isActive === false) {
        return res.status(400).json({ error: 'Organization is inactive' });
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          organizationId: organizationId,
        },
        select: { id: true },
      });
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists in this organization' });
      }

      const hashedPassword = await hashPassword(password);

      const created = await prisma.$transaction(async (tx) => {
        // Ensure USER role exists for this org
        let userRole = await tx.role.findFirst({
          where: { organizationId, name: 'USER' },
          select: { id: true },
        });
        if (!userRole) {
          userRole = await tx.role.create({
            data: { organizationId, name: 'USER', description: 'Default user role' },
            select: { id: true },
          });
        }

        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            isActive: true,
            organizationId,
            isStoreTestUser: true,
            roles: { connect: [{ id: userRole.id }] },
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            isStoreTestUser: true,
            organizationId: true,
            createdAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'CREATE_STORE_TEST_USER',
            resource: 'USER',
            resourceId: user.id,
            newValues: { organizationId, email, isStoreTestUser: true },
            userId: req.user.id,
            organizationId,
          },
        });

        return user;
      });

      return res.status(201).json({
        message: 'Store test user created successfully',
        user: created,
      });
    } catch (error) {
      return next(error);
    }
  }
);

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

router.get('/organizations', requireSystemPermission('READ', 'PLATFORM_ORGANIZATIONS'), getOrganizations);

router.patch('/users/:userId/status', requireSystemPermission('MANAGE', 'PLATFORM_USERS'), updateUserStatus);


router.patch('/organizations/:organizationId/status', requireSystemPermission('MANAGE', 'PLATFORM_ORGANIZATIONS'), updateOrganizationStatus);

router.get('/audit-logs', requireSystemPermission('READ', 'PLATFORM_AUDIT_LOGS'), getAuditLogs);

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

router.get('/organizations/:organizationId/org-admin-permissions', requireSuperAdmin, async (req, res, next) => {
  try {
    let { organizationId } = req.params;
    organizationId = parseInt(organizationId, 10);
    const orgAdminRole = await prisma.role.findFirst({
      where: {
        organizationId: organizationId,
        name: 'ORGANIZATION_ADMIN'
      }
    });
    if (!orgAdminRole) {
      return res.status(404).json({ error: 'Organization Admin role not found for this organization' });
    }
    const permissions = await prisma.rolePermission.findMany({
      where: { roleId: orgAdminRole.id },
      select: { action: true, resource: true }
    });
    res.json({ permissions });
  } catch (error) {
    next(error);
  }
});

router.patch('/organizations/:organizationId/card-validation', requireSystemPermission('MANAGE', 'PLATFORM_ORGANIZATIONS'), async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { enableCardValidation } = req.body;
    
    if (typeof enableCardValidation !== 'boolean') {
      return res.status(400).json({ error: 'enableCardValidation must be a boolean value' });
    }
    
    const organization = await prisma.organization.update({
      where: { id: parseInt(organizationId, 10) },
      data: { enableCardValidation },
      select: { id: true, name: true, enableCardValidation: true }
    });
    
    res.json({ 
      message: 'Card validation setting updated successfully', 
      organization 
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/organizations/:organizationId/mobile-app', requireSystemPermission('MANAGE', 'PLATFORM_ORGANIZATIONS'), async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { mobileAppEnabled } = req.body;

    if (typeof mobileAppEnabled !== 'boolean') {
      return res.status(400).json({ error: 'mobileAppEnabled must be a boolean value' });
    }

    const organization = await prisma.organization.update({
      where: { id: parseInt(organizationId, 10) },
      data: { mobileAppEnabled },
      select: { id: true, name: true, mobileAppEnabled: true }
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_ORGANIZATION_MOBILE_APP',
        resource: 'ORGANIZATION',
        resourceId: parseInt(organizationId, 10),
        newValues: { mobileAppEnabled },
        userId: req.user.id,
      },
    });

    res.json({
      message: `Mobile app ${mobileAppEnabled ? 'enabled' : 'disabled'} successfully`,
      organization,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
