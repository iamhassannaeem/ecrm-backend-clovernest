# Super Admin Dashboard

A comprehensive React-based dashboard for Super Administrators to manage the entire platform.

## Features

### 🔐 Authentication
- Secure login system for Super Admin users
- JWT token-based authentication
- Automatic token refresh and error handling

### 📊 Analytics Dashboard
- Platform-wide statistics and metrics
- Total users, organizations, and revenue tracking
- Recent activity monitoring
- Real-time data visualization

### 👥 User Management
- View all platform users with search and filtering
- Activate/suspend user accounts
- View user details including organization memberships
- Pagination and advanced filtering options

### 🏢 Organization Management
- Create new organizations with admin users
- View all organizations with detailed information
- Monitor organization status and subscriptions
- Search and filter organizations

### 📋 Audit Logs
- Comprehensive audit trail of all platform activities
- Filter by action type, resource, user, or organization
- Detailed change tracking with before/after values
- Real-time activity monitoring

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **UI Components**: Headless UI

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Backend server running (default: http://localhost:3000)

### Installation

1. **Navigate to the project directory:**
   ```bash
   cd Frontend/super-admin-portal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure backend URL:**
   Edit `src/services/api.js` and update the `baseURL` to match your backend server URL.

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Access the dashboard:**
   Open your browser and navigate to `http://localhost:5173`

## API Configuration

The dashboard connects to your backend API endpoints:

- **Authentication**: `/api/auth/login`
- **Analytics**: `/api/super-admin/analytics`
- **Users**: `/api/super-admin/users`
- **Organizations**: `/api/super-admin/organizations`
- **Audit Logs**: `/api/super-admin/audit-logs`

## Usage

### Login
1. Navigate to the login page
2. Enter Super Admin credentials
3. Upon successful authentication, you'll be redirected to the Analytics dashboard

### Navigation
- Use the sidebar to navigate between different sections
- Each section provides specific functionality for platform management

### User Management
- Search users by name or email
- Filter by active/inactive status
- Suspend or activate user accounts
- View user organization memberships

### Organization Management
- Create new organizations with admin users
- Search and filter organizations
- Monitor organization status and member counts
- View subscription information

### Audit Logs
- Filter logs by action type, resource, or specific users/organizations
- View detailed change information
- Monitor platform activity in real-time

## Development

### Project Structure
```
src/
├── components/
│   └── DashboardLayout.jsx    # Main dashboard layout
├── pages/
│   ├── LoginPage.jsx          # Authentication page
│   ├── AnalyticsPage.jsx      # Analytics dashboard
│   ├── UsersPage.jsx          # User management
│   ├── OrganizationsPage.jsx  # Organization management
│   └── AuditLogsPage.jsx      # Audit logs
├── services/
│   └── api.js                 # API service layer
├── App.jsx                    # Main app component
└── main.jsx                   # Entry point
```

### Adding New Features
1. Create new components in the appropriate directory
2. Add API endpoints to `src/services/api.js`
3. Update routing in `src/components/DashboardLayout.jsx`
4. Add navigation items to the sidebar

## Security

- All API requests include JWT authentication
- Automatic token refresh and error handling
- Secure logout functionality
- Protected routes for authenticated users only

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your backend allows requests from the frontend domain
2. **Authentication Failures**: Verify Super Admin credentials and backend authentication
3. **API Connection Issues**: Check the `baseURL` in `src/services/api.js`

### Development Tips

- Use browser developer tools to monitor API requests
- Check the console for error messages
- Verify backend server is running and accessible

## Contributing

1. Follow the existing code structure and patterns
2. Use Tailwind CSS for styling
3. Implement proper error handling
4. Add loading states for better UX
5. Test all functionality before submitting changes

## License

This project is part of the Cleaning Management System.
