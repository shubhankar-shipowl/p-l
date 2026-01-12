
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkOrderAmount() {
  const connection = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await connection.query("SELECT id, order_amount, status FROM orders LIMIT 10");
    console.table(rows);
    
    // Check if we have non-zero amounts
    const [stats] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_amount > 0 THEN 1 END) as has_amount,
        SUM(order_amount) as total_amount
      FROM orders
    `);
    console.log('Order Stats:', stats[0]);

  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    await connection.end();
  }
}

checkOrderAmount();
