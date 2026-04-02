const { prisma } = require('../config/database');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../utils/audit');
const bcrypt = require('bcryptjs');

const { createAuditLog } = require('../utils/audit');
const { validatePasswordStrength, hashPassword } = require('../utils/password');


exports.createUser = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { email, password, firstName, lastName, roleId, extension, phoneNumber, bio, reportToId } = req.body;
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: 'Password does not meet requirements', details: passwordValidation.errors });
    }
    const organizationId = req.organizationId;
    const existingUser = await prisma.user.findFirst({ 
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    const roleIdInt = typeof roleId === 'string' ? parseInt(roleId, 10) : roleId;
    const role = await prisma.role.findFirst({ where: { id: roleIdInt, organizationId, isActive: true } });
    if (!role) {
      return res.status(400).json({ error: 'Invalid role ID' });
    }
    
    let validatedReportToId = null;
    if (reportToId) {
      const reportToIdInt = typeof reportToId === 'string' ? parseInt(reportToId, 10) : reportToId;
      const reportToUser = await prisma.user.findFirst({
        where: {
          id: reportToIdInt,
          organizationId,
          isDeleted: false,
          roles: {
            some: {
              isAgent: false
            }
          }
        },
        include: { roles: true }
      });
      
      if (!reportToUser) {
        return res.status(400).json({ error: 'Invalid reportTo user - must be a team lead (isAgent: false)' });
      }
      validatedReportToId = reportToIdInt;
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phoneNumber,
          extension,
          bio,
          isActive: true,
          organizationId,
          reportToId: validatedReportToId,
          roles: { connect: { id: roleIdInt } }
        }
      });
      return { user };
    });
    await createAuditLog({
      action: AUDIT_ACTIONS.CREATE_USER,
      resource: AUDIT_RESOURCES.USER,
      resourceId: result.user.id,
      newValues: { userId: result.user.id, userEmail: result.user.email, roleId, organizationId },
      user: req.user, 
      organizationId,
      userRole: req.userRole,
      systemRole: req.systemRole,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    // Fetch the custom role name for response
    const customRoleId = typeof roleId === 'string' ? parseInt(roleId, 10) : roleId;
    const customRole = await prisma.role.findUnique({
      where: { id: customRoleId }
    });
    // Fetch organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: customRole.name,
        organization
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { userId } = req.params;
    const { roleId, permissions } = req.body;
    const organizationId = req.organizationId;
    const orgUser = await prisma.user.findUnique({ 
      where: { 
        id: userId, 
        organizationId,
        isDeleted: false // Only allow updates for non-deleted users
      } 
    });
    if (!orgUser) {
      return res.status(404).json({ error: 'User not found in organization or user is deleted' });
    }
    let newRoleName = null;
    if (roleId) {
      const role = await prisma.role.findFirst({ where: { id: roleId, organizationId, isActive: true } });
      if (!role) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }
      newRoleName = role.name;
    }
    await prisma.$transaction(async (tx) => {
      if (roleId) {
          await tx.user.update({ where: { id: orgUser.id }, data: { roleId } });
      }
     
    });
    await createAuditLog({ action: AUDIT_ACTIONS.UPDATE_USER_ROLE, resource: AUDIT_RESOURCES.USER_ROLES, resourceId: userId, oldValues: { roleId: orgUser.roleId, permissions: orgUser.permissions }, newValues: { roleId, permissions }, userId: req.user.id, organizationId, userRole: req.userRole, systemRole: req.systemRole, ipAddress: req.ip, userAgent: req.get('User-Agent') });
    res.json({ message: 'User role updated successfully', role: newRoleName });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { userId } = req.params;
    const { isActive } = req.body;
    const organizationId = req.organizationId;
    const orgUser = await prisma.user.findUnique({ 
      where: { 
        id: userId, 
        organizationId,
        isDeleted: false 
      } 
    });
    if (!orgUser) {
      return res.status(404).json({ error: 'User not found in organization or user is deleted' });
    }
    await prisma.user.update({ where: { id: orgUser.id }, data: { isActive } });
    await createAuditLog({ action: AUDIT_ACTIONS.UPDATE_USER_STATUS, resource: AUDIT_RESOURCES.USER_STATUS, resourceId: userId, oldValues: { isActive: orgUser.isActive }, newValues: { isActive }, userId: req.user.id, organizationId, userRole: req.userRole, systemRole: req.systemRole, ipAddress: req.ip, userAgent: req.get('User-Agent') });
    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.createRole = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { name, description, isAgent,  permissions } = req.body;
    const organizationId = req.organizationId;
    
    if (name === 'ORGANIZATION_ADMIN') {
      return res.status(403).json({ 
        error: 'Cannot create ORGANIZATION_ADMIN role', 
        message: 'The ORGANIZATION_ADMIN role is automatically created and cannot be manually created.' 
      });
    }
    
    const existingRole = await prisma.role.findFirst({ where: { name, organizationId } });
    if (existingRole) {
      return res.status(409).json({ error: 'Role with this name already exists in organization' });
    }
    const result = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { name, description, organizationId, isAgent } });
      if (permissions && permissions.length > 0) {
        const rolePermissions = permissions.map(perm => ({
          action: perm.action,
          resource: perm.resource,
          roleId: role.id,
          organizationId: organizationId
        }));
        await tx.rolePermission.createMany({ data: rolePermissions });
      }
      return role;
    });
    const createdRole = await prisma.role.findUnique({
      where: { id: result.id },
      include: { rolePermissions: true }
    });
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        description: true,
        logo: true,
        website: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        
      }
    });
    await createAuditLog({ action: AUDIT_ACTIONS.CREATE_ROLE, resource: AUDIT_RESOURCES.USER_ROLES, resourceId: result.id, newValues: { roleId: result.id, roleName: result.name, permissions }, userId: req.user.id, organizationId, userRole: req.userRole, systemRole: req.systemRole, ipAddress: req.ip, userAgent: req.get('User-Agent') });
    res.status(201).json({ message: 'Role created successfully', role: createdRole, organization });
  } catch (error) {
    next(error);
  }
};

