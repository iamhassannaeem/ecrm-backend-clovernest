# Password Update Feature for Organization Admins

## Overview
Organization admins can now update user passwords through the `/api/org-admin/users/${userId}` PUT endpoint. This feature allows organization administrators to reset passwords for users in their organization.

## API Endpoint

### PUT `/api/org-admin/users/${userId}`

**Description:** Update a user's profile, including password (organization admin only for password updates)

**Authentication:** Bearer token required

**Permissions:** 
- Users can update their own profile (except password)
- Organization admins can update any user's profile and password

### Request Body

```json
{
  "firstName": "John",
  "lastName": "Doe", 
  "email": "john.doe@example.com",
  "phoneNumber": "+1234567890",
  "bio": "Software Developer",
  "password": "NewPassword123!"
}
```

**Fields:**
- `firstName` (optional): User's first name (1-50 characters)
- `lastName` (optional): User's last name (1-50 characters)  
- `email` (optional): User's email address (must be valid email format)
- `phoneNumber` (optional): User's phone number
- `bio` (optional): User's biography
- `password` (optional): New password (organization admin only, min 8 characters)

### Password Requirements

The password must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- At least one special character

### Response

**Success (200):**
```json
{
  "message": "Profile and password updated successfully",
  "user": {
    "id": 123,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "bio": "Software Developer",
    "organization": {
      "id": 1,
      "name": "Example Corp",
      "slug": "example-corp",
      "domain": "example.com",
      "description": "Example organization",
      "isActive": true,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: User not found

## Security Features

### Permission Checks
- Only organization admins can update passwords
- Regular users can only update their own profile (excluding password)
- Super admins are excluded from organization admin checks

### Password Security
- Passwords are hashed using bcrypt with 12 salt rounds
- Password strength validation is enforced
- Audit logging tracks password changes

### Audit Logging
When a password is updated, an audit log entry is created with:
- Action: `UPDATE_USER`
- Resource: `USER`
- Details: User ID, email, password update flag, and who made the change

## Testing

Use the provided test script to verify functionality:

```bash
node test-password-update.js
```

**Prerequisites:**
1. Server must be running on `http://localhost:3000`
2. Organization admin account must exist
3. At least one regular user must exist in the organization

**Test Steps:**
1. Login as organization admin
2. Find a test user in the organization
3. Update the user's password
4. Verify the user can login with the new password

## Frontend Integration

### Example React Component

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const UpdateUserPassword = ({ userId, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `/api/org-admin/users/${userId}`,
        { password },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      onSuccess(response.data.message);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        minLength={8}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Updating...' : 'Update Password'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
};

export default UpdateUserPassword;
```

## Migration Notes

This feature is backward compatible. Existing profile update functionality remains unchanged. The only addition is the optional `password` field in the request body.

## Error Handling

Common error scenarios and solutions:

1. **403 Forbidden - "Only organization admins can update passwords"**
   - Ensure the authenticated user has organization admin role
   - Check that the user is not a super admin

2. **400 Bad Request - "Password does not meet requirements"**
   - Ensure password meets all strength requirements
   - Check for minimum length, character types, etc.

3. **404 Not Found - "User not found"**
   - Verify the user ID exists in the organization
   - Check that the user belongs to the same organization

## Future Enhancements

Potential improvements for this feature:

1. **Email Notification**: Send email to user when password is changed
2. **Password History**: Prevent reuse of recent passwords
3. **Temporary Passwords**: Generate temporary passwords that require change on first login
4. **Bulk Password Reset**: Reset multiple users' passwords at once
5. **Password Expiration**: Set passwords to expire after a certain time period 