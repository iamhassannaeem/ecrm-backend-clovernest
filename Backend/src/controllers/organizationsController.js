const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PermissionService = require('../services/permissionService');

exports.getOrganizationById = async (req, res, next) => {
  try {
    if (!PermissionService.canAccessOrganization(req.user, req.params.organizationId)) {
      return res.status(403).json({
        error: 'You don\'t have permission to access this organization. Required organization permissions.',
        code: 'PERMISSION_DENIED'
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: req.params.organizationId },
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const filteredOrganizations = await PermissionService.filterOrganizations(req.user, [organization]);
    
    if (filteredOrganizations.length === 0) {
      return res.status(403).json({
        error: 'You don\'t have permission to view this organization. Required organization permissions.',
        code: 'PERMISSION_DENIED'
      });
    }

    res.json({ organization: filteredOrganizations[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateOrganization = async (req, res, next) => {
  try {
    if (!PermissionService.hasPermission(req.user, 'UPDATE', 'ORGANIZATION_SETTINGS') && 
        !PermissionService.hasPermission(req.user, 'MANAGE', 'ORGANIZATION_SETTINGS')) {
      return res.status(403).json({
        error: 'You don\'t have permission to update organization settings. Required organization permissions.',
        code: 'PERMISSION_DENIED'
      });
    }
    if (!PermissionService.canAccessOrganization(req.user, req.params.organizationId)) {
      return res.status(403).json({
        error: 'You don\'t have permission to access this organization. Required organization permissions.',
        code: 'PERMISSION_DENIED'
      });
    }

    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { name, description, website, currency, language } = req.body;
    let logoPath;
    if (req.file) {
      logoPath = req.file.path;
    }
    
    const updateData = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(website !== undefined && { website }),
      ...(currency !== undefined && { currency }),
      ...(language !== undefined && { language }),
      ...(logoPath && { logo: logoPath })
    };
    
    const organization = await prisma.organization.update({
      where: { id: Number(req.params.organizationId) },
      data: updateData
    });
    
    res.json({ message: 'Organization updated successfully', organization });
  } catch (error) {
    next(error);
  }
}; 