exports.getOrganizationUsers = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const users = await prisma.user.findMany({
      where: { 
        organizationId: Number(organizationId),
        isDeleted: false 
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        allowedIps: true,
        allowedIpLabels: true,
        phoneNumber: true,  
        extension: true,
        bio: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        reportToId: true,
        roles: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            currency: true,
            language: true,
            logo: true
          }
        }
      }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
}; 

exports.getUserAllowedIps = async (req, res, next) => {
  try {
    const organizationId = Number(req.organizationId);
    const userId = Number(req.params.userId);
    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'Organization ID and userId are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        isDeleted: false
      },
      select: {
        id: true,
        email: true,
        allowedIps: true,
        allowedIpLabels: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      userId: user.id,
      email: user.email,
      allowed_ips: user.allowedIps || [],
      allowed_ip_labels: user.allowedIpLabels || {},
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserAllowedIps = async (req, res, next) => {
  try {
    const organizationId = Number(req.organizationId);
    const userId = Number(req.params.userId);
    const { allowed_ips, allowed_ip_labels } = req.body || {};

    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'Organization ID and userId are required' });
    }
    if (!Array.isArray(allowed_ips)) {
      return res.status(400).json({ error: 'allowed_ips must be an array' });
    }

    const normalized = allowed_ips.map((x) => String(x).trim()).filter(Boolean);

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

    const user = await prisma.user.update({
      where: { id: userId },
      data: { allowedIps: normalized, allowedIpLabels: normalizedLabels },
      select: { id: true, email: true, allowedIps: true, allowedIpLabels: true, organizationId: true }
    });

    if (Number(user.organizationId) !== organizationId) {
      return res.status(403).json({ error: 'Unauthorized access', code: 'PERMISSION_DENIED' });
    }

    return res.json({
      message: 'User IP whitelist updated',
      userId: user.id,
      email: user.email,
      allowed_ips: user.allowedIps || [],
      allowed_ip_labels: user.allowedIpLabels || {},
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserProfileById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { 
        id: Number(userId),
        isDeleted: false // Exclude soft deleted users
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        phoneNumber: true,
        extension: true,
        bio: true,
        reportToId: true,
        roles: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            currency: true,
            language: true,
            logo: true
          }
        }
      }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
}; 

