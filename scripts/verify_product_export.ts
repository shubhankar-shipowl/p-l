
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyProductPerformance() {
  console.log('Connecting to database...');
  const connection = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Column check logic (duplicated from API for testing)
    let filterColumn = 'pickup_warehouse';
    try {
      const [pwColumns] = await connection.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pickup_warehouse'
      `);
      if (pwColumns.length > 0) filterColumn = 'pickup_warehouse';
      else {
          const [columns] = await connection.query(`
            SELECT COLUMN_NAME FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_account'
          `);
          if (columns.length > 0) filterColumn = 'order_account';
      }
    } catch (e) {}
    
    console.log(`Using filter column: ${filterColumn}`);

    // Product Query
    const query = `
      SELECT 
        pe.product_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(pe.price_after_gst), 0) as total_revenue
      FROM orders o
      JOIN suppliers su ON TRIM(o.${filterColumn}) = TRIM(su.name)
      JOIN price_entries pe ON pe.supplier_id = su.id 
        AND TRIM(pe.product_name) = TRIM(o.product_name)
      WHERE LOWER(o.status) NOT LIKE '%cancel%'
        AND (
          o.order_date BETWEEN pe.effective_from AND pe.effective_to
          OR (pe.effective_to IS NULL AND o.order_date >= pe.effective_from)
        )
      GROUP BY pe.product_name
      ORDER BY total_revenue DESC
    `;

    const [rows] = await connection.query(query);
    console.log('Product Performance Results:');
    console.table(rows);

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await connection.end();
  }
}

verifyProductPerformance();
