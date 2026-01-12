const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function setupAndAddUser() {
  const email = 'finance@shipowl.io';
  const password = 'Shipowl@6';
  const name = 'Finance User';

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('✅ Password hashed successfully');

  // Database configuration - try to match what the app uses
  const dbConfig = {
    host: process.env.DB_HOST || process.env.DATABASE_HOST || process.env.MYSQL_HOST || 'localhost',
    user: process.env.DB_USER || process.env.DATABASE_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_NAME || process.env.DATABASE_NAME || process.env.MYSQL_DATABASE || 'pandl',
    port: process.env.DB_PORT || process.env.DATABASE_PORT || process.env.MYSQL_PORT 
      ? parseInt(process.env.DB_PORT || process.env.DATABASE_PORT || process.env.MYSQL_PORT || '3306')
      : 3306,
  };

  console.log('\n📊 Database Configuration:');
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  User: ${dbConfig.user}`);
  console.log(`  Database: ${dbConfig.database}\n`);

  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);

    // Create users table if it doesn't exist
    console.log('Creating users table if it doesn\'t exist...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        emailVerified DATETIME,
        password VARCHAR(255) NOT NULL,
        image VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);
    console.log('✅ Users table ready');

    // Check if user already exists
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      console.log('User already exists. Updating password...');
      await connection.query(
        'UPDATE users SET password = ?, name = ? WHERE email = ?',
        [hashedPassword, name, email]
      );
      console.log('✅ User password updated successfully!');
    } else {
      // Insert new user
      await connection.query(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name]
      );
      console.log('✅ User created successfully!');
    }

    console.log(`\n📋 User Details:`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Name: ${name}`);
    console.log('\n✅ You can now login with these credentials.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('User with this email already exists.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(`Database '${dbConfig.database}' does not exist.`);
      console.error('Please create the database first or check your .env.local file.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied. Please check your database credentials in .env.local');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupAndAddUser();

