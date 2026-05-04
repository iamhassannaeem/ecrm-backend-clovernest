const { DateTime } = require('luxon');
const { prisma } = require('../config/database');
const PermissionService = require('../services/permissionService');

function isSuperAdminUser(user) {
  if (!user) return false;
  return (
    user.systemRole === 'SUPER_ADMIN' ||
    (user.roles &&
      user.roles.some((r) => r.name === 'SUPER_ADMIN' || r.name === 'Super Admin'))
  );
}

function hasOrganizationAdminRole(user) {
  return Boolean(
    user?.roles && user.roles.some((r) => r.name === 'ORGANIZATION_ADMIN')
  );
}

/** Full org row (incl. sensitive fields) — org admin, org-settings permission, super admin, etc. */
function canReadFullOrganizationRecord(user) {
  if (isSuperAdminUser(user)) return true;
  if (hasOrganizationAdminRole(user)) return true;
  if (!user || !user.permissions) return false;
  return user.permissions.some(
    (p) =>
      (p.action === 'ALL' && p.resource === 'ALL') ||
      (p.resource === 'ORGANIZATION_SETTINGS' &&
        ['READ', 'UPDATE', 'MANAGE'].includes(p.action))
  );
}

/** Branding, locale, and chat UI fields for normal members without org-settings permission */
function toMemberOrganizationView(org) {
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    domain: org.domain,
    description: org.description,
    logo: org.logo,
    website: org.website,
    currency: org.currency,
    language: org.language,
    timeZone: org.timeZone,
    chatDisplayMode: org.chatDisplayMode,
    isActive: org.isActive
  };
}

