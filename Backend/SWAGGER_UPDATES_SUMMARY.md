# Swagger Documentation Updates Summary

## Overview

The Swagger documentation has been comprehensively updated to reflect the new system flow with Super Admin organization creation, domain names, and user approval workflows.

## Updated API Documentation

### 🔄 **Updated Flow Description**

The main Swagger page now includes:
- **Step-by-step testing guide** for the new registration flow
- **Organization selection process** explanation
- **Join request approval workflow** documentation
- **Super Admin organization creation** instructions

### 📋 **New Schemas Added**

#### 1. **OrganizationJoinRequest**
```yaml
OrganizationJoinRequest:
  type: object
  properties:
    id: string
    status: enum [PENDING, APPROVED, REJECTED]
    requestedRole: enum [USER, ORG_MEMBER]
    message: string
    requestedAt: date-time
    reviewedAt: date-time
    user: User
    organization: AvailableOrganization
    reviewedBy: object
```

#### 2. **AvailableOrganization**
```yaml
AvailableOrganization:
  type: object
  properties:
    id: string
    name: string
    domain: string
    description: string
```

### 🔧 **Updated Schemas**

#### 1. **Organization Schema**
- **Added** `domain` field (required, unique)
- **Updated** examples to include domain names
- **Enhanced** descriptions for clarity

#### 2. **RegisterRequest Schema**
- **Added** `organizationId` field (required)
- **Added** `message` field (optional, max 500 chars)
- **Updated** examples to show organization selection
- **Enhanced** validation descriptions

#### 3. **CreateOrganizationRequest Schema**
- **Completely redesigned** for Super Admin use
- **Added** `domain` field (required, with pattern validation)
- **Added** admin user creation fields:
  - `adminEmail` (required)
  - `adminFirstName` (required)
  - `adminLastName` (optional)
  - `adminPassword` (required, min 8 chars)
- **Updated** examples and descriptions

#### 4. **AuthResponse Schema**
- **Added** `joinRequests` array to user object
- **Enhanced** to show join request status in login response
- **Updated** examples to include pending requests

### 🆕 **New Endpoint Documentation**

#### 1. **GET /api/auth/organizations**
```yaml
summary: Get available organizations for signup
description: Get list of organizations that users can request to join
responses:
  200:
    description: List of available organizations
    schema:
      type: object
      properties:
        organizations:
          type: array
          items:
            $ref: '#/components/schemas/AvailableOrganization'
```

#### 2. **POST /api/auth/register** (Updated)
```yaml
summary: Register a new user with organization selection
description: Register a new user and create a join request for the selected organization
requestBody:
  schema:
    $ref: '#/components/schemas/RegisterRequest'
responses:
  201:
    description: User registered successfully, join request created
    schema:
      properties:
        message: string
        user: User
        joinRequest: OrganizationJoinRequest
```

#### 3. **GET /api/auth/join-requests**
```yaml
summary: Get user's join requests status
description: Retrieve all join requests made by the authenticated user
responses:
  200:
    description: List of user's join requests
    schema:
      properties:
        joinRequests:
          type: array
          items:
            $ref: '#/components/schemas/OrganizationJoinRequest'
```

#### 4. **Organization Join Request Management**
- **GET /api/organizations/{orgId}/join-requests** - View pending requests
- **POST /api/organizations/{orgId}/join-requests/{reqId}/approve** - Approve request
- **POST /api/organizations/{orgId}/join-requests/{reqId}/reject** - Reject request

#### 5. **POST /api/super-admin/organizations** (Updated)
```yaml
summary: Create a new organization (Super Admin only)
description: Create organization with automatic admin user creation
requestBody:
  schema:
    $ref: '#/components/schemas/CreateOrganizationRequest'
responses:
  201:
    description: Organization and admin user created successfully
    schema:
      properties:
        message: string
        organization: Organization
        admin: User
```

### 🚫 **Deprecated/Restricted Endpoints**

#### **POST /api/organizations** (Restricted)
- **Updated** to return 403 Forbidden
- **Added** clear error message about Super Admin restriction
- **Documented** alternative endpoint for Super Admins

### 📊 **Enhanced Examples**

All endpoints now include:
- **Realistic example data** with proper domain names
- **Multiple example scenarios** (success, validation errors, etc.)
- **Detailed field descriptions** with validation rules
- **Clear error response examples**

### 🔐 **Security Documentation Updates**

- **Updated** authentication flow descriptions
- **Added** role-based access control explanations
- **Enhanced** permission requirement documentation
- **Clarified** Super Admin vs Organization Admin roles

## Testing Guide Updates

The Swagger UI now includes a comprehensive testing guide:

1. **View Available Organizations** - GET /api/auth/organizations
2. **Register with Organization Selection** - POST /api/auth/register
3. **Check Join Request Status** - POST /api/auth/login
4. **Authorize with Token** - Use Bearer token in Swagger UI
5. **Test Organization Admin Features** - Approve/reject requests
6. **Test Super Admin Features** - Create organizations

## Access the Updated Documentation

Visit: **http://localhost:3001/api-docs**

The documentation is now fully aligned with the new system architecture and provides clear guidance for testing all the new features including:

- ✅ Super Admin organization creation
- ✅ Domain-based organization management
- ✅ User self-registration with organization selection
- ✅ Join request approval workflow
- ✅ Enhanced authentication responses
- ✅ Comprehensive error handling

All schemas, examples, and endpoint descriptions have been updated to reflect the current system state and provide developers with accurate, testable API documentation.
