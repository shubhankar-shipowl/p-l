# Environment Variables Configuration

The application supports multiple environment variable naming conventions for database configuration.

## Supported Formats

The database connection code will check for variables in this priority order:

### Format 1: DB_* (Recommended)
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=profit_loss_db
DB_PORT=3306
```

### Format 2: DATABASE_*
```env
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=profit_loss_db
DATABASE_PORT=3306
```

### Format 3: MYSQL_*
```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=profit_loss_db
MYSQL_PORT=3306
```

## Complete .env.local Example

```env
# Database Configuration (use any of the formats above)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=profit_loss_db
DB_PORT=3306

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-a-random-string

# Application Configuration
PORT=3000
NODE_ENV=development
```

## Priority Order

The code checks environment variables in this order:
1. `DB_*` variables (highest priority)
2. `DATABASE_*` variables
3. `MYSQL_*` variables
4. Default values (lowest priority)

## Default Values

If no environment variables are set, the following defaults are used:
- Host: `localhost`
- User: `root`
- Password: `` (empty)
- Database: `profit_loss_db`
- Port: `3306`

## Testing Connection

The application will automatically test the database connection on startup and log the result to the console.

