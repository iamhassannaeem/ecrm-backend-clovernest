# Universal Permission System Documentation

## Overview

The Telecom Sales CRM now implements a comprehensive universal permission system that checks permissions for every request from the frontend. This system ensures that:

1. **Every request decodes the token and checks permissions**
2. **Records are shown based on user permissions**
3. **Organization admin routes are also protected by permission checks**
4. **Proper error messages are returned when permissions are insufficient**
5. **Lookup routes are accessible to all authenticated users without specific permissions**
6. **Non-agent users routes are accessible to all authenticated users for lead assignment dropdowns**

## Architecture

### 1. Global Permission Middleware

The system uses a global middleware (`globalPermissionMiddleware`) that is applied to all routes in `app.js`. This middleware:

- Decodes JWT tokens for every request
- Checks user permissions against required route permissions
- Applies permission-based data filtering
- Returns standardized error messages

### 2. Permission Levels

The system supports three main user roles:

- **SUPER_ADMIN**: Has access to all system resources
- **ORGANIZATION_ADMIN**: Has access to organization-specific resources
- **AGENT**: Has limited access to assigned resources

### 3. Permission Structure

Each permission consists of:
- **Action**: CREATE, READ, UPDATE, DELETE, MANAGE
- **Resource**: The specific resource being accessed (e.g., ORGANIZATIONS, USERS, LEADS)

## Implementation Details

### Global Permission Middleware

```javascript
// Applied to all routes in app.js
app.use(globalPermissionMiddleware);
```

The middleware performs these steps:

1. **Token Decoding**: Extracts and validates JWT tokens
2. **User Authentication**: Fetches user data with roles and permissions
3. **Route Permission Matching**: Maps routes to required permissions
4. **Permission Validation**: Checks if user has required permissions
5. **Error Handling**: Returns standardized error messages

### Public Routes (No Permission Required)

The following routes are accessible to all authenticated users without specific permissions:

- **Health Check**: `/health` - System health monitoring
- **API Documentation**: `/api-docs` - Swagger documentation
- **File Uploads**: `/uploads/*` - Static file serving
- **Authentication Routes**: `/api/auth/*` - Login, register, password reset
- **Lookup Routes**: `/api/lookup/*` - Reference data accessible to all users
- **Non-Agent Users Routes**: `/api/users/non-agents`, `/api/users/organizations/:id/non-agents` - User lists for lead assignment dropdowns

### Permission Service

The `PermissionService` class provides:

- **Data Filtering**: Filters records based on user permissions
- **Permission Checking**: Validates specific permissions
- **Organization Access**: Controls organization-specific access
- **Query Building**: Creates permission-aware database queries

## Route Permission Mapping

The system maps routes to required permissions:

```javascript
const routePermissions = {
  // Auth routes
  '/api/auth/login': { action: 'READ', resource: 'AUTH' },
  
  // User routes
  '/api/users/profile': { action: 'READ', resource: 'USER_PROFILE' },
  
  // Organization routes
  '/api/organizations': { action: 'READ', resource: 'ORGANIZATIONS' },
  '/api/organizations/:id': { action: 'READ', resource: 'ORGANIZATIONS' },
  
  // Super Admin routes
  '/api/super-admin': { action: 'READ', resource: 'SYSTEM_ADMIN' },
  
  // Organization Admin routes
  '/api/org-admin': { action: 'READ', resource: 'ORGANIZATION_ADMIN' },
  '/api/org-admin/users': { action: 'READ', resource: 'ORGANIZATION_USERS' },
  
  // Leads routes
  '/api/leads': { action: 'READ', resource: 'LEADS' },
  
  // Chat routes
  '/api/chat': { action: 'READ', resource: 'CHAT' }
};
```

## Data Filtering

### Organization Filtering

- **Super Admin**: Can see all organizations
- **Organization Admin**: Can only see their own organization
- **Agent**: Can only see their own organization

### User Filtering

- **Super Admin**: Can see all users
- **Organization Admin**: Can see users in their organization
- **Agent**: Can only see themselves and other agents in their organization