exports.updateUserProfile = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { userId } = req.params;
    const { firstName, lastName, email, phoneNumber, extension, bio, password, roleId, isActive, reportToId } = req.body;

    console.log(req.body);
    const targetUserId = Number(userId);
   
    const existingUser = await prisma.user.findUnique({
      where: { 
        id: targetUserId,
        organizationId: req.organizationId,
        isDeleted: false
      },
      select: { id: true, email: true }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found in organization or user is deleted' });
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive'
          },
          isDeleted: false,
          id: { not: targetUserId }
        }
      });
      if (emailExists) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
    }

    if (password) {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ error: 'Password does not meet requirements', details: passwordValidation.errors });
      }
    }

    let newRoleName = null;
    if (roleId) {
      const roleIdInt = typeof roleId === 'string' ? parseInt(roleId, 10) : roleId;
      const role = await prisma.role.findFirst({ 
        where: { 
          id: roleIdInt, 
          organizationId: req.organizationId, 
          isActive: true 
        } 
      });
      if (!role) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }
      newRoleName = role.name;
    }

    let validatedReportToId = undefined;
    if (reportToId !== undefined) {
      if (reportToId === null || reportToId === '') {
        validatedReportToId = null;
      } else {
        const reportToIdInt = typeof reportToId === 'string' ? parseInt(reportToId, 10) : reportToId;
        const reportToUser = await prisma.user.findFirst({
          where: {
            id: reportToIdInt,
            organizationId: req.organizationId,
            isDeleted: false,
            roles: {
              some: {
                isAgent: false
              }
            }
          }
        });
        
        if (!reportToUser) {
          return res.status(400).json({ error: 'Invalid reportTo user - must be a team lead' });
        }
        validatedReportToId = reportToIdInt;
      }
    }

    const updateData = {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
      ...(extension && { extension }),
      ...(bio && { bio }),
      ...(isActive !== undefined && { isActive }),
      ...(validatedReportToId !== undefined && { reportToId: validatedReportToId })
    };

   
    if (password) {
      const hashedPassword = await hashPassword(password);
      updateData.password = hashedPassword;
    }

   
    if (roleId) {
      const roleIdInt = typeof roleId === 'string' ? parseInt(roleId, 10) : roleId;
      updateData.roles = {
        set: [], 
        connect: { id: roleIdInt } 
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        extension: true,
        bio: true,
        isActive: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          }
        },
        roles: {
          select: {
            id: true,
            name: true,
            description: true,
            isAgent: true
          }
        }
      }
    });

    
    if (password || roleId) {
      await createAuditLog({
        action: AUDIT_ACTIONS.UPDATE_USER,
        resource: AUDIT_RESOURCES.USER,
        resourceId: updatedUser.id,
        newValues: { 
          userId: updatedUser.id, 
          userEmail: updatedUser.email, 
          passwordUpdated: !!password,
          roleUpdated: !!roleId,
          newRoleId: roleId,
          newRoleName: newRoleName,
          updatedBy: req.user.id,
          updatedByEmail: req.user.email
        },
        user: req.user,
        organizationId: req.organizationId,
        userRole: req.userRole,
        systemRole: req.systemRole,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
   
    res.json({
      message: password || roleId ? 'Profile updated successfully' : 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
}; 

exports.deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const ids = req.body?.ids;
    const organizationId = req.organizationId;
    
    // Support both single and bulk deletion
    let userIds = [];
    
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Multiple deletion
      userIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    } else if (userId) {
      // Single deletion (backward compatibility)
      const singleId = parseInt(userId);
      if (!isNaN(singleId)) {
        userIds = [singleId];
      }
    }
    
    if (userIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        message: 'Please provide valid user ID(s) to delete' 
      });
    }
    
    // Prevent self-deletion
    if (userIds.includes(req.user.id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Find all users to be deleted
    const existingUsers = await prisma.user.findMany({
      where: { 
        id: { in: userIds },
        organizationId: organizationId,
        isDeleted: false // Only allow deletion of non-deleted users
      },
      select: { id: true, email: true, firstName: true, lastName: true, isDeleted: true }
    });
    
    if (existingUsers.length === 0) {
      return res.status(404).json({ 
        error: 'Users not found', 
        message: 'No users found with the provided IDs or users are already deleted' 
      });
    }
    
    // Check which users can be deleted
    const deletionSummary = {
      totalUsers: existingUsers.length,
      deletedUsers: 0,
      restrictedUsers: []
    };
    
    const usersToDelete = [];
    
    // Process each user
    for (const user of existingUsers) {
      // Check if trying to delete self
      if (user.id === req.user.id) {
        deletionSummary.restrictedUsers.push({
          id: user.id,
          email: user.email,
          reason: 'Cannot delete your own account'
        });
        continue;
      }
      
      usersToDelete.push(user);
    }
    
    // Perform soft deletion on valid users
    if (usersToDelete.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const user of usersToDelete) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              isActive: false,
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: req.user.id,
              email: `deleted_${Date.now()}_${user.email}`
            }
          });
          
          // Reassign leads assigned to this user to null (unassigned)
          await tx.lead.updateMany({
            where: { assignedToId: user.id },
            data: { assignedToId: null }
          });
          
          deletionSummary.deletedUsers++;
          
          // Create audit log for the soft delete
          await tx.auditLog.create({
            data: {
              action: 'SOFT_DELETE_USER',
              resource: 'USER',
              resourceId: user.id,
              oldValues: { isActive: true, isDeleted: false },
              newValues: { isActive: false, isDeleted: true, deletedAt: new Date() },
              userId: req.user.id,
              organizationId: organizationId
            }
          });
        }
      });
    }
    
    // Prepare response
    const response = {
      message: deletionSummary.deletedUsers > 0 
        ? (deletionSummary.deletedUsers === 1 
          ? 'User deleted successfully' 
          : `${deletionSummary.deletedUsers} users deleted successfully`)
        : 'No users were deleted',
      deletedCount: deletionSummary.deletedUsers,
      summary: deletionSummary
    };
    
    // Add warnings if some users couldn't be deleted
    if (deletionSummary.restrictedUsers.length > 0 || deletionSummary.deletedUsers < deletionSummary.totalUsers) {
      response.warning = `Some users could not be deleted. Check the summary for details.`;
    }
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Restore soft deleted user
exports.restoreUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const organizationId = req.organizationId;
    
    // Check if user exists and is soft deleted
    const user = await prisma.user.findUnique({
      where: { 
        id: Number(userId),
        organizationId: organizationId
      },
      select: { id: true, isDeleted: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found in organization' });
    }

    if (!user.isDeleted) {
      return res.status(400).json({ error: 'User is not deleted' });
    }

    // Restore the user
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: Number(userId) },
        data: {
          isActive: true,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          email: user.email.replace(/^deleted_\d+_/, '') // Remove deleted prefix
        }
      });

      // Create audit log for the restore
      await tx.auditLog.create({
        data: {
          action: 'RESTORE_USER',
          resource: 'USER',
          resourceId: Number(userId),
          oldValues: { isActive: false, isDeleted: true },
          newValues: { isActive: true, isDeleted: false },
          userId: req.user.id,
          organizationId: organizationId
        }
      });
    });

    res.json({ message: 'User restored successfully' });
  } catch (error) {
    next(error);
  }
}; 