exports.getOrganizationById = async (req, res, next) => {
  try {
    const organizationId = parseInt(req.params.organizationId, 10);
    
    if (isNaN(organizationId)) {
      return res.status(400).json({ error: 'Invalid organization ID' });
    }

    if (!PermissionService.canAccessOrganization(req.user, organizationId)) {
      return res.status(403).json({
        error: 'You don\'t have permission to access this organization. Required organization permissions.',
        code: 'PERMISSION_DENIED'
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!canReadFullOrganizationRecord(req.user)) {
      return res.json({ organization: toMemberOrganizationView(organization) });
    }

    let filteredOrganizations = await PermissionService.filterOrganizations(req.user, [organization]);

    if (
      filteredOrganizations.length === 0 &&
      Number(req.user.organizationId) === organizationId
    ) {
      filteredOrganizations = [organization];
    }

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

exports.getLeadAssignmentMode = async (req, res, next) => {
  try {
    const organizationId = Number(req.params.organizationId);
    
    if (!PermissionService.canAccessOrganization(req.user, organizationId)) {
      return res.status(403).json({
        error: 'You don\'t have access to this organization',
        code: 'ORG_ACCESS_DENIED'
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        leadAssignmentMode: true,
        roleBasedAssignmentRoleId: true,
        leadFormLayout: true
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      leadAssignmentMode: organization.leadAssignmentMode || 'MANUAL',
      roleBasedAssignmentRoleId: organization.roleBasedAssignmentRoleId,
      leadFormLayout: organization.leadFormLayout || 'SINGLE_PAGE'
    });
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

    const { name, description, website, currency, language, logoUrl, leadAssignmentMode, roleBasedAssignmentRoleId, leadFormLayout, transcriptionMode, chatDisplayMode, timeZone } = req.body;
    
    if (leadAssignmentMode === 'ROLE_BASED' && roleBasedAssignmentRoleId) {
      const role = await prisma.role.findFirst({
        where: {
          id: parseInt(roleBasedAssignmentRoleId),
          organizationId: Number(req.params.organizationId),
          isActive: true
        }
      });
      
      if (!role) {
        return res.status(400).json({ error: 'Invalid role for role-based assignment' });
      }
    }
    
    if (transcriptionMode !== undefined && transcriptionMode !== null && !['TRANSCRIBE_ONLY', 'FULL_EVALUATION'].includes(transcriptionMode)) {
      return res.status(400).json({ error: 'transcriptionMode must be TRANSCRIBE_ONLY or FULL_EVALUATION' });
    }
    
    if (chatDisplayMode !== undefined && chatDisplayMode !== null && !['FULLSCREEN', 'CHATBOX'].includes(chatDisplayMode)) {
      return res.status(400).json({ error: 'chatDisplayMode must be FULLSCREEN or CHATBOX' });
    }

    if (timeZone !== undefined) {
      const raw = timeZone === null || timeZone === '' ? '' : String(timeZone).trim();
      if (raw && !DateTime.now().setZone(raw).isValid) {
        return res.status(400).json({ error: 'Invalid IANA time zone (e.g. America/New_York)' });
      }
    }
    
    const updateData = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(website !== undefined && { website }),
      ...(currency !== undefined && { currency }),
      ...(language !== undefined && { language }),
      ...(logoUrl && { logo: logoUrl }),
      ...(leadAssignmentMode && { leadAssignmentMode }),
      ...(roleBasedAssignmentRoleId !== undefined && { roleBasedAssignmentRoleId: roleBasedAssignmentRoleId ? parseInt(roleBasedAssignmentRoleId) : null }),
      ...(leadFormLayout && { leadFormLayout }),
      ...(transcriptionMode !== undefined && { transcriptionMode }),
      ...(chatDisplayMode !== undefined && { chatDisplayMode }),
      ...(timeZone !== undefined && {
        timeZone:
          timeZone === null || timeZone === '' ? 'America/New_York' : String(timeZone).trim()
      })
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

exports.getWhitelisting = async (req, res, next) => {
  try {
    const organizationId = Number(req.params.organizationId);
    if (!PermissionService.canAccessOrganization(req.user, organizationId)) {
      return res.status(403).json({ error: 'Permission denied', code: 'PERMISSION_DENIED' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        allowedIps: true,
        allowedIpLabels: true,
        mobileAppEnabled: true,
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    return res.json({
      organizationId: organization.id,
      allowed_ips: organization.allowedIps || [],
      allowed_ip_labels: organization.allowedIpLabels || {},
      mobile_app_enabled: !!organization.mobileAppEnabled,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateWhitelisting = async (req, res, next) => {
  try {
    const organizationId = Number(req.params.organizationId);
    if (!PermissionService.canAccessOrganization(req.user, organizationId)) {
      return res.status(403).json({ error: 'Permission denied', code: 'PERMISSION_DENIED' });
    }

    const { allowed_ips, allowed_ip_labels } = req.body || {};
    if (!Array.isArray(allowed_ips)) {
      return res.status(400).json({ error: 'allowed_ips must be an array' });
    }

    const normalized = allowed_ips
      .map((x) => String(x).trim())
      .filter(Boolean);

    const nextLabelsRaw =
      allowed_ip_labels && typeof allowed_ip_labels === 'object' && !Array.isArray(allowed_ip_labels)
        ? allowed_ip_labels
        : {};

    const normalizedLabels = {};
    for (const ip of normalized) {
      const label = nextLabelsRaw[ip];
      if (label == null) continue;
      const s = String(label).trim();
      if (!s) continue;
      normalizedLabels[ip] = s;
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: { allowedIps: normalized, allowedIpLabels: normalizedLabels },
      select: { id: true, allowedIps: true, allowedIpLabels: true, mobileAppEnabled: true },
    });

    return res.json({
      message: 'Whitelisting updated successfully',
      organizationId: organization.id,
      allowed_ips: organization.allowedIps || [],
      allowed_ip_labels: organization.allowedIpLabels || {},
      mobile_app_enabled: !!organization.mobileAppEnabled,
    });
  } catch (error) {
    next(error);
  }
};

exports.listMobileDevices = async (req, res, next) => {
  try {
    const organizationId = Number(req.params.organizationId);
    if (!PermissionService.canAccessOrganization(req.user, organizationId)) {
      return res.status(403).json({ error: 'Permission denied', code: 'PERMISSION_DENIED' });
    }

    const status = String(req.query.status || 'all').toLowerCase();
    const where = {
      organizationId,
      ...(status === 'pending' ? { isApproved: false } : {}),
      ...(status === 'approved' ? { isApproved: true } : {}),
    };

    const devices = await prisma.mobileDevice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        platform: true,
        isApproved: true,
        allowedIps: true,
        applyOrgIps: true,
        applyUserIps: true,
        lastIp: true,
        createdAt: true,
        approvedAt: true,
        userId: true,
      },
    });

    return res.json({ devices });
  } catch (error) {
    next(error);
  }
};
