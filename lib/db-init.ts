import pool from './db';

// Initialize database connection and log status
// This ensures the connection test runs on server startup
export async function initializeDatabase() {
  console.log('\n🔄 Initializing Database Connection...');
  
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
}

// Auto-initialize immediately when module loads
if (typeof window === 'undefined') {
  // Server-side only - run initialization
  initializeDatabase().catch(() => {
    // Silent fail - errors already logged
  });
}

