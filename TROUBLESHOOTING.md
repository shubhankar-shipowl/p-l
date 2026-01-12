# Troubleshooting Guide

## Common Issues and Solutions

### 1. Database Connection Error: "Access denied for user"

**Error Message:**
```
❌ Database connection error: Access denied for user 'pandl'@'223.225.60.66' (using password: YES)
```

**Causes:**
- Database user doesn't have permission to connect from your IP address
- Incorrect password in `.env` file
- Firewall blocking the connection
- Database user doesn't exist

**Solutions:**

1. **Check Database User Permissions:**
   ```sql
   -- Connect to MySQL as root/admin
   -- Grant access from your IP or all IPs
   GRANT ALL PRIVILEGES ON pandl.* TO 'pandl'@'%' IDENTIFIED BY 'your_password';
   FLUSH PRIVILEGES;
   
   -- Or grant access from specific IP
   GRANT ALL PRIVILEGES ON pandl.* TO 'pandl'@'223.225.60.66' IDENTIFIED BY 'your_password';
   FLUSH PRIVILEGES;
   ```

2. **Verify .env Configuration:**
   ```env
   DB_HOST=89.116.21.112
   DB_USER=pandl
   DB_PASSWORD=your_actual_password
   DB_NAME=pandl
   DB_PORT=3306
   ```

3. **Check Firewall Settings:**
   - Ensure MySQL port (3306) is open
   - Check if your hosting provider has IP whitelisting

4. **Test Connection Manually:**
   ```bash
   mysql -h 89.116.21.112 -u pandl -p pandl
   ```

### 2. JWT Session Error: "decryption operation failed"

**Error Message:**
```
[next-auth][error][JWT_SESSION_ERROR] decryption operation failed
```

**Causes:**
- `NEXTAUTH_SECRET` is missing or changed
- Old session tokens encrypted with different secret
- Environment variable not loaded properly

**Solutions:**

1. **Set NEXTAUTH_SECRET in .env.local:**
   ```env
   NEXTAUTH_SECRET=your-secret-key-here
   ```
   
   Generate a new secret:
   ```bash
   openssl rand -base64 32
   ```

2. **Clear Old Sessions:**
   - Clear browser cookies for localhost:3000
   - Or call the clear session endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/auth/clear-session
   ```

3. **Restart Development Server:**
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart
   npm run dev
   ```

4. **Verify Environment Variables:**
   - Ensure `.env.local` is in the root directory
   - Check that variables are loaded (check console logs)
   - Restart the server after changing .env files

### 3. Database Connection Test Fails on Startup

**Note:** This is now a warning, not an error. The application will still work and retry connections when needed.

**If connections fail when making API calls:**

1. **Check Database is Running:**
   ```bash
   # For remote databases, ping the host
   ping 89.116.21.112
   ```

2. **Verify Network Connectivity:**
   - Check if you can reach the database server
   - Verify VPN connection if required
   - Check firewall rules

3. **Enable SSL if Required:**
   ```env
   DB_SSL=true
   DB_SSL_REJECT_UNAUTHORIZED=false  # Set to true for production
   ```

### 4. Environment Variables Not Loading

**Solutions:**

1. **File Location:**
   - Ensure `.env.local` is in the project root (same level as `package.json`)
   - Not in `app/` or `src/` directory

2. **File Naming:**
   - Use `.env.local` for local development
   - Next.js automatically loads this file

3. **Restart Server:**
   - Environment variables are loaded on server start
   - Always restart after changing `.env.local`

4. **Check Variable Names:**
   - Use exact names: `DB_HOST`, `DB_USER`, etc.
   - No spaces around `=`
   - No quotes needed (unless value contains spaces)

### 5. Port Already in Use

**Error:**
```
Port 3000 is already in use
```

**Solutions:**

1. **Change Port:**
   ```env
   PORT=3001
   ```

2. **Kill Process Using Port:**
   ```bash
   # Find process
   lsof -ti:3000
   # Kill it
   kill -9 $(lsof -ti:3000)
   ```

## Getting Help

If issues persist:

1. Check the console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test database connection manually using MySQL client
4. Check Next.js and NextAuth documentation
5. Review database server logs for connection attempts

## Quick Health Check

Run these commands to verify setup:

```bash
# Check Node.js version (should be 18+)
node --version

# Check if dependencies are installed
npm list next-auth mysql2

# Test database connection (if MySQL client installed)
mysql -h YOUR_HOST -u YOUR_USER -p YOUR_DATABASE

# Check environment variables are accessible
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.DB_HOST)"
```

