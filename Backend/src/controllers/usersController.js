const { prisma } = require('../config/database');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        createdAt: true,
        lastLoginAt: true,
        phoneNumber: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        },
        roles: {
          select: {
            name: true,
            isAgent: true
          }
        }
      }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.organization_users = user.organization_users.map(ou => ({
      ...ou,
      displayRole: ou.role.name 
    }));
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { firstName, lastName, avatar, phoneNumber, isActive } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(avatar && { avatar }),
        ...(phoneNumber && { phoneNumber }),
        ...(isActive && { isActive })
      }
    });
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatar: updatedUser.avatar,
        isActive: updatedUser.isActive,
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, password: true } });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'Cannot change password for OAuth users' });
    }
    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: 'New password does not meet requirements', details: passwordValidation.errors });
    }
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.changeEmail = async (req, res, next) => {
  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { newEmail, password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, password: true } });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'Cannot change email for OAuth users' });
    }
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    const existingUser = await prisma.user.findFirst({ 
      where: { 
        email: {
          equals: newEmail,
          mode: 'insensitive'
        }
      }
    });
    if (existingUser && existingUser.id !== req.user.id) {
      return res.status(400).json({ error: 'Email is already taken' });
    }
    await prisma.user.update({ where: { id: req.user.id }, data: { email: newEmail, emailVerified: false, emailVerifiedAt: null } });
    res.json({ message: 'Email changed successfully. Please verify your new email address.' });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {

  try {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { password } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, password: true },
      include: {
        organization_users: {
          where: { role: 'ORGANIZATION_ADMIN', isActive: true },
          include: {
            organizations: {
              include: {
                members: { where: { role: 'ORGANIZATION_ADMIN', isActive: true } }
              }
            }
          }
        }
      }
    });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'Cannot delete OAuth user accounts' });
    }
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    const soleAdminOrgs = user.organization_users.filter(
      member => member.organizations.members.length === 1
    );
    if (soleAdminOrgs.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete account. You are the sole admin of one or more organizations. Please transfer ownership or delete the organizations first.',
        organizations: soleAdminOrgs.map(member => member.organizations.name)
      });
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isActive: false,
        email: `deleted_${Date.now()}_${user.email}`
      }
    });
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getNonAgentUsers = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    
    
    const targetOrganizationId = organizationId || req.user.organizationId;
    
    if (!targetOrganizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    
    const users = await prisma.user.findMany({
      where: {
        organizationId: parseInt(targetOrganizationId),
        roles: {
          none: {
            isAgent: true
          }
        }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        roles: {
          select: {
            name: true,
            isAgent: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
}; 

/**
 * @swagger
 * /api/users/profile/me/{id}:
 *   get:
 *     summary: Get user profile by ID (self-access only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID.
 *     responses:
 *       '200':
 *         description: User profile retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/components/schemas/User'
 *       '403':
 *         description: You can only access your own profile.
 *       '404':
 *         description: User not found.
 *       '500':
 *         description: Server error.
 */
exports.getProfileById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId !== req.user.id) {
      return res.status(403).json({
        error: 'You can only access your own profile',
        code: 'SELF_ACCESS_ONLY'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        phoneNumber: true,
        
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            description: true,
            logo: true,
            website: true,
            currency: true,
            language: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            
          }
        },
        
        roles: {
          select: {
            id: true,
            name: true,
            description: true,
            isAgent: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                domain: true,
                description: true,
                logo: true,
                website: true,
                currency: true,
                language: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    
    const organizationsFromRoles = user.roles
      .map(role => role.organization)
      .filter(org => org); 

    
    let allOrganizations = organizationsFromRoles;
    if (
      user.organization &&
      !organizationsFromRoles.some(org => org.id === user.organization.id)
    ) {
      allOrganizations = [user.organization, ...organizationsFromRoles];
    }

    res.json({
      user: {
        ...user,
        organizations: allOrganizations
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/users/profile/me/{id}:
 *   put:
 *     summary: Update user profile by ID (self-access only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               avatar:
 *                 type: string
 *                 format: binary
 *               phoneNumber:
 *                 type: string
 *                 example: "123-456-7890"
 *     responses:
 *       '200':
 *         description: Profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/components/schemas/User'
 *       '400':
 *         description: Validation failed.
 *       '403':
 *         description: You can only update your own profile.
 *       '404':
 *         description: User not found.
 *       '500':
 *         description: Server error.
 */
exports.updateProfileById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
      
    if (userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'You can only update your own profile',
        code: 'SELF_ACCESS_ONLY'
      });
    }

    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { firstName, lastName, avatar, phoneNumber, isActive } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(avatar && { avatar }),
        ...(phoneNumber && { phoneNumber }),
        ...(isActive && { isActive })
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatar: updatedUser.avatar,
        isActive: updatedUser.isActive,
      }
    });
  } catch (error) {
    next(error);
  }
}; 