### Lead Filtering

- **Super Admin**: Can see all leads
- **Organization Admin**: Can see leads in their organization
- **Agent**: Can only see leads assigned to them or in their organization

## Error Messages

The system returns standardized error messages:

```javascript
{
  error: "You don't have permission to read organizations. Required organization permissions.",
  code: "PERMISSION_DENIED",
  requiredAction: "READ",
  requiredResource: "ORGANIZATIONS"
}
```

## Usage Examples

### 1. Checking Permissions in Controllers

```javascript
// Check if user has permission to update organizations
if (!PermissionService.hasPermission(req.user, 'UPDATE', 'ORGANIZATIONS')) {
  return res.status(403).json({
    error: 'You don\'t have permission to update organizations. Required organization permissions.',
    code: 'PERMISSION_DENIED'
  });
}
```

### 2. Filtering Data

```javascript
// Apply permission filtering to query results
const filteredOrganizations = await PermissionService.filterOrganizations(req.user, organizations);
```

### 3. Creating Permission-Aware Queries

```javascript
// Create a query that respects user permissions
const query = PermissionService.createPermissionAwareQuery(req.user, {
  where: { isActive: true },
  include: { users: true }
});
```

## Migration from Old System

### Before (Old System)
```javascript
// Routes had individual authentication middleware
router.use(authenticateToken);
router.use(requireOrgAdminAccess);
```

### After (New System)
```javascript
// Global permission middleware handles all authentication and permission checks
// Routes only need specific business logic
```

## Security Features

1. **Token Validation**: Every request validates JWT tokens
2. **Permission Checking**: All routes check specific permissions
3. **Data Filtering**: Records are filtered based on user permissions
4. **Organization Isolation**: Users can only access their organization's data
5. **Role-Based Access**: Different roles have different access levels
6. **Audit Logging**: All permission checks are logged

## Testing the Permission System

### 1. Test Different User Roles

```bash
# Test as Super Admin
curl -H "Authorization: Bearer SUPER_ADMIN_TOKEN" /api/organizations

# Test as Organization Admin
curl -H "Authorization: Bearer ORG_ADMIN_TOKEN" /api/org-admin/users

# Test as Agent
curl -H "Authorization: Bearer AGENT_TOKEN" /api/leads
```

### 2. Test Permission Denial

```bash
# Try to access unauthorized resource
curl -H "Authorization: Bearer AGENT_TOKEN" /api/super-admin/organizations
# Should return 403 with permission denied error
```

### 3. Test Data Filtering

```bash
# Verify that users only see their organization's data
curl -H "Authorization: Bearer ORG_ADMIN_TOKEN" /api/organizations
# Should only return the user's organization
```

## Configuration

### Environment Variables

```bash
JWT_SECRET=your_jwt_secret_here
```

### Database Schema

The permission system relies on these database tables:
- `users`: User information
- `roles`: Role definitions
- `rolePermissions`: Permission assignments to roles
- `organizations`: Organization data
- `organizationMembers`: User-organization relationships

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**: Check if user has the required role and permissions
2. **Token Expired**: Ensure JWT tokens are valid and not expired
3. **Organization Access**: Verify user belongs to the organization they're trying to access
4. **Route Not Found**: Check if the route is properly mapped in `routePermissions`

### Debug Mode

Enable debug logging by setting:
```javascript
console.log('Permission check:', {
  user: req.user.id,
  action: requiredPermission.action,
  resource: requiredPermission.resource,
  hasPermission: hasPermission
});
```

## Future Enhancements

1. **Dynamic Permissions**: Allow runtime permission changes
2. **Permission Groups**: Group permissions for easier management
3. **Time-Based Permissions**: Temporary permission grants
4. **Permission Analytics**: Track permission usage and access patterns
5. **Advanced Filtering**: More granular data filtering options

## Conclusion

The universal permission system provides comprehensive security and access control for the Telecom Sales CRM. It ensures that every request is properly authenticated and authorized, and that users only see data they have permission to access. The system is designed to be scalable, maintainable, and secure. 