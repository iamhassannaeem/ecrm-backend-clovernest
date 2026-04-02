const { prisma } = require('../config/database');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { getClientIP, isIPAllowed } = require('../utils/accessControl');

async function getUserPermissions(user) {

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: {
        include: {
          rolePermissions: true
        }
      }
    }
  });
  let permissions = [];
  for (const role of dbUser.roles) {
    if (role.rolePermissions) {
      permissions = permissions.concat(
        role.rolePermissions.map(perm => ({
          action: perm.action,
          resource: perm.resource
        }))
      );
    }
  }
  return permissions;
}

module.exports.getUserPermissions = getUserPermissions;

exports.getOrganizations = async (req, res, next) => {
  try {
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, domain: true, description: true },
      orderBy: { name: 'asc' }
    });
    res.json({ organizations });
  } catch (error) {
    next(error);
  }
};

exports.register = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { email, password, firstName, lastName, organizationId, message, phoneNumber } = req.body;
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: 'Password does not meet requirements', details: passwordValidation.errors });
    }
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization || organization.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Invalid or inactive organization' });
    }
    const existingUser = await prisma.user.findFirst({ 
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    const hashedPassword = await hashPassword(password);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, password: hashedPassword, firstName, lastName, phoneNumber } });
      const joinRequest = await tx.organizationJoinRequest.create({
        data: {
          userId: user.id,
          organizationId,
          message: message || `${firstName} ${lastName} would like to join ${organization.name}`,
          requestedRole: 'USER'
        },
        include: { organization: { select: { name: true, domain: true } } }
      });
      return { user, joinRequest };
    });
    try {
      const verificationToken = generateAccessToken(result.user.id);
      await sendVerificationEmail(email, verificationToken, firstName);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }
    res.status(201).json({
      message: 'Registration successful. Your request to join the organization is pending approval.',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        emailVerified: result.user.emailVerified,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          domain: organization.domain,
          description: organization.description,
          status: organization.status,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    
    const { email, password } = req.body;
    const hasDeviceHeader = Object.prototype.hasOwnProperty.call(req.headers || {}, 'x-device-id');
    const headerDeviceIdRaw = req.get('x-device-id');
    const headerDeviceId = headerDeviceIdRaw != null ? String(headerDeviceIdRaw).trim() : null;
    // If x-device-id header exists, it MUST be non-empty (mobile identification rule)
    if (hasDeviceHeader && !headerDeviceId) {
      return res.status(403).json({ code: 'ACCESS_DENIED', message: 'Unauthorized access' });
    }
    
    // Extract domain from request
    const getDomainFromRequest = (req) => {
      // Check for domain in headers (for API calls)
      const origin = req.get('Origin');
      const referer = req.get('Referer');
      const host = req.get('Host');
      
      // Priority: Origin > Referer > Host
      let domain = origin || referer || host;
      
      if (domain) {
        // Remove protocol and www
        domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
        // Remove port and path
        domain = domain.split(':')[0]; 
        domain = domain.split('/')[0]; 
        return domain.toLowerCase();
      }
      
      return null;
    };
    
    const requestDomain = getDomainFromRequest(req);
    
    if (!requestDomain) {
      return res.status(400).json({ 
        error: 'Domain not detected', 
        message: 'Unable to determine organization domain from request' 
      });
    }
    
    // Find organization by domain (handle both full URL and domain-only formats)
    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          {
            domain: {
              equals: requestDomain,
              mode: 'insensitive'
            }
          },
          {
            domain: {
              equals: `http://${requestDomain}`,
              mode: 'insensitive'
            }
          },
          {
            domain: {
              equals: `https://${requestDomain}`,
              mode: 'insensitive'
            }
          },
          {
            domain: {
              contains: requestDomain,
              mode: 'insensitive'
            }
          }
        ],
        isActive: true
      }
    });
    
    if (!organization) {
      return res.status(403).json({ 
        error: 'Organization not found', 
        message: `No organization found for domain: ${requestDomain}` 
      });
    }

    const userExists = await prisma.user.findFirst({
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      },
      include: {
        roles: true
      }
    });

    if (!userExists || !userExists.password) {
      return res.status(401).json({ 
        error: 'Invalid credentials', 
        message: 'Invalid email or password' 
      });
    }

    const isSuperAdmin =
      userExists?.systemRole === 'SUPER_ADMIN' ||
      (userExists.roles &&
        userExists.roles.some(
          (role) => role.name === 'SUPER_ADMIN' || role.name === 'Super Admin'
        ));

    let user;
    if (isSuperAdmin) {
      user = await prisma.user.findFirst({
        where: { 
          email: {
            equals: email,
            mode: 'insensitive'
          }
        },
        include: {
          organization: true,
          roles: true,
          auditLogs: true,
          refreshTokens: true,
          leadsCreated: true,
          leadsAssigned: true,
          createdOrganizations: true,
          chatParticipants: true,
          messages: true
        }
      });
    } else {
      user = await prisma.user.findFirst({
        where: { 
          email: {
            equals: email,
            mode: 'insensitive'
          },
          organizationId: organization.id
        },
        include: {
          organization: true,
          roles: true,
          auditLogs: true,
          refreshTokens: true,
          leadsCreated: true,
          leadsAssigned: true,
          createdOrganizations: true,
          chatParticipants: true,
          messages: true
        }
      });

      if (!user || !user.password) {
        return res.status(401).json({ 
          error: 'Profile not found', 
          message: `Your profile doesn't exist in this organization (${organization.name})` 
        });
      }
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Account deactivated', 
        message: 'Your account has been deactivated. Please contact your administrator.' 
      });
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid credentials', 
        message: 'Invalid email or password' 
      });
    }

    const isStoreTestUser = user?.isStoreTestUser === true;

    // WEB login: enforce org/user allowlists (optional) before issuing token.
    if (!isStoreTestUser && !headerDeviceId) {
      const ip = getClientIP(req);
      const orgAllowedIps = organization?.allowedIps || organization?.allowed_ips || [];
      const userAllowedIps = user?.allowedIps || user?.allowed_ips || [];
      if (Array.isArray(orgAllowedIps) && orgAllowedIps.length > 0) {
        if (!isIPAllowed(ip, orgAllowedIps)) {
          return res.status(403).json({
            code: 'ACCESS_DENIED',
            message: 'Unauthorized access',
            reason: 'IP_RESTRICTED',
          });
        }
      }
      if (Array.isArray(userAllowedIps) && userAllowedIps.length > 0) {
        if (!isIPAllowed(ip, userAllowedIps)) {
          return res.status(403).json({
            code: 'ACCESS_DENIED',
            message: 'Unauthorized access',
            reason: 'IP_RESTRICTED',
          });
        }
      }
    }

    await prisma.user.update({ 
      where: { id: user.id }, 
      data: { 
        lastLoginAt: new Date(),
        isOnline: true,
        lastSeen: new Date(),
        onlineStatusUpdatedAt: new Date()
      } 
    });
    
    const permissions = await getUserPermissions(user);
    const organizationId = isSuperAdmin ? organization.id : (user.organization ? user.organization.id : null);
    if (!isStoreTestUser && headerDeviceId) {
      const orgMobile = await prisma.organization.findUnique({
        where: { id: organization.id },
        select: { mobileAppEnabled: true }
      });
      if (orgMobile && orgMobile.mobileAppEnabled === false) {
        return res.status(403).json({ code: 'ACCESS_DENIED', message: 'Unauthorized access' });
      }

      const device = await prisma.mobileDevice.findUnique({
        where: { deviceId: headerDeviceId },
        select: { organizationId: true, userId: true, isApproved: true, applyOrgIps: true, applyUserIps: true }
      });
      if (
        !device ||
        device.organizationId !== organizationId ||
        device.userId !== user.id ||
        device.isApproved !== true
      ) {
        return res.status(403).json({ code: 'ACCESS_DENIED', message: 'Unauthorized access' });
      }

      // Mobile login: org/user allowlists are optional per-device.
      const ip = getClientIP(req);
      const orgAllowedIps = organization?.allowedIps || organization?.allowed_ips || [];
      const userAllowedIps = user?.allowedIps || user?.allowed_ips || [];
      if (device.applyOrgIps && Array.isArray(orgAllowedIps) && orgAllowedIps.length > 0) {
        if (!isIPAllowed(ip, orgAllowedIps)) {
          return res.status(403).json({
            code: 'ACCESS_DENIED',
            message: 'Unauthorized access',
            reason: 'IP_RESTRICTED',
          });
        }
      }
      if (device.applyUserIps && Array.isArray(userAllowedIps) && userAllowedIps.length > 0) {
        if (!isIPAllowed(ip, userAllowedIps)) {
          return res.status(403).json({
            code: 'ACCESS_DENIED',
            message: 'Unauthorized access',
            reason: 'IP_RESTRICTED',
          });
        }
      }
    }

    const tokenPayload = {
      userId: user.id,
      user_id: user.id,
      organizationId,
      permissions,
      ...(headerDeviceId ? { deviceId: headerDeviceId, device_id: headerDeviceId } : {}),
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(user.id);
    
    // Prepare full role information
    const roles = user.roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      isAgent: role.isAgent,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    }));

    let userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      avatar: user.avatar,
      extension: user.extension,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: roles,
      role: user.roles.length > 0 ? user.roles[0].name : null
    };
    
    const excludeBackblazeCredentials = (org) => {
      if (!org) return null;
      const { b2BucketName, b2Region, b2Endpoint, b2KeyId, b2AppKey, ...orgWithoutCredentials } = org;
      return orgWithoutCredentials;
    };

    if (user.roles.some(role => role.name === 'SUPER_ADMIN')) {
      userResponse.organizations = [{
        ...excludeBackblazeCredentials(organization),
        role: 'SUPER_ADMIN',
        roleDetails: user.roles.find(role => role.name === 'SUPER_ADMIN')
      }];
    } else if (user.roles.some(role => role.name === 'ORGANIZATION_ADMIN')) {
      if (user.organization) {
        userResponse.organizations = [{
          ...excludeBackblazeCredentials(user.organization),
          role: 'ORGANIZATION_ADMIN',
          roleDetails: user.roles.find(role => role.name === 'ORGANIZATION_ADMIN')
        }];
      } else {
        userResponse.organizations = [];
      }
    } else {
      if (user.organization) {
        userResponse.organizations = [{
          ...excludeBackblazeCredentials(user.organization),
          role: user.roles.length > 0 ? user.roles[0].name : null,
          roleDetails: user.roles.length > 0 ? user.roles[0] : null
        }];
      } else {
        userResponse.organizations = [];
      }
    }
    
    res.json({
      message: 'Login successful',
      user: userResponse,
      tokens: { accessToken, refreshToken }
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    const user = await verifyRefreshToken(refreshToken);
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const accessToken = generateAccessToken(user.id);
    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user?.id;
    
    
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    
   
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnline: false,
          lastSeen: new Date(),
          onlineStatusUpdatedAt: new Date()
        }
      });
    }
    
    
    if (userId) {
      try {
        
        const activeSessions = await prisma.chatSession.findMany({
          where: {
            isActive: true,
            participants: {
              some: { userId }
            }
          },
          include: { participants: true }
        })
        
       
        if (global.io) {
          const userSockets = await global.io.in(`user_${userId}`).fetchSockets();
          userSockets.forEach(socket => {
            socket.emit('forceDisconnect', { reason: 'user_logout' });
            socket.disconnect();
          });
        }
        
        console.log(`[Logout] Ended ${activeSessions.length} active chat sessions for user ${userId}`);
      } catch (sessionError) {
        console.error('[Logout] Error ending chat sessions:', sessionError);
      
      }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    const { email } = req.body;
    const user = await prisma.user.findFirst({ 
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });
    if (!user) {
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
    const resetToken = generateAccessToken(user.id);
    try {
      await sendPasswordResetEmail(email, resetToken, user.firstName);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      avatar: req.user.avatar,
      emailVerified: req.user.emailVerified,
      role: req.user.roles.length > 0 ? req.user.roles[0].name : null 
    }
  });
}; 