# Call History API Documentation

## Overview

The Call History API provides endpoints for managing and retrieving call records within an organization. This API allows users to view call history, create new call records, and filter calls based on various criteria.

## Base URL

```
http://localhost:3000/api/calls
```

## Authentication

All endpoints require authentication using JWT Bearer tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Permissions

Users need the `CALL_HISTORY` permission to access call history endpoints. This permission is typically granted to organization admins and users with appropriate roles.

## API Endpoints

### 1. Get Call History

**Endpoint:** `GET /api/calls`

**Description:** Retrieve paginated call history for the user's organization with filtering options.

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | integer | Page number for pagination (default: 1) | `1` |
| `limit` | integer | Number of calls per page (default: 20, max: 100) | `20` |
| `callerId` | integer | Filter by caller ID | `123` |
| `leadId` | integer | Filter by lead ID | `456` |
| `callAttendedById` | integer | Filter by call attendant ID | `789` |
| `startDate` | string | Filter calls from this date (ISO format) | `"2023-01-01"` |
| `endDate` | string | Filter calls until this date (ISO format) | `"2023-12-31"` |
| `minDuration` | integer | Minimum call duration in seconds | `60` |
| `maxDuration` | integer | Maximum call duration in seconds | `3600` |

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/calls?page=1&limit=10&startDate=2023-01-01" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "calls": [
    {
      "id": 1,
      "callerId": 123,
      "leadId": 456,
      "callTime": "2023-01-15T10:30:00.000Z",
      "callDuration": 300,
      "callAttendedById": 789,
      "organizationId": 1,
      "createdAt": "2023-01-15T10:30:00.000Z",
      "updatedAt": "2023-01-15T10:30:00.000Z",
      "caller": {
        "id": 123,
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com"
      },
      "callAttendedBy": {
        "id": 789,
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane.smith@example.com"
      },
      "lead": {
        "id": 456,
        "customerName": "Acme Corp",
        "phoneNumber": "+1234567890",
        "status": "CONTACTED"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15
  },
  "summary": {
    "totalCalls": 150,
    "totalDuration": 45000,
    "averageDuration": 300.5
  }
}
```

### 2. Get Specific Call Details

**Endpoint:** `GET /api/calls/{callId}`

**Description:** Retrieve detailed information about a specific call.

**Path Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `callId` | integer | ID of the call to retrieve | `1` |

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/calls/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "call": {
    "id": 1,
    "callerId": 123,
    "leadId": 456,
    "callTime": "2023-01-15T10:30:00.000Z",
    "callDuration": 300,
    "callAttendedById": 789,
    "organizationId": 1,
    "createdAt": "2023-01-15T10:30:00.000Z",
    "updatedAt": "2023-01-15T10:30:00.000Z",
    "caller": {
      "id": 123,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    "callAttendedBy": {
      "id": 789,
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com"
    },
    "lead": {
      "id": 456,
      "customerName": "Acme Corp",
      "phoneNumber": "+1234567890",
      "status": "CONTACTED"
    }
  }
}
```

### 3. Create Call Record

**Endpoint:** `POST /api/calls`

**Description:** Create a new call record in the system.

**Request Body:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `leadId` | integer | Yes | ID of the lead associated with the call | `456` |
| `callTime` | string | Yes | When the call was made (ISO format) | `"2023-01-15T10:30:00.000Z"` |
| `callDuration` | integer | Yes | Duration of the call in seconds | `300` |
| `callAttendedById` | integer | Yes | ID of the user who attended the call | `789` |

**Example Request:**

```bash
curl -X POST "http://localhost:3000/api/calls" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": 456,
    "callTime": "2023-01-15T10:30:00.000Z",
    "callDuration": 300,
    "callAttendedById": 789
  }'
```

**Example Response:**

```json
{
  "message": "Call record created successfully",
  "call": {
    "id": 2,
    "callerId": 123,
    "leadId": 456,
    "callTime": "2023-01-15T10:30:00.000Z",
    "callDuration": 300,
    "callAttendedById": 789,
    "organizationId": 1,
    "createdAt": "2023-01-15T10:30:00.000Z",
    "updatedAt": "2023-01-15T10:30:00.000Z",
    "caller": {
      "id": 123,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    "callAttendedBy": {
      "id": 789,
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com"
    },
    "lead": {
      "id": 456,
      "customerName": "Acme Corp",
      "phoneNumber": "+1234567890",
      "status": "CONTACTED"
    }
  }
}
```

