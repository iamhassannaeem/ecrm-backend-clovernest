# Module-Based Permission Management System

## Overview

The system now includes a comprehensive module-based permission management system that allows organization admins to manage user permissions granularly across different functional modules. This provides fine-grained access control while maintaining ease of use through templates and organized permission groups.

## Key Features

### 🎯 **Module-Based Organization**
Permissions are organized into logical modules:
- **User Management** - User profiles, roles, and management
- **Organization Management** - Organization settings and member management
- **Financial Management** - Subscriptions, payments, and billing
- **Analytics & Reporting** - Dashboard access and report generation
- **Content Management** - Content creation, editing, and publishing
- **Communication** - Notifications, emails, and announcements
- **Security** - Security settings and access control
- **Integrations** - Third-party integrations and API management
- **Administration** - Admin dashboard and system configuration

### 🎨 **Permission Templates**
Pre-defined permission sets for common roles:
- **Content Manager** - Full content management access
- **User Manager** - User and profile management
- **Financial Manager** - Complete financial operations
- **Analytics Viewer** - Read-only analytics access
- **Communication Manager** - All communication channels
- **Security Manager** - Security and access control
- **Integration Manager** - API and integration management
- **Read Only** - Basic read access across modules

### 📊 **Comprehensive Dashboard**
- Permission overview and statistics
- Module usage analytics
- Role distribution insights
- Member permission mapping

## Database Schema Updates

### Enhanced Permission Resources

```prisma
enum PermissionResource {
  // User Management Module
  USER_MANAGEMENT
  USER_PROFILES
  USER_ROLES
  
  // Organization Module
  ORGANIZATION_SETTINGS
  ORGANIZATION_MEMBERS
  ORGANIZATION_INVITATIONS
  
  // Financial Module
  SUBSCRIPTION_MANAGEMENT
  PAYMENT_METHODS
  BILLING_HISTORY
  INVOICES
  
  // Analytics & Reporting Module
  ANALYTICS_DASHBOARD
  REPORTS_GENERATION
  AUDIT_LOGS
  
  // Content Management Module
  CONTENT_CREATION
  CONTENT_EDITING
  CONTENT_PUBLISHING
  
  // Communication Module
  NOTIFICATIONS
  EMAIL_CAMPAIGNS
  ANNOUNCEMENTS
  
  // Security Module
  SECURITY_SETTINGS
  ACCESS_CONTROL
  API_KEYS
  
  // Integration Module
  THIRD_PARTY_INTEGRATIONS
  WEBHOOKS
  API_MANAGEMENT
  
  // Admin Panel Access
  ADMIN_DASHBOARD
  SYSTEM_CONFIGURATION
}
```

## API Endpoints

### **Permission Module Management**

#### **GET /api/admin/permissions/{organizationId}**
Get available permissions organized by modules.

**Response:**
```json
{
  "modules": [
    {
      "name": "User Management",
      "description": "Manage users, profiles, and roles within the organization",
      "permissions": [
        {
          "action": "READ",
          "resource": "USER_MANAGEMENT",
          "description": "View user list and basic information"
        },
        {
          "action": "CREATE",
          "resource": "USER_MANAGEMENT",
          "description": "Invite new users to organization"
        }
      ]
    }
  ]
}
```

### **Permission Templates**

#### **GET /api/admin/permission-templates/{organizationId}**
Get predefined permission templates.

**Response:**
```json
{
  "templates": [
    {
      "name": "Content Manager",
      "description": "Full access to content creation, editing, and publishing",
      "permissions": [
        { "action": "CREATE", "resource": "CONTENT_CREATION" },
        { "action": "UPDATE", "resource": "CONTENT_EDITING" },
        { "action": "MANAGE", "resource": "CONTENT_PUBLISHING" }
      ]
    }
  ]
}
```

#### **POST /api/admin/members/{organizationId}/{userId}/apply-template**
Apply a permission template to a user.

**Request:**
```json
{
  "templateName": "Content Manager",
  "additionalPermissions": [
    { "action": "READ", "resource": "ANALYTICS_DASHBOARD" }
  ]
}
```

### **Individual Permission Management**

#### **GET /api/admin/members/{organizationId}/{userId}/permissions**
Get specific user's permissions.

#### **PUT /api/admin/members/{organizationId}/{userId}/permissions**
Update user's permissions with granular control.

