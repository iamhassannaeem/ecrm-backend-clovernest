const { universalPermissionCheck, checkRoutePermission } = require('./auth');


const routePermissions = {

  
  // User profile routes (require specific permissions)
  '/api/users/profile': { action: 'READ', resource: 'PROFILE' },
  '/api/users/profile/update': { action: 'UPDATE', resource: 'PROFILE' },
  '/api/users/password/change': { action: 'UPDATE', resource: 'PROFILE' },
  '/api/users/email/change': { action: 'UPDATE', resource: 'PROFILE' },
  '/api/users/account/delete': { action: 'DELETE', resource: 'PROFILE' },
  
  // this  for password change
  '/api/users/password': { action: 'UPDATE', resource: 'PROFILE' },
  
  // Self profile routes by ID (require PROFILE permission)
  '/api/users/profile/me/:id': { action: 'READ', resource: 'PROFILE' },
  
  // Organization routes
  '/api/organizations': { action: 'READ', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/create': { action: 'CREATE', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/:id': { action: 'READ', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/:id/update': { action: 'UPDATE', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/:id/delete': { action: 'DELETE', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/:id/invite': { action: 'CREATE', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/:id/members/:userId': { action: 'DELETE', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/:id/join-requests': { action: 'READ', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/:id/join-requests/:requestId/approve': { action: 'UPDATE', resource: 'ORGANIZATION_SETTINGS' },
  '/api/organizations/:id/join-requests/:requestId/reject': { action: 'UPDATE', resource: 'ORGANIZATION_SETTINGS' },
  
  // Organization Roles routes
  '/api/organizations/:organizationId/roles': { action: 'READ', resource: 'USER_ROLES' },
  '/api/organizations/:organizationId/roles/create': { action: 'CREATE', resource: 'USER_ROLES' },
  '/api/organizations/:organizationId/roles/:roleId': { action: 'READ', resource: 'USER_ROLES' },
  '/api/organizations/:organizationId/roles/:roleId/update': { action: 'UPDATE', resource: 'USER_ROLES' },
  '/api/organizations/:organizationId/roles/:roleId/delete': { action: 'DELETE', resource: 'USER_ROLES' },
  '/api/organizations/:organizationId/roles/:roleId/assign': { action: 'UPDATE', resource: 'USER_ROLES' },
  
  // Super Admin routes
  '/api/super-admin': { action: 'READ', resource: 'SYSTEM_ADMIN' },
  '/api/super-admin/organizations': { action: 'READ', resource: 'SYSTEM_ADMIN' },
  '/api/super-admin/users': { action: 'READ', resource: 'SYSTEM_ADMIN' },
  '/api/super-admin/roles': { action: 'READ', resource: 'SYSTEM_ADMIN' },
  
  // Organization Admin routes  
  '/api/org-admin': { action: 'READ', resource: 'ORGANIZATION_ADMIN' },
  '/api/org-admin/users': { action: 'READ', resource: 'USER_MANAGEMENT' },
  '/api/org-admin/users/create': { action: 'CREATE', resource: 'USER_MANAGEMENT' },
  '/api/org-admin/users/:id': { action: 'READ', resource: 'USER_MANAGEMENT' },
  '/api/org-admin/users/:id/update': { action: 'UPDATE', resource: 'USER_MANAGEMENT' },
  '/api/org-admin/users/:id/delete': { action: 'DELETE', resource: 'USER_MANAGEMENT' },
  '/api/org-admin/roles': { action: 'READ', resource: 'USER_ROLES' },
  '/api/org-admin/roles/create': { action: 'CREATE', resource: 'USER_ROLES' },
  '/api/org-admin/roles/:id': { action: 'READ', resource: 'USER_ROLES' },
  '/api/org-admin/roles/:id/update': { action: 'UPDATE', resource: 'USER_ROLES' },
  '/api/org-admin/roles/:id/delete': { action: 'DELETE', resource: 'USER_ROLES' },
  
  // Leads routes - Updated to use correct permissions
  '/api/leads': { action: 'READ', resource: 'LEAD_FORM' },
  '/api/leads/create': { action: 'CREATE', resource: 'LEAD_FORM' },
  '/api/leads/:id': { action: 'READ', resource: 'LEAD_FORM' },
  '/api/leads/:id/update': { action: 'UPDATE', resource: 'LEAD_FORM' },
  '/api/leads/:id/delete': { action: 'DELETE', resource: 'LEAD_FORM' },
  '/api/leads/organization/:organizationId': { action: 'READ', resource: 'LEAD_FORM' },
  '/api/leads/user/:userId': { action: 'READ', resource: 'LEAD_FORM' },
  '/api/leads/:id/approve': { action: 'UPDATE', resource: 'LEAD_FORM' },
  '/api/leads/:id/cancel': { action: 'UPDATE', resource: 'LEAD_FORM' },
  '/api/leads/:id/request-revision': { action: 'UPDATE', resource: 'LEAD_FORM' },
  '/api/leads/:id/post': { action: 'POST', resource: 'LEAD_FORM' },
  '/api/leads/sales-report': { action: 'READ', resource: 'SALES_REPORT' },
  '/api/leads/final-report': { action: 'READ', resource: 'MANAGEMENT_REPORT' },
  
  // Chat routes - handled by chat controller with custom permission logic
  '/api/chat/contacts': { action: 'CHAT', resource: 'CHAT' },
  '/api/chat/session': { action: 'CHAT', resource: 'CHAT' },
  '/api/chat/session/:id/messages': { action: 'CHAT', resource: 'CHAT' },
  '/api/chat/session/:id/message': { action: 'CHAT', resource: 'CHAT' },
  '/api/chat/session/:id': { action: 'CHAT', resource: 'CHAT' },
  '/api/chat/sessions': { action: 'CHAT', resource: 'CHAT' },
  '/api/chat/cleanup-expired': { action: 'CHAT', resource: 'CHAT' },
  
  // Group Chat routes - Using CREATE_GROUP_CHAT permission for group management
  '/api/chat/groups': { action: 'READ', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/create': { action: 'CREATE', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/:id': { action: 'READ', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/:id/update': { action: 'UPDATE', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/:id/delete': { action: 'DELETE', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/:id/participants': { action: 'READ', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/:id/participants/add': { action: 'UPDATE', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/:id/participants/remove': { action: 'UPDATE', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/:id/messages': { action: 'READ', resource: 'CREATE_GROUP_CHAT' },
  '/api/chat/groups/:id/message': { action: 'CREATE', resource: 'CREATE_GROUP_CHAT' },
  
  // Online status routes - added for online status functionality
  '/api/chat/online-status': { action: 'CHAT', resource: 'CHAT' },
  '/api/chat/online-status/:userId': { action: 'CHAT', resource: 'CHAT' },
  
  // User Teams routes
  '/api/user-teams': { action: 'READ', resource: 'USER_TEAMS' },
  '/api/user-teams/create': { action: 'CREATE', resource: 'USER_TEAMS' },
  '/api/user-teams/:id': { action: 'READ', resource: 'USER_TEAMS' },
  '/api/user-teams/:id/update': { action: 'UPDATE', resource: 'USER_TEAMS' },
  '/api/user-teams/:id/delete': { action: 'DELETE', resource: 'USER_TEAMS' },
  
  // Calls routes
  '/api/calls': { action: 'READ', resource: 'CALL_HISTORY' },
  '/api/calls/:id': { action: 'READ', resource: 'CALL_HISTORY' },
  
  // Notifications routes
  '/api/notifications': { action: 'READ', resource: 'NOTIFICATIONS' },
  '/api/notifications/unread-count': { action: 'READ', resource: 'NOTIFICATIONS' }
};


function matchRoute(path, method) {

  const normalizedPath = path.replace(/\/$/, ''); 
  
  
  if (routePermissions[normalizedPath]) {
    return routePermissions[normalizedPath];
  }
  
  const methodRouteKey = `${normalizedPath}:${method}`;
  if (routePermissions[methodRouteKey]) {
    return routePermissions[methodRouteKey];
  }
  

  for (const pattern in routePermissions) {

    if (pattern.includes(':')) {
      const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(normalizedPath)) {
        return routePermissions[pattern];
      }
    }
  }
  
  // If no specific permission is found, return a default permission based on the path
  if (normalizedPath.startsWith('/api/')) {
   
    const pathParts = normalizedPath.split('/');
    if (pathParts.length >= 3) {
      const resource = pathParts[2].toUpperCase().replace('-', '_');
      return { action: 'READ', resource };
    }
  }
  
  return null;
}

// Global permission middleware
const globalPermissionMiddleware = (req, res, next) => {
  
  // Skip permission check for health check, public routes
  if (req.path === '/health' || 
      req.path === '/api-docs' || 
      req.path.startsWith('/uploads/') ||
      req.path === '/api/auth/organizations' ||
      req.path === '/api/auth/register' ||
      req.path === '/api/auth/login' ||
      req.path === '/api/auth/logout' ||
      req.path === '/api/auth/refresh' ||
      req.path === '/api/auth/forgot-password' ||
      req.path.startsWith('/api/auth/google') ||
      req.path.startsWith('/api/auth/github') ||
      (req.path === '/api/calls' && req.method === 'POST') ||
      req.path.startsWith('/api/lookup') ||
      req.path === '/test-lead' ||
      req.path === '/chat-test' ||
      req.path === '/group-chat-test' ||
     
      req.path.startsWith('/public/')
    ) {
    return next();
  }

  // For routes that need authentication but no specific permissions
  if (req.path === '/api/users/non-agents' ||
      (req.path.startsWith('/api/users/organizations/') && req.path.endsWith('/non-agents')) ||
      (req.path.startsWith('/api/organizations/') && req.path.endsWith('/roles/non-agents')) ||
      req.path.startsWith('/api/chat/') ||
      req.path.startsWith('/api/leads/orders/') && req.path.endsWith('/final-status') || 
      req.path.startsWith('/api/leads/phone/') ||
      req.path.startsWith('/api/notifications')) {  
    return universalPermissionCheck(req, res, next);
  }
  
 
  universalPermissionCheck(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
   
    const requiredPermission = matchRoute(req.path, req.method);
    
    if (!requiredPermission) {
      return next();
    }
    
    const permissionMiddleware = checkRoutePermission(
      requiredPermission.action, 
      requiredPermission.resource,
      {
        allowSelf: true,
        allowOrgAdmin: true,
        allowSuperAdmin: true
      }
    );
    
    permissionMiddleware(req, res, next);
  });
};

module.exports = {
  globalPermissionMiddleware,
  routePermissions,
  matchRoute
}; 