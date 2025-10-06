const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');


async function getUserPermissions(user) {
  if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
    return [{ action: 'ALL', resource: 'ALL' }];
  }
  let permissions = [];
  if (user.roles) {
    for (const role of user.roles) {
      if (role.rolePermissions) {
        permissions = permissions.concat(
          role.rolePermissions.map(perm => ({
            action: perm.action,
            resource: perm.resource
          }))
        );
      }
    }
  }
  return permissions;
}

const universalPermissionCheck = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully for user:', decoded.userId);

    let user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid or inactive user',
        code: 'INVALID_USER'
      });
    }
    try {
      const userWithPermissions = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          roles: {
            include: {
              rolePermissions: true
            }
          }
        }
      });

      if (userWithPermissions) {
        user = userWithPermissions;
      }
    } catch (permError) {
      console.log('Could not fetch role permissions, using basic user data:', permError.message);
    }

    try {
      const userWithOrg = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          organization: true
        }
      });

      if (userWithOrg && userWithOrg.organization) {
        user.organization = userWithOrg.organization;
      }
    } catch (orgError) {
      console.log('Could not fetch organization data, continuing without:', orgError.message);
    }

    if (decoded.organizationId) {
      user.organizationId = decoded.organizationId;
    }

    try {
      user.permissions = await getUserPermissions(user);
    } catch (permError) {
      console.log('Error getting user permissions, setting empty array:', permError.message);
      user.permissions = [];
    }

    user.id = decoded.userId;
    req.user = user;

    const isSuperAdmin = user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'Organization Admin' || role.name === 'ORGANIZATION_ADMIN');
    const isAgent = user.roles && user.roles.some(role => role.isAgent === true);

    if (isSuperAdmin) {
      req.userRole = 'SUPER_ADMIN';
      req.isSuperAdmin = true;
      req.isAgent = false;
      req.isOrgAdmin = false;
    } else if (isOrgAdmin) {
      req.userRole = 'ORGANIZATION_ADMIN';
      req.isOrgAdmin = true;
      req.isAgent = false;
    } else if (isAgent) {
      req.userRole = 'AGENT';
      req.isAgent = true;
      req.isOrgAdmin = false;
    }

    const organizationId = user.organizationId || req.headers['x-organization-id'] || req.params.organizationId;
    if (organizationId) {
      req.organizationId = organizationId;
    }



    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Universal permission middleware error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { roles: { include: { rolePermissions: true } } }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid or inactive user',
        code: 'INVALID_USER'
      });
    }

    if (decoded.organizationId) {
      user.organizationId = decoded.organizationId;
    }
    user.permissions = await getUserPermissions(user);
    user.id = decoded.userId;
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};


const checkRoutePermission = (requiredAction, requiredResource, options = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const { allowSelf = false, allowOrgAdmin = true, allowSuperAdmin = true } = options;


    if (allowSuperAdmin && req.isSuperAdmin) {
      return next();
    }


    const hasPermission = req.user.permissions && req.user.permissions.some(perm => {
      return (perm.action === 'ALL' && perm.resource === 'ALL') ||
        (perm.action === requiredAction && perm.resource === requiredResource);
    });

    if (hasPermission) {
      return next();
    }


    if (allowSelf && req.params.userId && req.params.userId === req.user.id) {
      return next();
    }


    if (allowSelf && req.path.startsWith('/api/users/profile/me/') && req.params.id && parseInt(req.params.id) === req.user.id) {
      return next();
    }


    if (allowOrgAdmin && req.isOrgAdmin) {
      return next();
    }


    return res.status(403).json({
      error: `You don't have permission to ${requiredAction.toLowerCase()} ${requiredResource.toLowerCase()}. Required organization permissions.`,
      code: 'PERMISSION_DENIED',
      requiredAction,
      requiredResource
    });
  };
};


