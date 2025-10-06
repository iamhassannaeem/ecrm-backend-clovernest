# 🏢 Admin Dashboard System Guide

## 📊 Organization Admin Dashboard

### Overview
The organization admin dashboard provides comprehensive analytics and management tools for organization administrators. Each organization has its own isolated admin panel with role-based access control.

### Key Features
- **📈 Analytics Dashboard**: Member statistics, activity trends, subscription status
- **👥 Member Management**: View, invite, and manage organization members
- **🔐 Permission System**: Granular role-based permissions
- **📋 Audit Logs**: Complete activity tracking
- **💳 Subscription Management**: Billing and subscription oversight

## 🔐 Role-Based Permission System

### User Roles Hierarchy

1. **SUPER_ADMIN** 
   - Platform-wide access
   - All organization management
   - User role assignments
   - Platform analytics

2. **ORGANIZATION_ADMIN**
   - Full organization management
   - Member management
   - Permission assignments
   - Organization analytics

3. **ORG_MEMBER**
   - Limited organization access
   - Custom permissions assigned by admins
   - Basic organization features

4. **USER**
   - Basic access
   - Custom permissions assigned by admins
   - Limited organization features

### Permission Actions
- **CREATE**: Create new resources
- **READ**: View and access resources
- **UPDATE**: Modify existing resources
- **DELETE**: Remove resources
- **MANAGE**: Full control over resources

### Permission Resources
- **USER**: User management and profiles
- **ORGANIZATION**: Organization settings and data
- **SUBSCRIPTION**: Billing and subscription management
- **PAYMENT**: Payment methods and history
- **ADMIN_PANEL**: Admin dashboard access

## 🧪 Testing the Admin Dashboard

### Step 1: Setup Super Admin
1. **Set Super Admin Email** in `.env`:
   ```env
   SUPER_ADMIN_EMAIL=your-email@example.com
   ```

2. **Register/Login** with that email address
3. **Access Super Admin Dashboard**: All super admin endpoints are now available

### Step 2: Test Organization Admin Dashboard

#### Create Organization and Test Dashboard
```bash
# 1. Create organization
POST /api/organizations
{
  "name": "Test Company",
  "description": "A test organization for admin testing"
}

# 2. Access organization dashboard
GET /api/admin/dashboard/{organizationId}
```

**Expected Dashboard Data**:
- Organization details
- Member statistics (total, by role, active today, new this month)
- Activity statistics (total actions, today, this week)
- Subscription status
- Recent activity logs

#### Test Member Management
```bash
# 1. Get organization members
GET /api/admin/members/{organizationId}

# 2. Invite new member
POST /api/organizations/{organizationId}/invite
{
  "email": "newmember@example.com",
  "role": "ORG_MEMBER"
}

# 3. Update member role
PUT /api/admin/members/{organizationId}/{userId}/role
{
  "role": "ORGANIZATION_ADMIN"
}
```

#### Test Permission Management
```bash
# 1. Get available permissions
GET /api/admin/permissions/{organizationId}

# 2. Get member permissions
GET /api/admin/members/{organizationId}/{userId}/permissions

# 3. Update member permissions
PUT /api/admin/members/{organizationId}/{userId}/permissions
{
  "permissions": [
    { "action": "READ", "resource": "USER" },
    { "action": "UPDATE", "resource": "USER" },
    { "action": "READ", "resource": "ADMIN_PANEL" }
  ]
}
```

### Step 3: Test Super Admin Dashboard

#### Platform Analytics
```bash
# Get comprehensive platform statistics
GET /api/super-admin/stats
```

**Expected Analytics**:
- User statistics (total, active, growth trends)
- Organization statistics (total, by status, growth)
- Subscription statistics (active, trial, cancelled)
- Revenue analytics (total, monthly, growth percentage)
- Platform activity metrics

#### Organization Analytics
```bash
# Get detailed organization analytics
GET /api/super-admin/organizations/{organizationId}/analytics
```

