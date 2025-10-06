# SaaS Backend Architecture

A comprehensive multi-tenant SaaS backend built with Node.js, Express.js, Prisma, and PostgreSQL.

## Features

### 🔐 Authentication & Authorization
- JWT with refresh tokens
- OAuth integration (Google, GitHub)
- Role-based access control (RBAC)
- Password strength validation
- Email verification

### 🏢 Multi-tenant Organizations
- Organization-based user management
- Separate admin panels for each organization
- Invitation system
- Role management (Super Admin, Org Admin, Org Member, User)

### 💳 Payment Integration
- Stripe integration for subscriptions
- Webhook handling for payment events
- Customer portal access
- Payment history tracking

### 👑 Super Admin Features
- Platform-wide statistics
- User and organization management
- Subscription oversight
- Audit log monitoring

### 🛡️ Security Features
- Rate limiting
- CORS configuration
- Helmet security headers
- Input validation
- Audit logging

### 📚 API Documentation
- Comprehensive Swagger/OpenAPI documentation
- Interactive API explorer
- Schema definitions and examples
- Authentication testing interface

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT, Passport.js
- **Payments**: Stripe
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate Limiting
- **Documentation**: Swagger/OpenAPI 3.0

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Docker (optional, for database)
- npm or yarn package manager

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd saas-backend-system
npm install
```

### 2. Environment Setup

Copy the environment template:
```bash
cp .env.example .env
```

Update `.env` with your configuration:
```env
# Database
DATABASE_URL="postgresql://saas_user:saas_password@localhost:5432/saas_db"

# JWT Secrets (generate strong secrets)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Super Admin
SUPER_ADMIN_EMAIL=your-email@example.com
```

### 3. Database Setup

#### Option A: Using Docker (Recommended)
Start PostgreSQL using Docker Compose:
```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres

# Or start all services
docker-compose up -d
```

#### Option B: Local PostgreSQL Installation
If you have PostgreSQL installed locally, create a database:
```sql
CREATE DATABASE saas_db;
CREATE USER saas_user WITH PASSWORD 'saas_password';
GRANT ALL PRIVILEGES ON DATABASE saas_db TO saas_user;
```

#### Generate Prisma Client and Setup Database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# Or create and run migrations (for production)
npm run db:migrate

# Seed the database with initial data
npm run db:seed
```

**Note**: If you encounter permission issues with Prisma generation on Windows, try running the command as administrator or restart your terminal.

### 4. Start the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Documentation

### Swagger/OpenAPI Documentation

Once the server is running, you can access the interactive API documentation at:

**🔗 [http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

The Swagger UI provides:
- **Interactive API Explorer**: Test endpoints directly from the browser
- **Authentication Support**: Login and use JWT tokens for protected endpoints
- **Schema Documentation**: Detailed request/response schemas
- **Example Requests**: Pre-filled examples for all endpoints
- **Response Codes**: Complete HTTP status code documentation

### Quick API Testing

1. **Start the server**: `npm run dev`
2. **Open Swagger UI**: Navigate to `http://localhost:3000/api-docs`
3. **Create a user**: Use the `POST /api/auth/register` endpoint
4. **Login**: Use the `POST /api/auth/login` endpoint to get JWT tokens
5. **Authorize**: Click the "Authorize" button and enter your JWT token
6. **Test endpoints**: All protected endpoints are now accessible

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/github` - GitHub OAuth
- `POST /api/auth/forgot-password` - Password reset request
- `GET /api/auth/me` - Get current user

### Organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - Get user's organizations
- `GET /api/organizations/:id` - Get organization details
- `PUT /api/organizations/:id` - Update organization
- `POST /api/organizations/:id/invite` - Invite user to organization
- `DELETE /api/organizations/:id/members/:userId` - Remove member

### Admin Panel (Organization-scoped)
- `GET /api/admin/dashboard/:organizationId` - Dashboard data
- `GET /api/admin/members/:organizationId` - Organization members
- `PUT /api/admin/members/:organizationId/:userId/role` - Update member role
- `GET /api/admin/audit-logs/:organizationId` - Organization audit logs

### Super Admin (Platform-wide)
- `GET /api/super-admin/stats` - Platform statistics
- `GET /api/super-admin/organizations` - All organizations
- `PUT /api/super-admin/organizations/:id/status` - Update org status
- `GET /api/super-admin/users` - All users
- `PUT /api/super-admin/users/:id/status` - Update user status
- `GET /api/super-admin/subscriptions` - All subscriptions
- `GET /api/super-admin/audit-logs` - Platform audit logs

### Payments
- `POST /api/payments/subscriptions` - Create subscription
- `GET /api/payments/subscriptions/:organizationId` - Get subscriptions
- `PUT /api/payments/subscriptions/:id` - Update subscription
- `DELETE /api/payments/subscriptions/:id` - Cancel subscription
- `POST /api/payments/payment-intents` - Create payment intent
- `POST /api/payments/customer-portal` - Get customer portal URL
- `GET /api/payments/payments/:organizationId` - Payment history

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/password` - Change password
- `PUT /api/users/email` - Change email
- `DELETE /api/users/account` - Delete account
- `GET /api/users/organizations` - User's organizations
- `DELETE /api/users/organizations/:id` - Leave organization

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook endpoint

## Database Configuration

### PostgreSQL (Recommended)

The application is configured to use PostgreSQL by default. The connection string format is:
```
DATABASE_URL="postgresql://username:password@host:port/database"
```

**Default Docker Configuration:**
```
DATABASE_URL="postgresql://saas_user:saas_password@localhost:5432/saas_db"
```

### SQLite (Development Alternative)

For quick development setup without PostgreSQL, you can use SQLite:

1. **Update Prisma Schema**: Change the provider in `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

2. **Update Environment Variable**:
```env
DATABASE_URL="file:./dev.db"
```

3. **Regenerate Prisma Client**:
```bash
npm run db:generate
npm run db:push
```

### Database Schema

The database includes the following main entities:

- **Users**: User accounts with OAuth support
- **Organizations**: Multi-tenant organizations
- **OrganizationMembers**: User-organization relationships with roles
- **Permissions**: Granular permissions system
- **Subscriptions**: Stripe subscription management
- **Payments**: Payment history tracking
- **RefreshTokens**: JWT refresh token storage
- **AuditLogs**: Activity tracking and auditing

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **JWT Secrets**: Use strong, unique secrets for production
3. **Database**: Use connection pooling and prepared statements
4. **Rate Limiting**: Configured for auth endpoints
5. **CORS**: Configure allowed origins for production
6. **Passwords**: Enforced strength requirements
7. **Audit Logging**: All sensitive actions are logged

## Deployment

### Environment Variables for Production

Ensure all environment variables are properly set:
- Use strong JWT secrets
- Configure production database URL
- Set up OAuth app credentials
- Configure Stripe webhook endpoints
- Set up email service credentials

### Database Migrations

For production deployments:
```bash
npm run db:migrate
```

### Health Check

The API includes a health check endpoint:
```
GET /health
```

## Development

### Database Management

- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run migrations
- `npm run db:seed` - Seed database with initial data

### Logging

Logs are written to:
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs
- Console output in development

## Support

For issues and questions, please check the documentation or create an issue in the repository.

## License

This project is licensed under the ISC License.
