# Updated System Flow Documentation

## Overview of Changes

The system has been updated to implement the following requirements:

1. **Super Admin Only Organization Creation**: Only Super Admins can create organizations
2. **Domain Names for Organizations**: Each organization now has a unique domain name
3. **Automatic Admin User Creation**: When creating an organization, Super Admin also creates the organization admin
4. **User Self-Registration with Approval**: Users can register and request to join organizations, requiring admin approval

## Database Schema Changes

### New Fields
- `Organization.domain` - Unique domain name for each organization
- `OrganizationJoinRequest` - New model for managing join requests

### New Models
```prisma
model OrganizationJoinRequest {
  id             String                    @id @default(cuid())
  status         JoinRequestStatus         @default(PENDING)
  requestedRole  OrganizationRole          @default(USER)
  message        String?
  requestedAt    DateTime                  @default(now())
  reviewedAt     DateTime?
  reviewedById   String?
  userId         String
  organizationId String
  organization   Organization              @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  reviewedBy     User?                     @relation("JoinRequestReviewer", fields: [reviewedById], references: [id])

  @@unique([userId, organizationId])
  @@map("organization_join_requests")
}

enum JoinRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
```

## Updated Flow

### 1. Organization Creation (Super Admin Only)

**Endpoint**: `POST /api/super-admin/organizations`

**Required Fields**:
- `name` - Organization name
- `domain` - Unique domain (e.g., "company.com")
- `adminEmail` - Email for the organization admin
- `adminFirstName` - Admin's first name
- `adminPassword` - Password for the admin account
- `description` (optional)
- `website` (optional)
- `adminLastName` (optional)

**Process**:
1. Super Admin creates organization with domain
2. System automatically creates admin user account
3. Admin user is added as ORGANIZATION_ADMIN to the organization
4. Admin account is auto-verified

### 2. User Registration with Organization Selection

**Endpoint**: `POST /api/auth/register`

**Required Fields**:
- `email` - User email
- `password` - User password
- `firstName` - User's first name
- `organizationId` - ID of organization to join
- `lastName` (optional)
- `message` (optional) - Message to organization admin

**Process**:
1. User selects organization from available list
2. User registers with organization context
3. System creates user account
4. System creates join request (PENDING status)
5. Organization admin receives notification

### 3. Organization Admin Approval Process

**Endpoints**:
- `GET /api/organizations/{organizationId}/join-requests` - View pending requests
- `POST /api/organizations/{organizationId}/join-requests/{requestId}/approve` - Approve request
- `POST /api/organizations/{organizationId}/join-requests/{requestId}/reject` - Reject request

**Process**:
1. Admin views pending join requests
2. Admin approves or rejects requests
3. On approval: User becomes organization member
4. On rejection: Request is marked as rejected

### 4. User Status Checking

**Endpoints**:
- `GET /api/auth/join-requests` - Check own join request status
- `POST /api/auth/login` - Login includes join request status

## API Endpoints Summary

### Public Endpoints
- `GET /api/auth/organizations` - Get available organizations for signup
- `POST /api/auth/register` - Register with organization selection
- `POST /api/auth/login` - Login (includes join request status)

### User Endpoints (Authenticated)
- `GET /api/auth/join-requests` - Get user's join request status

### Organization Admin Endpoints
- `GET /api/organizations/{orgId}/join-requests` - View join requests
- `POST /api/organizations/{orgId}/join-requests/{reqId}/approve` - Approve request
- `POST /api/organizations/{orgId}/join-requests/{reqId}/reject` - Reject request

### Super Admin Endpoints
- `POST /api/super-admin/organizations` - Create organization with admin
- `GET /api/super-admin/organizations` - List all organizations (includes domain)

## Migration Notes

Existing organizations have been automatically assigned domain names in the format:
- `{organizationname}.example.com`
- Duplicates are handled with numeric suffixes

## Testing the New Flow

### 1. Test Organization Creation (Super Admin)
```bash
POST /api/super-admin/organizations
{
  "name": "Test Company",
  "domain": "testcompany.com",
  "adminEmail": "admin@testcompany.com",
  "adminFirstName": "John",
  "adminLastName": "Admin",
  "adminPassword": "SecurePass123!",
  "description": "A test company"
}
```

### 2. Test User Registration
```bash
# First get available organizations
GET /api/auth/organizations

# Then register with organization selection
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "UserPass123!",
  "firstName": "Jane",
  "lastName": "User",
  "organizationId": "org-id-from-above",
  "message": "I would like to join your organization"
}
```

### 3. Test Admin Approval
```bash
# Admin logs in and checks join requests
GET /api/organizations/{orgId}/join-requests

# Admin approves request
POST /api/organizations/{orgId}/join-requests/{reqId}/approve
{
  "role": "USER"
}
```

## Security Considerations

1. **Organization Creation**: Restricted to Super Admin only
2. **Domain Validation**: Domains must be valid format and unique
3. **Join Request Validation**: Users can only have one pending request per organization
4. **Admin Verification**: Organization admins are auto-verified
5. **Approval Required**: All new members require admin approval

## Breaking Changes

1. **Organization Creation**: Regular users can no longer create organizations
2. **Registration Flow**: Users must select an organization during registration
3. **Membership**: Users don't automatically become members - approval required
