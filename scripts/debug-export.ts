
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

async function main() {
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Check order_account column
    let hasOrderAccount = false;
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
      `) as any[];
      console.log('Orders columns:', columns.map((c: any) => c.COLUMN_NAME).join(', '));
      
      const hasOrderAccount = columns.some((c: any) => c.COLUMN_NAME === 'order_account');
    } catch (e) {
      console.log('col check error', e);
    }
    
    // Fallback to simpler counting if order_id doesn't exist?
    // We'll proceed with the error to see the columns log first.

    const supplierCol = hasOrderAccount ? 'order_account' : 'pickup_warehouse';
    
    // Export Query
    const query = `
        SELECT 
          COALESCE(NULLIF(TRIM(MAX(o.pickup_warehouse)), ''), s.name) as supplier_name,
          pe.product_name,
          pe.supplier_product_id,
          pe.currency,
          pe.price_before_gst,
          pe.gst_rate,
          pe.price_after_gst,
          pe.hsn_code,
          pe.effective_from,
          pe.effective_to,
          COUNT(o.id) as order_count
        FROM price_entries pe
        LEFT JOIN suppliers s ON pe.supplier_id = s.id
        LEFT JOIN orders o ON 
          TRIM(o.product_name) = TRIM(pe.product_name) AND (
            TRIM(o.${supplierCol}) = s.name OR 
            TRIM(o.pickup_warehouse) = s.name OR 
            TRIM(o.fulfilled_by) = s.name
          )
        GROUP BY pe.id
        ORDER BY pe.created_at DESC
        LIMIT 5
      `;

    const [rows] = await connection.query(query) as any[];
    
    console.log('--- Raw Rows ---');
    console.log(JSON.stringify(rows, null, 2));

    console.log('--- Simulate CSV ---');
    rows.forEach((entry: any) => {
        const supplierProductId = entry.supplier_product_id || 
            (entry.supplier_name && entry.product_name ? `${entry.supplier_name}${entry.product_name}` : '');

        const row = [
            entry.supplier_name || '',
            entry.product_name || '',
            entry.order_count || '0',
            supplierProductId,
            entry.price_before_gst || '',
            entry.gst_rate || '0',
            entry.price_after_gst || '',
            entry.hsn_code || '',
            entry.currency || 'INR',
            entry.effective_from ? new Date(entry.effective_from).toISOString().split('T')[0] : '',
            entry.effective_to ? new Date(entry.effective_to).toISOString().split('T')[0] : ''
        ];
        
        console.log(row.join(','));
    });

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

main();
