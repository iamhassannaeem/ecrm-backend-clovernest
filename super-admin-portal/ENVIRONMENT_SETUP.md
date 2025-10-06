# Environment Setup

This project uses environment variables to configure the backend URL.

## Setup Instructions

1. Create a `.env` file in the root directory of the super-admin-portal:
   ```
   VITE_BACKEND_URL=http://localhost:3001
   ```

2. For different environments, you can create:
   - `.env.development` for development
   - `.env.production` for production
   - `.env.local` for local overrides

## Available Environment Variables

- `VITE_BACKEND_URL`: The URL of your backend server (default: http://localhost:3001)

## Notes

- All environment variables must be prefixed with `VITE_` to be accessible in the frontend code
- The `.env` file should be added to `.gitignore` to avoid committing sensitive information
- The application will fall back to `http://localhost:3001` if no environment variable is set 