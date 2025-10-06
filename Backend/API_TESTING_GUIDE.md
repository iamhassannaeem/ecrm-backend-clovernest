# 🧪 API Testing Guide - Interactive Swagger Documentation

## 🚀 Quick Start Testing

### Step 1: Start the Server
```bash
npm run dev
```

### Step 2: Open Swagger UI
Navigate to: **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

## 🔐 Authentication Testing Flow

### 1. Register a New User
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
- Status: `201 Created`
- Returns: User object + JWT tokens
- Copy the `accessToken` from the response

### 2. Authorize in Swagger
1. Click the **🔒 Authorize** button at the top of Swagger UI
2. Enter: `Bearer YOUR_ACCESS_TOKEN_HERE`
3. Click **Authorize**
4. All protected endpoints are now accessible!

### 3. Alternative: Login with Existing User
**Endpoint**: `POST /api/auth/login`

**Test Data**:
```json
{
  "email": "testuser@example.com",
  "password": "TestPassword123!"
}
```

## 🏢 Organization Management Testing

### 1. Create Organization
**Endpoint**: `POST /api/organizations`

**Test Data**:
```json
{
  "name": "My Test Company",
  "description": "A test organization for API testing",
  "website": "https://mytestcompany.com"
}
```

### 2. Get User's Organizations
**Endpoint**: `GET /api/organizations`
- No request body needed
- Returns all organizations where user is a member

### 3. Get Organization Details
**Endpoint**: `GET /api/organizations/{organizationId}`
- Use the organization ID from previous responses
- Returns detailed organization info with members and subscriptions

### 4. Update Organization
**Endpoint**: `PUT /api/organizations/{organizationId}`

**Test Data**:
```json
{
  "name": "Updated Company Name",
  "description": "Updated description"
}
```

### 5. Invite User to Organization
**Endpoint**: `POST /api/organizations/{organizationId}/invite`

**Test Data**:
```json
{
  "email": "newmember@example.com",
  "role": "ORG_MEMBER",
  "message": "Welcome to our organization!"
}
```

## 👤 User Profile Testing

### 1. Get Current User Profile
**Endpoint**: `GET /api/users/profile`
- Returns detailed user profile with organizations

### 2. Update User Profile
**Endpoint**: `PUT /api/users/profile`

**Test Data**:
```json
{
  "firstName": "Updated First",
  "lastName": "Updated Last",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

### 3. Change Password
**Endpoint**: `PUT /api/users/password`

**Test Data**:
```json
{
  "currentPassword": "TestPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

## 🔄 Token Management Testing

### 1. Refresh Access Token
**Endpoint**: `POST /api/auth/refresh`

**Test Data**:
```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
}
```

### 2. Logout
**Endpoint**: `POST /api/auth/logout`

**Test Data**:
```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
}
```

## 👑 Super Admin Testing

### Prerequisites
1. Set your email in `.env` file: `SUPER_ADMIN_EMAIL=your-email@example.com`
2. Register/login with that email
3. You'll have super admin privileges

### 1. Get Platform Statistics
**Endpoint**: `GET /api/super-admin/stats`
- Returns platform-wide statistics

### 2. Get All Organizations
**Endpoint**: `GET /api/super-admin/organizations`
- Returns all organizations on the platform

### 3. Update Organization Status
**Endpoint**: `PUT /api/super-admin/organizations/{organizationId}/status`

**Test Data**:
```json
{
  "status": "SUSPENDED"
}
```

## 🧪 Advanced Testing Scenarios

### Test Different User Roles
1. Create multiple users
2. Create organizations
3. Invite users with different roles
4. Test permission-based endpoints

### Test Error Scenarios
1. **Invalid Authentication**: Remove Bearer token and test protected endpoints
2. **Validation Errors**: Send invalid data (empty required fields, invalid emails)
3. **Permission Errors**: Try accessing admin endpoints as regular user
4. **Not Found Errors**: Use non-existent IDs

### Test Rate Limiting
1. Make multiple rapid requests to auth endpoints
2. Should receive `429 Too Many Requests` after limit

## 📊 Response Examples

### Success Response Format
```json
{
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## 🔍 Testing Tips

1. **Use Examples**: Each endpoint has pre-filled examples in Swagger UI
2. **Check Response Codes**: Verify you get expected HTTP status codes
3. **Test Edge Cases**: Try invalid data, missing fields, wrong IDs
4. **Test Permissions**: Try accessing endpoints with different user roles
5. **Monitor Logs**: Check server logs for detailed error information

## 🚨 Common Issues & Solutions

### Issue: "Authentication required"
**Solution**: Make sure you've clicked "Authorize" and entered your Bearer token

### Issue: "Organization not found"
**Solution**: Use a valid organization ID from your previous responses

### Issue: "Permission denied"
**Solution**: Ensure your user has the required role for the endpoint

### Issue: "Validation failed"
**Solution**: Check the request schema and ensure all required fields are provided

## 🎯 Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] JWT token authorization works
- [ ] Organization creation works
- [ ] Organization member management works
- [ ] User profile management works
- [ ] Token refresh works
- [ ] Super admin features work (if applicable)
- [ ] Error handling works correctly
- [ ] Rate limiting works

Happy Testing! 🚀
