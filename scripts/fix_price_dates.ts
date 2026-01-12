
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function fixDates() {
  const connection = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('Backdating price entries onto 2024-01-01...');
    const [result] = await connection.query("UPDATE price_entries SET effective_from = '2024-01-01 00:00:00'");
    console.log('Update result:', result);
  } catch (error) {
    console.error('Update failed:', error);
  } finally {
    await connection.end();
  }
}

fixDates();
