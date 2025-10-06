# 🧪 Complete API Testing Guide

## 🚀 Quick Start Testing

### 1. Start the Server
```bash
npm run dev
```

### 2. Open Swagger UI
Navigate to: `http://localhost:3000/api-docs`

### 3. Complete Testing Workflow

## 📋 Step-by-Step Testing Process

### Phase 1: Authentication Testing

#### 1.1 User Registration
**Endpoint**: `POST /api/auth/register`
```json
{
  "email": "testuser@example.com",
  "password": "TestPassword123!",
  "firstName": "Test",
  "lastName": "User"
}
```
**Expected**: 201 Created with user data and JWT tokens

#### 1.2 Authorization Setup
1. Copy the `accessToken` from registration response
2. Click the 🔒 **Authorize** button at the top of Swagger UI
3. Enter: `Bearer YOUR_ACCESS_TOKEN_HERE`
4. Click **Authorize**

#### 1.3 Test Current User
**Endpoint**: `GET /api/auth/me`
**Expected**: User profile with organizations array

### Phase 2: Organization Management

#### 2.1 Create Organization
**Endpoint**: `POST /api/organizations`
```json
{
  "name": "Test Company",
  "description": "A test organization for API testing",
  "website": "https://testcompany.com"
}
```
**Expected**: 201 Created with organization data
**Note**: Copy the organization ID for next steps

#### 2.2 Get Organization Dashboard
**Endpoint**: `GET /api/admin/dashboard/{organizationId}`
**Expected**: Dashboard analytics with member stats, activity, and subscription info

#### 2.3 Get Organization Members
**Endpoint**: `GET /api/admin/members/{organizationId}`
**Expected**: List of organization members (should include the creator as ORGANIZATION_ADMIN)

### Phase 3: User Management Testing

#### 3.1 Update User Profile
**Endpoint**: `PUT /api/users/profile`
```json
{
  "firstName": "Updated",
  "lastName": "Name",
  "avatar": "https://example.com/avatar.jpg"
}
```
**Expected**: 200 OK with updated user data

#### 3.2 Get User Organizations
**Endpoint**: `GET /api/users/organizations`
**Expected**: List of organizations where user is a member

### Phase 4: Payment System Testing

#### 4.1 Create Subscription
**Endpoint**: `POST /api/payments/subscriptions`
```json
{
  "priceId": "price_test_123456",
  "organizationId": "YOUR_ORGANIZATION_ID"
}
```
**Expected**: 201 Created with subscription data and client secret
**Note**: Use a test Stripe price ID

#### 4.2 Get Organization Subscriptions
**Endpoint**: `GET /api/payments/subscriptions/{organizationId}`
**Expected**: List of subscriptions with payment history

#### 4.3 Create Payment Intent
**Endpoint**: `POST /api/payments/payment-intents`
```json
{
  "amount": 2999,
  "currency": "usd",
  "organizationId": "YOUR_ORGANIZATION_ID",
  "description": "One-time setup fee"
}
```
**Expected**: 201 Created with client secret for payment

### Phase 5: Super Admin Testing (if applicable)

#### 5.1 Platform Analytics
**Endpoint**: `GET /api/super-admin/analytics`
**Expected**: Platform-wide statistics
**Note**: Requires SUPER_ADMIN role

#### 5.2 All Platform Users
**Endpoint**: `GET /api/super-admin/users`
**Expected**: Paginated list of all platform users

#### 5.3 All Platform Organizations
**Endpoint**: `GET /api/super-admin/organizations`
**Expected**: Paginated list of all organizations

### Phase 6: Error Testing

#### 6.1 Test Without Authorization
1. Click 🔒 **Authorize** and click **Logout**
2. Try any protected endpoint
**Expected**: 401 Unauthorized

#### 6.2 Test Invalid Data
**Endpoint**: `POST /api/auth/register`
```json
{
  "email": "invalid-email",
  "password": "weak",
  "firstName": ""
}
```
**Expected**: 400 Bad Request with validation errors