**Expected Data**:
- Member growth trends (30-day chart data)
- Activity trends (7-day chart data)
- Role distribution
- Subscription status

#### User Role Management
```bash
# 1. Get user's organization memberships
GET /api/super-admin/users/{userId}/organizations

# 2. Update user role in organization
PUT /api/super-admin/users/{userId}/organizations
{
  "organizationId": "cm456def789ghi012",
  "role": "ORGANIZATION_ADMIN"
}
```

## 📊 Dashboard Analytics Explained

### Organization Dashboard Metrics

**Member Statistics**:
- `total`: Total organization members
- `admins`: Number of organization administrators
- `members`: Number of organization members
- `users`: Number of regular users
- `activeToday`: Members who logged in today
- `newThisMonth`: New members joined this month

**Activity Statistics**:
- `totalActions`: All audit log entries
- `todayActions`: Actions performed today
- `weekActions`: Actions in the last 7 days

### Super Admin Dashboard Metrics

**User Analytics**:
- Growth trends and registration patterns
- Active vs inactive user ratios
- Geographic distribution (if implemented)

**Organization Analytics**:
- Organization status distribution
- Growth and churn rates
- Subscription conversion rates

**Revenue Analytics**:
- Monthly recurring revenue (MRR)
- Revenue growth percentage
- Payment success rates

## 🔧 Permission Testing Scenarios

### Scenario 1: Organization Member with Limited Permissions
1. Create user with `ORG_MEMBER` role
2. Assign only `READ` permissions for `USER` and `ADMIN_PANEL`
3. Test access to various endpoints
4. Verify they can only read user data, not modify

### Scenario 2: Organization Admin with Full Access
1. Create user with `ORGANIZATION_ADMIN` role
2. Test all organization management endpoints
3. Verify they can manage members and permissions
4. Confirm they cannot access super admin features

### Scenario 3: Super Admin with Platform Access
1. Use super admin account
2. Test platform-wide analytics
3. Test organization management across all orgs
4. Test user role assignments

## 🚨 Security Testing

### Test Permission Boundaries
1. **Cross-Organization Access**: Ensure users cannot access other organizations
2. **Role Escalation**: Verify users cannot elevate their own permissions
3. **Admin Protection**: Confirm admin permissions cannot be modified by non-admins
4. **Super Admin Protection**: Ensure only designated super admins have platform access

### Test Authentication
1. **Token Validation**: Test with invalid/expired tokens
2. **Role Verification**: Test endpoints with insufficient permissions
3. **Organization Context**: Test with wrong organization IDs

## 📈 Analytics Dashboard Features

### Real-time Metrics
- Live member count updates
- Real-time activity tracking
- Current subscription status

### Historical Data
- 30-day member growth charts
- 7-day activity trends
- Monthly revenue comparisons

### Actionable Insights
- Member engagement levels
- Feature usage patterns
- Subscription health indicators

## 🎯 Testing Checklist

### Organization Admin Dashboard
- [ ] Dashboard loads with correct analytics
- [ ] Member statistics are accurate
- [ ] Activity metrics are calculated correctly
- [ ] Recent activity shows relevant actions
- [ ] Subscription status is displayed correctly

### Permission Management
- [ ] Available permissions list correctly
- [ ] Member permissions can be viewed
- [ ] Permissions can be updated successfully
- [ ] Permission changes take effect immediately
- [ ] Admin permissions cannot be modified

### Super Admin Dashboard
- [ ] Platform statistics are comprehensive
- [ ] Organization analytics show detailed insights
- [ ] User role management works correctly
- [ ] Cross-organization access is available
- [ ] Revenue analytics are accurate

### Security & Access Control
- [ ] Role-based access is enforced
- [ ] Cross-organization access is prevented
- [ ] Permission boundaries are respected
- [ ] Admin privileges are protected
- [ ] Super admin access is restricted

This comprehensive admin dashboard system provides powerful tools for managing multi-tenant organizations with granular permission control! 🚀
