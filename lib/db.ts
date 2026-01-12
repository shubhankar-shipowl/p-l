import mysql from 'mysql2/promise';

// Support multiple environment variable naming conventions
// Priority: DB_* > DATABASE_* > MYSQL_* > defaults
const dbConfig: any = {
  host: process.env.DB_HOST || process.env.DATABASE_HOST || process.env.MYSQL_HOST || 'localhost',
  user: process.env.DB_USER || process.env.DATABASE_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || process.env.MYSQL_DATABASE || 'profit_loss_db',
  port: process.env.DB_PORT || process.env.DATABASE_PORT || process.env.MYSQL_PORT 
    ? parseInt(process.env.DB_PORT || process.env.DATABASE_PORT || process.env.MYSQL_PORT || '3306')
    : 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'), // Reduced from 20 back to 10 to prevent ETIMEDOUT
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Connection timeout (valid option)
  connectTimeout: 30000, // 30 seconds to establish connection
};

// Add SSL configuration for remote databases if SSL is enabled
if (process.env.DB_SSL === 'true' || process.env.DATABASE_SSL === 'true') {
  dbConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

// Log database configuration (without password) for debugging
console.log('\n📊 Database Configuration:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Host:     ${dbConfig.host}`);
console.log(`  Port:     ${dbConfig.port}`);
console.log(`  User:     ${dbConfig.user}`);
console.log(`  Database: ${dbConfig.database}`);
console.log(`  SSL:      ${dbConfig.ssl ? 'enabled' : 'disabled'}`);
console.log(`  Pool:     ${dbConfig.connectionLimit} connections`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Use global singleton for pool in development to prevent connection leaks
const globalForDb = global as unknown as { pool: mysql.Pool };

const pool = globalForDb.pool || mysql.createPool(dbConfig);

// Only attach listeners if this is a NEW pool (i.e. not from global)
if (!globalForDb.pool) {
  pool.on('connection', (connection) => {
    console.log(`🔌 New database connection established (ID: ${connection.threadId})`);
    
    connection.on('error', (err: any) => {
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        console.warn(`⚠️  Connection ${connection.threadId} lost. Will reconnect automatically.`);
      } else {
        console.error(`❌ Connection ${connection.threadId} error:`, err.message);
      }
    });
    
    connection.on('end', () => {
      console.log(`📴 Connection ${connection.threadId} ended`);
    });
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
}

// Handle pool events
// pool.on('acquire', (connection) => {
//   console.log(`📥 Connection ${connection.threadId} acquired from pool`);
// });

// pool.on('release', (connection) => {
//   console.log(`📤 Connection ${connection.threadId} released back to pool`);
// });

// Log pool statistics periodically in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    pool.getConnection()
      .then((connection) => {
        connection.query('SELECT 1')
          .then(() => {
            connection.release();
          })
          .catch(() => {
            connection.release();
          });
      })
      .catch(() => {
        // Silent fail for periodic checks
      });
  }, 60000); // Check every minute
}

// Initialize database connection test
// Initialize database connection test
// if (typeof window === 'undefined') { ... } removed to avoid circular dependency


// Initialize database connection test on module load
if (typeof window === 'undefined') {
  // Server-side only - test connection after pool is created
  setTimeout(async () => {
    try {
      const connection = await pool.getConnection();
      const startTime = Date.now();
      
      try {
        await connection.ping();
        const pingTime = Date.now() - startTime;
        
        console.log('✅ Database Connection Successful!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  Status:     Connected`);
        console.log(`  Response:   ${pingTime}ms`);
        console.log(`  Thread ID:  ${connection.threadId}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } catch (pingError: any) {
        console.log('✅ Database Connection Established');
        console.log(`  Note: Ping test failed (${pingError.message})`);
        console.log(`  Thread ID:  ${connection.threadId}`);
        console.log('  Connection pool is ready for queries.\n');
      } finally {
        connection.release();
      }
    } catch (error: any) {
      console.log('❌ Database Connection Failed');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Error:      ${error.message}`);
      console.log(`  Code:       ${error.code || 'N/A'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  Note: This is non-blocking. Connections will retry when needed.');
      console.log('   Troubleshooting:');
      console.log('   1. Check database user permissions for your IP');
      console.log('   2. Verify firewall settings');
      console.log('   3. Confirm credentials in .env file');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }, 500); // Small delay to ensure server is ready
}

export default pool;