#### 6.3 Test Permission Errors
1. Create a second user account
2. Try to access another organization's admin endpoints
**Expected**: 403 Forbidden

## 🎯 Advanced Testing Scenarios

### Multi-User Organization Testing

#### 1. Create Second User
```json
{
  "email": "member@example.com",
  "password": "MemberPassword123!",
  "firstName": "Team",
  "lastName": "Member"
}
```

#### 2. Invite to Organization
**Endpoint**: `POST /api/organizations/{organizationId}/invite`
```json
{
  "email": "member@example.com",
  "role": "ORG_MEMBER",
  "message": "Welcome to our team!"
}
```

#### 3. Test Role-Based Access
- Login as the new member
- Try admin endpoints (should fail with 403)
- Try member-level endpoints (should succeed)

### Payment Flow Testing

#### 1. Complete Subscription Flow
1. Create subscription
2. Check subscription status
3. Update subscription (change plan)
4. Get payment history
5. Cancel subscription

#### 2. Customer Portal Access
**Endpoint**: `POST /api/payments/customer-portal`
```json
{
  "organizationId": "YOUR_ORGANIZATION_ID",
  "returnUrl": "https://yourapp.com/dashboard"
}
```

### Audit Log Testing

#### 1. Generate Activity
- Create organizations
- Invite members
- Update member roles
- Create subscriptions

#### 2. Check Audit Logs
**Endpoint**: `GET /api/admin/audit-logs/{organizationId}`
**Expected**: List of all organization activities

## 🔍 Testing Checklist

### ✅ Authentication & Authorization
- [ ] User registration works
- [ ] User login works
- [ ] JWT token authorization works
- [ ] OAuth flows work (Google/GitHub)
- [ ] Token refresh works
- [ ] Logout works
- [ ] Password reset works

### ✅ User Management
- [ ] Get user profile works
- [ ] Update profile works
- [ ] Change password works
- [ ] Change email works
- [ ] Account deletion works
- [ ] Get user organizations works

### ✅ Organization Management
- [ ] Create organization works
- [ ] Get organizations works
- [ ] Update organization works
- [ ] Invite members works
- [ ] Remove members works
- [ ] Leave organization works

### ✅ Admin Panel
- [ ] Dashboard analytics work
- [ ] Member management works
- [ ] Role updates work
- [ ] Member deactivation works
- [ ] Audit logs work

### ✅ Payment System
- [ ] Create subscription works
- [ ] Get subscriptions works
- [ ] Update subscription works
- [ ] Cancel subscription works
- [ ] Payment intents work
- [ ] Customer portal works
- [ ] Payment history works

### ✅ Super Admin (if applicable)
- [ ] Platform analytics work
- [ ] User management works
- [ ] Organization management works
- [ ] Platform audit logs work

### ✅ Error Handling
- [ ] Validation errors return proper format
- [ ] Authentication errors work
- [ ] Authorization errors work
- [ ] Not found errors work
- [ ] Rate limiting works

### ✅ Webhooks
- [ ] Stripe webhook processes correctly
- [ ] Webhook signature verification works
- [ ] Subscription updates from webhooks work

## 🎉 Success Criteria

Your API testing is complete when:

1. **All endpoints respond correctly** with expected status codes
2. **Authentication flow works** end-to-end
3. **Role-based access control** functions properly
4. **Payment integration** processes successfully
5. **Error handling** returns proper error messages
6. **Data validation** catches invalid inputs
7. **Audit logging** tracks all activities
8. **Multi-tenant isolation** works correctly

## 🚨 Common Issues & Solutions

### Issue: 401 Unauthorized
**Solution**: Ensure you've clicked Authorize and entered `Bearer YOUR_TOKEN`

### Issue: 403 Forbidden
**Solution**: Check user role and organization membership

### Issue: 400 Validation Error
**Solution**: Review request body format and required fields

### Issue: 404 Not Found
**Solution**: Verify resource IDs are correct and resources exist

### Issue: 429 Rate Limited
**Solution**: Wait before retrying authentication endpoints

This comprehensive testing guide ensures your Cleaning Management System API is fully functional and ready for production use!
