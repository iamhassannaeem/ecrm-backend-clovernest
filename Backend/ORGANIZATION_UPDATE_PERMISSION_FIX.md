# Organization Update Permission Fix

## Issue Description

Organization admins were getting permission errors when trying to update their organization details (name, description, website, etc.) through the `/api/organizations/{organizationId}` PUT endpoint.

**Error Message:**
```
You don't have permission to update organizations. Required organization permissions.
```

## Root Cause

The issue was in the `updateOrganization` function in `Backend/src/controllers/organizationsController.js`. The permission check was using the wrong resource name:

**Incorrect:**
```javascript
if (!PermissionService.hasPermission(req.user, 'UPDATE', 'ORGANIZATIONS')) {
```

**Correct:**
```javascript
if (!PermissionService.hasPermission(req.user, 'UPDATE', 'ORGANIZATION_SETTINGS') && 
    !PermissionService.hasPermission(req.user, 'MANAGE', 'ORGANIZATION_SETTINGS')) {
```

## The Problem

1. **Wrong Permission Resource**: The code was checking for `'ORGANIZATIONS'` permission, but the actual permission resource defined in the system is `'ORGANIZATION_SETTINGS'`.

2. **Missing Permission Action**: Organization admins have `'MANAGE'` permission on `'ORGANIZATION_SETTINGS'`, but the code was only checking for `'UPDATE'` action.

## The Solution

### Updated Permission Check

The permission check now accepts both `'UPDATE'` and `'MANAGE'` actions on the `'ORGANIZATION_SETTINGS'` resource:

```javascript
// Check if user has permission to update this organization
if (!PermissionService.hasPermission(req.user, 'UPDATE', 'ORGANIZATION_SETTINGS') && 
    !PermissionService.hasPermission(req.user, 'MANAGE', 'ORGANIZATION_SETTINGS')) {
  return res.status(403).json({
    error: 'You don\'t have permission to update organization settings. Required organization permissions.',
    code: 'PERMISSION_DENIED'
  });
}
```

### Organization Admin Permissions

Based on the seed data, organization admins have the following permissions:

```javascript
// From prisma/seed.js
{ action: 'MANAGE', resource: 'ORGANIZATION_SETTINGS' }
```

This means organization admins can:
- Update organization name
- Update organization description
- Update organization website
- Update organization currency and language
- Upload organization logo

## Testing

Use the provided test script to verify the fix:

```bash
# Update the credentials in the test file first
node test-org-update.js
```

**Test Steps:**
1. Login as organization admin
2. Get current organization details
3. Update organization settings
4. Verify the changes are persisted

## API Endpoint

### PUT `/api/organizations/{organizationId}`

**Required Permissions:**
- `UPDATE` or `MANAGE` permission on `ORGANIZATION_SETTINGS`

**Request Body:**
```json
{
  "name": "Updated Organization Name",
  "description": "Updated organization description",
  "website": "https://updated-website.com",
  "currency": "USD",
  "language": "en"
}
```

**Response:**
```json
{
  "message": "Organization updated successfully",
  "organization": {
    "id": 13,
    "name": "Updated Organization Name",
    "description": "Updated organization description",
    "website": "https://updated-website.com",
    "currency": "USD",
    "language": "en",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

## Permission System Overview

### Available Permission Resources

The system uses the following permission resources for organization-level operations:

- `ORGANIZATION_SETTINGS` - Organization details and settings
- `USER_MANAGEMENT` - User creation, updates, deletion
- `USER_ROLES` - Role management
- `ORGANIZATION_USERS` - User organization membership
- `ORGANIZATION_INVITATIONS` - User invitations
- `CONTENT_CREATION` - Content management
- `LEAD_ASSIGNMENT` - Lead assignment and management
- `FORM_CUSTOMIZATION` - Form customization
- `FIELD_TYPE_CONFIGURATION` - Field type configuration

### Available Permission Actions

- `CREATE` - Create new resources
- `READ` - View resources
- `UPDATE` - Modify existing resources
- `DELETE` - Remove resources
- `MANAGE` - Full control (includes all other actions)

## Migration Notes

This fix is backward compatible and doesn't require any database changes. The existing organization admin roles already have the correct permissions (`MANAGE` on `ORGANIZATION_SETTINGS`).

## Related Files

- `Backend/src/controllers/organizationsController.js` - Fixed permission check
- `Backend/test-org-update.js` - Test script for verification
- `Backend/prisma/seed.js` - Permission definitions
- `Backend/src/services/permissionService.js` - Permission checking logic 