**Request:**
```json
{
  "permissions": [
    { "action": "READ", "resource": "USER_MANAGEMENT" },
    { "action": "UPDATE", "resource": "USER_PROFILES" },
    { "action": "CREATE", "resource": "CONTENT_CREATION" },
    { "action": "MANAGE", "resource": "NOTIFICATIONS" }
  ]
}
```

### **Permissions Dashboard**

#### **GET /api/admin/permissions-dashboard/{organizationId}**
Get comprehensive permissions overview with analytics.

**Query Parameters:**
- `module` - Filter by specific module
- `role` - Filter by user role

**Response:**
```json
{
  "summary": {
    "totalMembers": 25,
    "membersWithCustomPermissions": 15,
    "roleDistribution": {
      "ORGANIZATION_ADMIN": 2,
      "ORG_MEMBER": 8,
      "USER": 15
    },
    "moduleUsage": {
      "User Management": {
        "membersWithAccess": 12,
        "percentage": 48
      },
      "Content Management": {
        "membersWithAccess": 8,
        "percentage": 32
      }
    }
  },
  "members": [
    {
      "user": { "id": "...", "email": "...", "firstName": "..." },
      "role": "USER",
      "permissions": [...],
      "permissionsByModule": {
        "User Management": [...],
        "Content Management": [...]
      },
      "hasCustomPermissions": true
    }
  ]
}
```

## Usage Examples

### **1. Assign Content Manager Role**
```javascript
// Apply Content Manager template
const response = await fetch('/api/admin/members/orgId/userId/apply-template', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    templateName: 'Content Manager',
    additionalPermissions: [
      { action: 'READ', resource: 'ANALYTICS_DASHBOARD' }
    ]
  })
});
```

### **2. Custom Permission Assignment**
```javascript
// Assign specific permissions
const response = await fetch('/api/admin/members/orgId/userId/permissions', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    permissions: [
      { action: 'READ', resource: 'USER_MANAGEMENT' },
      { action: 'UPDATE', resource: 'USER_PROFILES' },
      { action: 'CREATE', resource: 'CONTENT_CREATION' },
      { action: 'READ', resource: 'ANALYTICS_DASHBOARD' }
    ]
  })
});
```

### **3. Get Module-Specific Permissions**
```javascript
// Get permissions for Content Management module only
const response = await fetch('/api/admin/permissions-dashboard/orgId?module=Content Management', {
  headers: { 'Authorization': 'Bearer ' + token }
});
```

## Permission Templates Details

### **Content Manager**
- Create, read, update, delete content
- Manage content publishing
- Full content workflow control

### **User Manager**
- View and manage user list
- Edit user profiles
- Assign user roles
- Handle user invitations

### **Financial Manager**
- Manage subscriptions
- Handle payment methods
- Access billing history
- Generate invoices

### **Analytics Viewer**
- View analytics dashboard
- Generate reports
- Access audit logs (read-only)

### **Communication Manager**
- Send notifications
- Manage email campaigns
- Create announcements
- Handle all communication channels

### **Security Manager**
- Configure security settings
- Manage access control
- Generate and manage API keys
- Handle security policies

### **Integration Manager**
- Configure third-party integrations
- Manage webhooks
- Handle API configurations
- Monitor integration usage

### **Read Only**
- Basic read access across most modules
- No modification or management permissions
- Suitable for viewers and auditors

## Best Practices

### **1. Use Templates First**
Start with permission templates that match common roles, then customize as needed.

### **2. Regular Permission Audits**
Use the permissions dashboard to regularly review and audit user permissions.

### **3. Principle of Least Privilege**
Grant only the minimum permissions necessary for users to perform their tasks.

### **4. Module-Based Thinking**
Organize permissions by business function rather than technical implementation.

### **5. Document Custom Permissions**
When creating custom permission sets, document the business justification.

## Security Considerations

- **Admin-Only Management**: Only organization admins can modify permissions
- **No Self-Modification**: Admins cannot modify their own permissions
- **Audit Trail**: All permission changes are logged
- **Template Validation**: Templates are validated before application
- **Resource Validation**: All permission resources are validated against the enum

## Testing

Use the provided test script to verify the permission system:

```bash
node test-permission-system.js
```

This will test all major functionality including module organization, template application, custom permissions, and dashboard analytics.
