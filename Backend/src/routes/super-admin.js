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

module.exports = router;