const checkOrgPermission = (requiredAction, requiredResource) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const organizationId = req.organizationId || req.headers['x-organization-id'] || req.params.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED'
      });
    }


    if (req.isSuperAdmin) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });
      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }
      return next();
    }


    const orgMember = req.user.organizationMembers?.find(member =>
      member.organization.id === Number(organizationId) && member.isActive
    );

    if (!orgMember) {
      return res.status(403).json({
        error: 'You don\'t have access to this organization',
        code: 'ORG_ACCESS_DENIED'
      });
    }


    const hasPermission = req.user.permissions && req.user.permissions.some(perm => {
      return (perm.action === 'ALL' && perm.resource === 'ALL') ||
        (perm.action === requiredAction && perm.resource === requiredResource);
    });

    if (!hasPermission) {
      return res.status(403).json({
        error: `You don't have permission to ${requiredAction.toLowerCase()} ${requiredResource.toLowerCase()} in this organization. Required organization permissions.`,
        code: 'PERMISSION_DENIED',
        requiredAction,
        requiredResource
      });
    }

    next();
  };
};


const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');

  if (!isSuperAdmin) {
    return res.status(403).json({
      error: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }

  req.userRole = 'SUPER_ADMIN';
  next();
};


const requireOrgAdminAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const organizationId = req.user.organizationId || req.headers['x-organization-id'] || req.params.organizationId;
  const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
  const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

  if (isSuperAdmin) {
    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });
      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }
      req.organizationId = organizationId;
      req.userRole = 'SUPER_ADMIN';
      req.isSuperAdmin = true;
      next();
      return;
    }
  }

  if (isOrgAdmin) {
    if (organizationId) {
      req.organizationId = organizationId;
      req.userRole = 'ORGANIZATION_ADMIN';
      req.isOrgAdmin = true;
      next();
      return;
    } else {
      return res.status(403).json({
        error: 'Organization admin access required',
        code: 'ORGANIZATION_ADMIN_REQUIRED'
      });
    }
  }

  return res.status(403).json({
    error: 'Organization admin access required',
    code: 'ORGANIZATION_ADMIN_REQUIRED'
  });
};


const requireOrgUserAccess = async (req, res, next) => {
  console.log('requireOrgUserAccess called', req.user && req.user.roles);
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const organizationId = req.user.organizationId || req.headers['x-organization-id'] || req.params.organizationId;
  const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
  const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
  const isAgent = req.user.roles && req.user.roles.some(role => role.isAgent === true);
  const isUser = req.user.roles && req.user.roles.some(role => role.name === 'USER');

  if (isSuperAdmin) {
    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });
      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }
      req.organizationId = organizationId;
      req.userRole = 'SUPER_ADMIN';
      req.isSuperAdmin = true;
      next();
      return;
    }
  }

  if (isOrgAdmin) {
    if (organizationId) {
      req.organizationId = organizationId;
      req.userRole = 'ORGANIZATION_ADMIN';
      req.isOrgAdmin = true;
      next();
      return;
    } else {
      return res.status(403).json({
        error: 'Organization admin access required',
        code: 'ORGANIZATION_ADMIN_REQUIRED'
      });
    }
  }

  if (isAgent) {
    if (!organizationId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED'
      });
    }
    const orgUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    console.log('User:', orgUser);
    console.log('Token orgId:', organizationId, 'DB orgId:', orgUser && orgUser.organizationId);
    if (!orgUser || !orgUser.isActive || orgUser.organizationId !== Number(organizationId)) {
      return res.status(403).json({
        error: 'Organization access required',
        code: 'ORG_ACCESS_REQUIRED'
      });
    }
    req.organizationId = organizationId;
    req.userRole = 'AGENT';
    req.isOrgUser = true;
    next();
    return;
  }


  if (isUser) {
    if (!organizationId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED'
      });
    }
    const orgUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    console.log('Regular User:', orgUser);
    console.log('Token orgId:', organizationId, 'DB orgId:', orgUser && orgUser.organizationId);
    if (!orgUser || !orgUser.isActive || orgUser.organizationId !== Number(organizationId)) {
      return res.status(403).json({
        error: 'Organization access required',
        code: 'ORG_ACCESS_REQUIRED'
      });
    }
    req.organizationId = organizationId;
    req.userRole = 'USER';
    req.isOrgUser = true;
    next();
    return;
  }

  return res.status(403).json({
    error: 'Organization access required',
    code: 'ORG_ACCESS_REQUIRED'
  });
};


const requireOrgAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const organizationId = req.user.organizationId || req.headers['x-organization-id'] || req.params.organizationId;
  const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
  const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

  const hasPermission = req.user.permissions && req.user.permissions.some(perm => {
    return (perm.action === 'MANAGE' && perm.resource === 'ORGANIZATION_SETTINGS') ||
      (perm.action === 'CREATE' && perm.resource === 'ORGANIZATION_SETTINGS') ||
      (perm.action === 'UPDATE' && perm.resource === 'ORGANIZATION_SETTINGS') ||
      (perm.action === 'DELETE' && perm.resource === 'ORGANIZATION_SETTINGS') ||
      (perm.action === 'READ' && perm.resource === 'ORGANIZATION_SETTINGS');
  });
  if (!hasPermission) {
    return res.status(403).json({
      error: 'Permission denied',
      code: 'PERMISSION_DENIED'
    });
  }

  if (!organizationId) {
    return res.status(400).json({
      error: 'Organization ID required',
      code: 'ORG_ID_REQUIRED'
    });
  }

  if (!isSuperAdmin && !isOrgAdmin && !hasPermission) {
    return res.status(403).json({
      error: 'Super admin or org admin access required',
      code: 'SUPER_ADMIN_OR_ORG_ADMIN_REQUIRED'
    });
  }

  req.organizationId = organizationId;
  if (isSuperAdmin) {
    req.isSuperAdmin = true;
    req.userRole = 'SUPER_ADMIN';
  } else if (isOrgAdmin || hasPermission) {
    req.isOrgAdmin = true;
    req.userRole = 'ORGANIZATION_ADMIN';
  }
  next();
};


const requireOrgUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const organizationId = req.user.organizationId || req.headers['x-organization-id'] || req.params.organizationId;
  const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
  const hasPermission = req.user.permissions && req.user.permissions.some(perm => {
    return (perm.action === 'ALL' && perm.resource === 'ALL') ||
      (perm.action === 'UPDATE' && perm.resource === 'ORGANIZATION_SETTINGS') ||
      (perm.action === 'READ' && perm.resource === 'ORGANIZATION_SETTINGS');
  });

  if (!organizationId) {
    return res.status(400).json({
      error: 'Organization ID required',
      code: 'ORG_ID_REQUIRED'
    });
  }

  if (!isSuperAdmin && !hasPermission) {
    return res.status(403).json({
      error: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }

  req.organizationId = organizationId;
  req.isSuperAdmin = true;
  req.userRole = 'SUPER_ADMIN';
  next();
};


const requirePermission = (action, resource) => {
  return (req, res, next) => {
    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    if (!req.user || !isSuperAdmin) {
      return res.status(403).json({
        error: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED'
      });
    }
    next();
  };
};


const requireSystemPermission = (action, resource) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      return res.status(403).json({
        error: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED'
      });
    }

    const hasSystemPermission = req.user.permissions && req.user.permissions.some(
      permission =>
        (permission.action === 'ALL' && permission.resource === 'ALL') ||
        (permission.action === action && permission.resource === resource)
    );
    if (!hasSystemPermission) {
      return res.status(403).json({
        error: `System permission required: ${action} ${resource}`,
        code: 'SYSTEM_PERMISSION_REQUIRED'
      });
    }
    next();
  };
};


function checkPermission(action, resource) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ error: 'Permission denied', code: 'PERMISSION_DENIED' });
    }

    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return next();
    }

    const hasPermission = req.user.permissions.some(
      perm => (perm.action === action && perm.resource === resource)
    );
    if (!hasPermission) {
      return res.status(403).json({ error: `Permission required: ${action} ${resource}`, code: 'PERMISSION_DENIED' });
    }
    next();
  };
}


function allowSelfOrPermission(actions, resource) {
  return (req, res, next) => {
    const targetUserId = String(req.params.userId);
    const userId = String(req.user.id);
    const isSelf = userId === targetUserId;
    const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    const hasPermission = req.user.permissions && req.user.permissions.some(
      perm => actions.includes(perm.action) && perm.resource === resource
    );

    if (isSelf || isOrgAdmin || hasPermission) {
      return next();
    }
    return res.status(403).json({ error: 'Organization admin access required', code: 'ORGANIZATION_ADMIN_REQUIRED' });
  };
}

module.exports = {
  authenticateToken,
  universalPermissionCheck,
  checkRoutePermission,
  checkOrgPermission,
  requireSuperAdmin,
  requireOrgAdminAccess,
  requireOrgUserAccess,
  requireOrgAdmin,
  requireOrgUser,
  requirePermission,
  requireSystemPermission,
  checkPermission,
  allowSelfOrPermission
};
