# Authentication Setup Guide

This application uses NextAuth.js for authentication with a credentials provider.

## Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   Create a `.env.local` file with:
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here
   ```
   
   Generate a secret:
   ```bash
   openssl rand -base64 32
   ```

3. **Database Setup**
   The schema includes:
   - `users` table for user accounts
   - `sessions` table for NextAuth sessions
   - `accounts` table for OAuth providers (if needed)
   - `verification_tokens` table for email verification

4. **Create Your First User**
   - Navigate to `/signup`
   - Fill in name, email, and password
   - Password must be at least 6 characters
   - After signup, login at `/login`

## Protected Routes

The following routes require authentication:
- `/` (Dashboard)
- `/upload`
- `/marketing`
- All API routes under `/api/dashboard`, `/api/upload`, `/api/marketing-spend`

Public routes:
- `/login`
- `/signup`
- `/api/auth/*` (NextAuth endpoints)
- `/api/auth/register` (Registration endpoint)

## Authentication Flow

1. User signs up at `/signup`
2. Password is hashed with bcrypt before storage
3. User logs in at `/login` with email/password
4. NextAuth creates a JWT session token
5. Session is stored in cookies
6. Middleware checks authentication on protected routes
7. User can logout via the user menu in the navbar

## Security Features

- Passwords are hashed using bcrypt (10 rounds)
- JWT tokens for session management
- Route protection via middleware
- SQL injection prevention with parameterized queries
- CSRF protection via NextAuth

## User Management

- Users can only see their own data (if you implement user-specific data filtering)
- Currently, all authenticated users can access all data
- To add user-specific data filtering, modify API routes to filter by `session.user.id`

