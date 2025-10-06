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
    const { email, password, firstName, lastName, roleId, permissions, phoneNumber, bio } = req.body;
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
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phoneNumber,
          bio,
          isActive: true,
          organizationId, 
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
    const orgUser = await prisma.user.findUnique({ where: { id: userId, organizationId } });
    if (!orgUser) {
      return res.status(404).json({ error: 'User not found in organization' });
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
    const orgUser = await prisma.user.findUnique({ where: { id: userId, organizationId } });
    if (!orgUser) {
      return res.status(404).json({ error: 'User not found in organization' });
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
      where: { organizationId: Number(organizationId) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,  
        bio: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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

exports.getUserProfileById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        phoneNumber: true,
        bio: true,
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
    const { firstName, lastName, email, phoneNumber, bio, password, roleId, isActive } = req.body;

    console.log(req.body);
    const targetUserId = Number(userId);
   

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

    const updateData = {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
      ...(bio && { bio }),
      ...(isActive !== undefined && { isActive })
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
    await prisma.user.delete({
      where: { id: Number(userId) }
    }); 
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
}; 