# 🧪 Step-by-Step API Testing Guide

## 🚀 Quick Setup

### 1. Start Server
```bash
npm run dev
```

### 2. Open Swagger UI
```
http://localhost:3000/api-docs
```

## 🔐 Phase 1: Get Authorization Token

### Step 1: Register New User
**Endpoint**: `POST /api/auth/register`

**Test Data**:
```json
{
  "email": "testuser@example.com",
  "password": "TestPassword123!",
  "firstName": "Test",
  "lastName": "User"
}
```

**Expected Response**:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "cm123abc456def789",
    "email": "testuser@example.com",
    "firstName": "Test",
    "lastName": "User"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Step 2: Authorize in Swagger
1. **Copy the `accessToken`** from the response above
2. Click the 🔒 **Authorize** button at the top of Swagger UI
3. Enter: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. Click **Authorize**

✅ **You're now authorized to test all protected endpoints!**

## 👤 Phase 2: User Management Testing

### Test 1: Get Current User
**Endpoint**: `GET /api/auth/me`
- Should return your user profile with organizations

### Test 2: Update Profile
**Endpoint**: `PUT /api/users/profile`
```json
{
  "firstName": "Updated",
  "lastName": "Name",
  "avatar": "https://example.com/avatar.jpg"
}
```

### Test 3: Change Password
**Endpoint**: `PUT /api/users/password`
```json
{
  "currentPassword": "TestPassword123!",
  "newPassword": "NewPassword456!"
}
```

## 🏢 Phase 3: Organization Management

### Test 1: Create Organization
**Endpoint**: `POST /api/organizations`
```json
{
  "name": "Test Company",
  "description": "A test organization for API testing",
  "website": "https://testcompany.com"
}
```
**📝 Copy the organization ID from response for next tests**

### Test 2: Get Organizations
**Endpoint**: `GET /api/organizations`
- Should show your created organization

### Test 3: Get Organization Details
**Endpoint**: `GET /api/organizations/{organizationId}`
- Use the organization ID from Test 1

### Test 4: Update Organization
**Endpoint**: `PUT /api/organizations/{organizationId}`
```json
{
  "name": "Updated Company Name",
  "description": "Updated description"
}
```

## 👥 Phase 4: Admin Panel Testing

### Test 1: Organization Dashboard
**Endpoint**: `GET /api/admin/dashboard/{organizationId}`
- Should return analytics and member stats

### Test 2: Get Members
**Endpoint**: `GET /api/admin/members/{organizationId}`
- Should show you as ORGANIZATION_ADMIN

### Test 3: Invite Member
**Endpoint**: `POST /api/organizations/{organizationId}/invite`
```json
{
  "email": "newmember@example.com",
  "role": "ORG_MEMBER",
  "message": "Welcome to our team!"
}
```

### Test 4: Get Audit Logs
**Endpoint**: `GET /api/admin/audit-logs/{organizationId}`
- Should show organization activities

## 💳 Phase 5: Payment System Testing

### Test 1: Create Subscription
**Endpoint**: `POST /api/payments/subscriptions`
```json
{
  "priceId": "price_test_123456",
  "organizationId": "YOUR_ORGANIZATION_ID"
}
```
**Note**: Use a test Stripe price ID

### Test 2: Get Subscriptions
**Endpoint**: `GET /api/payments/subscriptions/{organizationId}`

### Test 3: Create Payment Intent
**Endpoint**: `POST /api/payments/payment-intents`
```json
{
  "amount": 2999,
  "currency": "usd",
  "organizationId": "YOUR_ORGANIZATION_ID",
  "description": "One-time setup fee"
}
```

### Test 4: Get Payment History
**Endpoint**: `GET /api/payments/payments/{organizationId}`

## 👑 Phase 6: Super Admin Testing (Optional)

**Note**: Only works if your email matches `SUPER_ADMIN_EMAIL` in .env

### Test 1: Platform Analytics
**Endpoint**: `GET /api/super-admin/analytics`

### Test 2: All Users
**Endpoint**: `GET /api/super-admin/users`

### Test 3: All Organizations
**Endpoint**: `GET /api/super-admin/organizations`

## 🚨 Phase 7: Error Testing

### Test 1: Test Without Authorization
1. Click 🔒 **Authorize** and click **Logout**
2. Try any protected endpoint
3. Should get 401 Unauthorized

### Test 2: Test Invalid Data
**Endpoint**: `POST /api/auth/register`
```json
{
  "email": "invalid-email",
  "password": "weak",
  "firstName": ""
}
```
Should get 400 Bad Request with validation errors

### Test 3: Test Non-existent Resource
**Endpoint**: `GET /api/organizations/invalid-id`
Should get 404 Not Found

## 🔄 Token Refresh Testing

### When Token Expires
**Endpoint**: `POST /api/auth/refresh`
```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN_FROM_LOGIN"
}
```

## 📱 Alternative: Testing with Postman/curl

### Setup Postman Collection
1. Create new collection "Cleaning Management API"
2. Add environment variable `baseUrl`: `http://localhost:3000`
3. Add environment variable `token`: (will be set after login)

### Example curl Commands
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!","firstName":"Test","lastName":"User"}'

# Get current user (after getting token)
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Create organization
curl -X POST http://localhost:3000/api/organizations \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Company","description":"Test org"}'
```

## ✅ Testing Checklist

### Authentication ✅
- [ ] User registration
- [ ] User login  
- [ ] Token authorization
- [ ] Token refresh
- [ ] User logout

### User Management ✅
- [ ] Get profile
- [ ] Update profile
- [ ] Change password
- [ ] Get organizations

### Organization Management ✅
- [ ] Create organization
- [ ] Get organizations
- [ ] Update organization
- [ ] Invite members

### Admin Panel ✅
- [ ] Dashboard analytics
- [ ] Member management
- [ ] Audit logs

### Payment System ✅
- [ ] Create subscription
- [ ] Payment intents
- [ ] Payment history

### Error Handling ✅
- [ ] Validation errors
- [ ] Authentication errors
- [ ] Authorization errors
- [ ] Not found errors

## 🎯 Pro Tips

1. **Always test in this order**: Auth → User → Org → Admin → Payments
2. **Save important IDs**: Copy organization IDs for later tests
3. **Test error cases**: Invalid data, missing auth, wrong permissions
4. **Use realistic data**: Makes testing more meaningful
5. **Check response formats**: Ensure they match documentation

## 🚀 Ready to Test!

You now have everything needed to test every API endpoint. Start with Phase 1 to get your authorization token, then work through each phase systematically. The Swagger UI makes this process interactive and easy!
