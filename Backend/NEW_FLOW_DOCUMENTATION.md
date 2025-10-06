# New Flow Documentation

## Overview

This document describes the new flow implementation for the SaaS backend system, which implements a hierarchical role-based access control system with clear separation between Super Admin and Organization Admin responsibilities.

## System Architecture

### Role Hierarchy

1. **Super Admin** (System Role: `SUPER_ADMIN`)
   - Platform-wide administration
   - Not a member of any organization
   - Can create and manage all organizations
   - Has access to all platform analytics and audit logs

2. **Organization Admin** (System Role: `ORGANIZATION_ADMIN`)
   - Organization-specific administration
   - Automatically created when organization is created
   - Can manage users, roles, and permissions within their organization
   - Can create subscriptions for their organization

3. **User** (System Role: `USER`)
   - Organization member with assigned roles
   - Access controlled by organization admin
   - Can have custom permissions assigned

### Database Schema Changes

#### New Fields Added

- `User.adminOrganizations`: Organizations where user is admin
- `Organization.adminId`: Reference to the admin user of the organization
- `Organization.admin`: Relation to the admin user

#### Updated Enums

- `SystemRole`: Updated to include `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `USER`
- Removed `PLATFORM_ADMIN` and `SUPPORT_ADMIN`

## Flow Implementation

### 1. Super Admin Creation

Super Admin is created using a dedicated script that:
- Creates a user with `SUPER_ADMIN` system role
- Assigns all system-wide permissions
- Is not a member of any organization
- Cannot be modified through regular user management

```bash
node scripts/create-super-admin.js
```

### 2. Organization Creation

When Super Admin creates an organization:
- Organization admin is automatically created
- Admin user gets `ORGANIZATION_ADMIN` system role
- Admin is automatically added to the organization
- Default roles are created for the organization
- Organization starts with trial status

**API Endpoint**: `POST /api/super-admin/organizations`

**Request Body**:
```json
{
  "name": "Organization Name",
  "domain": "organization.com",
  "description": "Organization description",
  "website": "https://organization.com",
  "adminEmail": "admin@organization.com",
  "adminPassword": "Admin123!",
  "adminFirstName": "Admin",
  "adminLastName": "User"
}
```

### 3. Organization Admin Management

Organization Admin can:

#### Create Users
- Create users within their organization
- Assign roles and permissions
- Set user status (active/inactive)

**API Endpoint**: `POST /api/org-admin/users`

#### Manage Roles
- Create custom roles for their organization
- Assign permissions to roles
- Manage role assignments

**API Endpoint**: `POST /api/org-admin/roles`

#### Manage Subscriptions
- Create subscriptions for their organization
- Manage billing and payment methods

**API Endpoint**: `POST /api/org-admin/subscriptions`

### 4. Permission System

#### System Permissions (Super Admin)
- `PLATFORM_USERS`: Manage all platform users
- `PLATFORM_ORGANIZATIONS`: Manage all organizations
- `PLATFORM_SUBSCRIPTIONS`: Manage all subscriptions
- `PLATFORM_PAYMENTS`: Manage all payments
- `PLATFORM_ANALYTICS`: Access platform analytics
- `PLATFORM_SETTINGS`: Manage platform settings
- `PLATFORM_AUDIT_LOGS`: Access all audit logs
- `SYSTEM_CONFIGURATION`: System configuration

#### Organization Permissions (Users)
- `USER_MANAGEMENT`: Manage organization users
- `USER_PROFILES`: Manage user profiles
- `ORGANIZATION_SETTINGS`: Manage organization settings
- `SUBSCRIPTION_MANAGEMENT`: Manage subscriptions
- `ANALYTICS_DASHBOARD`: Access analytics
- `AUDIT_LOGS`: Access organization audit logs
- And many more...

## API Endpoints

### Super Admin Endpoints

#### Organization Management
- `POST /api/super-admin/organizations` - Create organization
- `GET /api/super-admin/organizations` - List all organizations
- `GET /api/super-admin/organizations/:id` - Get organization details
- `PUT /api/super-admin/organizations/:id` - Update organization
- `DELETE /api/super-admin/organizations/:id` - Delete organization

#### Platform Analytics
- `GET /api/super-admin/analytics` - Platform-wide analytics
- `GET /api/super-admin/audit-logs` - All audit logs
- `GET /api/super-admin/users` - All platform users

### Organization Admin Endpoints

#### User Management
- `POST /api/org-admin/users` - Create user
- `PUT /api/org-admin/users/:id/role` - Update user role
- `PUT /api/org-admin/users/:id/status` - Update user status
- `GET /api/org-admin/users` - List organization users

#### Role Management
- `POST /api/org-admin/roles` - Create role
- `GET /api/org-admin/roles` - List roles
- `PUT /api/org-admin/roles/:id` - Update role
- `DELETE /api/org-admin/roles/:id` - Delete role

#### Subscription Management
- `POST /api/org-admin/subscriptions` - Create subscription
- `GET /api/org-admin/subscriptions` - List subscriptions
- `PUT /api/org-admin/subscriptions/:id` - Update subscription

## Middleware Updates

### New Middleware Functions

- `requireOrgAdminAccess`: Checks if user is organization admin
- `requireOrgUserAccess`: Checks if user has organization access

### Access Control Logic

1. **Super Admin**: Can access any organization by providing `x-organization-id` header
2. **Organization Admin**: Can only access their own organization
3. **Users**: Can access their organization with proper membership

## Migration Process

### For Existing Systems

1. Run the migration script:
```bash
node scripts/migrate-schema.js
```

2. Update the database schema:
```bash
npx prisma db push
```

3. Create super admin:
```bash
node scripts/create-super-admin.js
```

### For New Systems

1. Run the setup script:
```bash
node setup.js
```

## Security Considerations

### Role Isolation
- Super Admin cannot be modified through regular user management
- Organization Admin can only manage their own organization
- Users are isolated to their organization

### Permission Granularity
- Module-based permissions for fine-grained access control
- Role-based permissions for easy management
- User-specific permissions for special cases

### Audit Logging
- All actions are logged with user context
- Organization-specific audit logs
- Platform-wide audit logs for Super Admin

## Testing

### Test Credentials

#### Super Admin
- Email: `meharsahil94@gmail.com`
- Password: `SuperAdmin123!`

#### Sample Organization Admin
- Email: `admin@sampleorg.com`
- Password: `Admin123!`

### Test Scenarios

1. **Super Admin Flow**
   - Login as Super Admin
   - Create new organization
   - Verify organization admin is created
   - Access platform analytics

2. **Organization Admin Flow**
   - Login as Organization Admin
   - Create users in organization
   - Assign roles and permissions
   - Create subscription

3. **User Management Flow**
   - Create users with different roles
   - Update user permissions
   - Deactivate/reactivate users

## Benefits of New Flow

1. **Clear Separation of Concerns**: Super Admin vs Organization Admin responsibilities
2. **Scalability**: Each organization is self-contained
3. **Security**: Proper role isolation and access control
4. **Flexibility**: Module-based permissions for fine-grained control
5. **Auditability**: Comprehensive logging of all actions
6. **Maintainability**: Clean API structure and middleware

## Future Enhancements

1. **Multi-tenancy**: Support for multiple organizations per user
2. **Advanced Permissions**: Time-based and conditional permissions
3. **Role Templates**: Predefined role templates for common use cases
4. **API Rate Limiting**: Organization-specific rate limiting
5. **Webhook Integration**: Real-time notifications for organization events 