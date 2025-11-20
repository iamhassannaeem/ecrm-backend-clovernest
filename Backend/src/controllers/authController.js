const { prisma } = require('../config/database');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

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
          logo: organization.logo,
          website: organization.website,
          currency: organization.currency,
          language: organization.language,
          isActive: organization.isActive,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
          createdById: organization.createdById
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
    
    // First check if user exists with this email in ANY organization
    const userExists = await prisma.user.findFirst({
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        email: true,
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });


    const user = await prisma.user.findFirst({
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        },
        organizationId: organization.id
      },
      include: {
        organization: true,
        roles: {
          include: {
            rolePermissions: {
              include: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  }
                }
              }
            }
          }
        },
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
      if (userExists) {
        return res.status(401).json({ 
          error: 'Profile not found', 
          message: `Your profile doesn't exist in this organization (${organization.name}). You are registered with ${userExists.organization.name}.` 
        });
      } else {
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

    // Update last login
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
    const organizationId = user.organization ? user.organization.id : null;
    const accessToken = generateAccessToken({ userId: user.id, organizationId, permissions });
    const refreshToken = await generateRefreshToken(user.id);
    
    // Build complete role details with permissions
    const rolesWithPermissions = user.roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      isAgent: role.isAgent,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      organizationId: role.organizationId,
      permissions: role.rolePermissions.map(permission => ({
        id: permission.id,
        action: permission.action,
        resource: permission.resource,
        createdAt: permission.createdAt,
        organization: permission.organization
      }))
    }));

    let userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      systemRole: user.roles.length > 0 ? user.roles[0].name : null,
      roles: rolesWithPermissions,
      permissions: permissions
    };
    
    if (user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      userResponse.organizations = [
        ...(user.createdOrganizations?.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          domain: org.domain,
          description: org.description,
          logo: org.logo,
          website: org.website,
          currency: org.currency,
          language: org.language,
          isActive: org.isActive,
          enableCardValidation: org.enableCardValidation,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          createdById: org.createdById,
          role: 'SUPER_ADMIN'
        })) || [])
      ];
    } else if (user.roles.some(role => role.name === 'ORGANIZATION_ADMIN')) {
      if (user.organization) {
        userResponse.organizations = [{
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          domain: user.organization.domain,
          description: user.organization.description,
          logo: user.organization.logo,
          website: user.organization.website,
          currency: user.organization.currency,
          language: user.organization.language,
          isActive: user.organization.isActive,
          enableCardValidation: user.organization.enableCardValidation,
          createdAt: user.organization.createdAt,
          updatedAt: user.organization.updatedAt,
          createdById: user.organization.createdById,
          role: 'ORGANIZATION_ADMIN'
        }];
      } else {
        userResponse.organizations = [];
      }
    } else {
      if (user.organization) {
        userResponse.organizations = [{
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          domain: user.organization.domain,
          description: user.organization.description,
          logo: user.organization.logo,
          website: user.organization.website,
          currency: user.organization.currency,
          language: user.organization.language,
          isActive: user.organization.isActive,
          enableCardValidation: user.organization.enableCardValidation,
          createdAt: user.organization.createdAt,
          updatedAt: user.organization.updatedAt,
          createdById: user.organization.createdById,
          role: user.roles.length > 0 ? user.roles[0].name : null,
          roleDetails: user.roles.length > 0 ? {
            id: user.roles[0].id,
            name: user.roles[0].name,
            description: user.roles[0].description,
            isActive: user.roles[0].isActive,
            isAgent: user.roles[0].isAgent,
            permissions: user.roles[0].rolePermissions.map(permission => ({
              action: permission.action,
              resource: permission.resource
            }))
          } : null
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
  try {
    // Fetch user with organization details
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        organization: true,
        roles: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      role: user.roles.length > 0 ? user.roles[0].name : null,
      organization: user.organization ? {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        domain: user.organization.domain,
        description: user.organization.description,
        logo: user.organization.logo,
        website: user.organization.website,
        currency: user.organization.currency,
        language: user.organization.language,
        isActive: user.organization.isActive,
        createdAt: user.organization.createdAt,
        updatedAt: user.organization.updatedAt,
        createdById: user.organization.createdById
      } : null
    };

    res.json({ user: userResponse });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}; 