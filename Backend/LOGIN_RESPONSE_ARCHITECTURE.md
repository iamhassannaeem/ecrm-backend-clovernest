# Login Response Architecture

## Overview

The login endpoint now provides different levels of organization information based on the user's system role. This ensures proper separation of concerns and data access control.

## User Roles and Response Structure

### 🔴 SUPER_ADMIN
**Purpose**: Platform-level administrator who manages the overall system

**Organization Access**: 
- ✅ Can see all organizations they've created (basic info only)
- ✅ Can see organizations they admin (basic info only)
- ❌ **NO** subscription details
- ❌ **NO** payment information
- ❌ **NO** detailed member lists
- ❌ **NO** organization-specific audit logs

**Response Structure**:
```json
{
  "user": {
    "systemRole": "SUPER_ADMIN",
    "organizations": [
      {
        "id": "org_id",
        "name": "Organization Name",
        "slug": "org-slug",
        "domain": "org.com",
        "description": "Description",
        "status": "ACTIVE",
        "createdAt": "2024-01-20T00:00:00.000Z",
        "updatedAt": "2024-01-20T00:00:00.000Z",
        "role": "SUPER_ADMIN"
      }
    ],
    "adminOrganizations": [
      {
        "id": "org_id",
        "name": "Organization Name",
        "slug": "org-slug",
        "domain": "org.com",
        "description": "Description",
        "status": "ACTIVE",
        "createdAt": "2024-01-20T00:00:00.000Z",
        "updatedAt": "2024-01-20T00:00:00.000Z",
        "role": "ORGANIZATION_ADMIN"
      }
    ]
  }
}
```

### 🟡 ORGANIZATION_ADMIN
**Purpose**: Organization-level administrator who manages their specific organization

**Organization Access**:
- ✅ Complete organization details
- ✅ All organization members with details
- ✅ Subscription information and payment details
- ✅ Organization roles and permissions
- ✅ Organization-specific audit logs
- ✅ Pending join requests
- ✅ Organization statistics

**Response Structure**:
```json
{
  "user": {
    "systemRole": "ORGANIZATION_ADMIN",
    "organizations": [
      {
        "id": "org_id",
        "name": "Organization Name",
        "slug": "org-slug",
        "domain": "org.com",
        "description": "Description",
        "logo": "https://...",
        "website": "https://org.com",
        "status": "ACTIVE",
        "trialEndsAt": "2024-02-20T00:00:00.000Z",
        "createdAt": "2024-01-20T00:00:00.000Z",
        "updatedAt": "2024-01-20T00:00:00.000Z",
        "role": "ORGANIZATION_ADMIN",
        "createdBy": {
          "id": "creator_id",
          "email": "creator@example.com",
          "firstName": "Jane",
          "lastName": "Smith"
        },
        "organization_users": [...],
        "subscriptions": [...],
        "roles": [...],
        "auditLogs": [...],
        "organization_join_requests": [...],
        "_count": {
          "organization_users": 25,
          "subscriptions": 1,
          "roles": 5,
          "auditLogs": 150,
          "organization_join_requests": 3
        }
      }
    ]
  }
}
```

### 🟢 USER
**Purpose**: Regular organization member

**Organization Access**:
- ✅ Basic organization information
- ✅ Their role in the organization
- ✅ Join requests they've made

**Response Structure**:
```json
{
  "user": {
    "systemRole": "USER",
    "organizations": [
      {
        "id": "org_id",
        "name": "Organization Name",
        "slug": "org-slug",
        "role": "USER"
      }
    ],
    "joinRequests": [...]
  }
}
```

## Implementation Details

### Two-Step Query Approach

1. **Initial Query**: Fetch basic user information and determine system role
2. **Conditional Query**: For ORGANIZATION_ADMIN users only, fetch complete organization details

### Benefits

- ✅ **Performance**: Super admins don't load unnecessary subscription/payment data
- ✅ **Security**: Proper data access control based on user role
- ✅ **Scalability**: Reduced database load for super admin logins
- ✅ **Clarity**: Clear separation between platform-level and organization-level data

### Database Queries

**For All Users**:
```sql
-- Basic user info with minimal organization data
SELECT * FROM users WHERE email = ?
-- Includes: basic org info, super admin permissions, join requests
```

**For ORGANIZATION_ADMIN Only**:
```sql
-- Complete organization details
SELECT * FROM organizations WHERE id = ?
-- Includes: members, subscriptions, roles, audit logs, join requests, counts
```

## Testing

Run the test script to verify both login responses:

```bash
node test-org-admin-login.js
```

This will test:
- Organization admin login with complete organization details
- Super admin login with basic organization information only

## Security Considerations

- Super admins cannot access organization-specific subscription/payment data
- Organization admins have full access to their organization's data
- Regular users have minimal access to organization information
- All responses are filtered based on user permissions 