## Data Models

### Call Model

```json
{
  "id": "integer",
  "callerId": "integer",
  "leadId": "integer",
  "callTime": "datetime",
  "callDuration": "integer",
  "callAttendedById": "integer",
  "organizationId": "integer",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "caller": "User object",
  "callAttendedBy": "User object",
  "lead": "Lead object"
}
```

### User Object (included in calls)

```json
{
  "id": "integer",
  "firstName": "string",
  "lastName": "string",
  "email": "string"
}
```

### Lead Object (included in calls)

```json
{
  "id": "integer",
  "customerName": "string",
  "phoneNumber": "string",
  "status": "string"
}
```

## Error Responses

### 400 Bad Request

```json
{
  "error": "Validation failed",
  "details": [
    {
      "type": "field",
      "value": "invalid_value",
      "msg": "Lead ID must be an integer",
      "path": "leadId",
      "location": "body"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "Permission denied - CALL_HISTORY access required"
}
```

### 404 Not Found

```json
{
  "error": "Call not found"
}
```

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Get call history
const getCallHistory = async (token) => {
  try {
    const response = await axios.get('http://localhost:3000/api/calls', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
};

// Create call record
const createCall = async (token, callData) => {
  try {
    const response = await axios.post('http://localhost:3000/api/calls', callData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
};

// Usage
const token = 'your-jwt-token';
const callHistory = await getCallHistory(token);
console.log('Total calls:', callHistory.summary.totalCalls);

const newCall = await createCall(token, {
  leadId: 456,
  callTime: new Date().toISOString(),
  callDuration: 300,
  callAttendedById: 789
});
```

### Python

```python
import requests

# Get call history
def get_call_history(token):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get('http://localhost:3000/api/calls', headers=headers)
    return response.json()

# Create call record
def create_call(token, call_data):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    response = requests.post('http://localhost:3000/api/calls', 
                           json=call_data, headers=headers)
    return response.json()

# Usage
token = 'your-jwt-token'
call_history = get_call_history(token)
print(f"Total calls: {call_history['summary']['totalCalls']}")

new_call = create_call(token, {
    'leadId': 456,
    'callTime': '2023-01-15T10:30:00.000Z',
    'callDuration': 300,
    'callAttendedById': 789
})
```

### cURL

```bash
# Get call history
curl -X GET "http://localhost:3000/api/calls" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get call history with filters
curl -X GET "http://localhost:3000/api/calls?startDate=2023-01-01&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get specific call
curl -X GET "http://localhost:3000/api/calls/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create call record
curl -X POST "http://localhost:3000/api/calls" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": 456,
    "callTime": "2023-01-15T10:30:00.000Z",
    "callDuration": 300,
    "callAttendedById": 789
  }'
```

## Testing

Use the provided test script to verify the API functionality:

```bash
# Update credentials in the test file first
node test-call-history.js
```

## Database Schema

The Call model in the database includes:

- `id`: Primary key
- `callerId`: Foreign key to User (who made the call)
- `leadId`: Foreign key to Lead (associated lead)
- `callTime`: When the call was made
- `callDuration`: Duration in seconds
- `callAttendedById`: Foreign key to User (who attended the call)
- `organizationId`: Foreign key to Organization
- `createdAt`: Record creation timestamp
- `updatedAt`: Record update timestamp

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Users can only access calls from their organization
3. **Data Validation**: All input data is validated before processing
4. **SQL Injection Protection**: Uses Prisma ORM with parameterized queries
5. **Rate Limiting**: Subject to global rate limiting middleware

## Rate Limits

The API is subject to rate limiting. Check the response headers for rate limit information:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Support

For issues or questions about the Call History API:

1. Check the API documentation at `/api-docs`
2. Review the test script for usage examples
3. Check server logs for detailed error information
4. Ensure you have the required `CALL_HISTORY` permission 