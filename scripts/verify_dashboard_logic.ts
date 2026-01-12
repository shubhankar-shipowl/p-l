
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyRevenueJoin() {
  console.log('Connecting to database...');
  const connection = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // 1. Check Orders Count (Total vs Non-Cancelled)
    const [ordersCount] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN LOWER(status) NOT LIKE '%cancel%' THEN 1 END) as active
      FROM orders
    `);
    console.log('Orders Count:', ordersCount[0]);

    // 2. Check Price Entries Count
    const [peCount] = await connection.query('SELECT COUNT(*) as count FROM price_entries');
    console.log('Price Entries Count:', peCount[0].count);

    // 3. Test the Join Logic (Revenue Source)
    let filterColumn = 'pickup_warehouse';
    try {
        const [pwColumns] = await connection.query(`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pickup_warehouse'
        `);
        
        if (pwColumns.length > 0) {
            filterColumn = 'pickup_warehouse';
            console.log('Using pickup_warehouse (found)');
        } else {
            const [columns] = await connection.query(`
              SELECT COLUMN_NAME FROM information_schema.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_account'
            `);
            if (columns.length > 0) {
                filterColumn = 'order_account';
                console.log('Using order_account (fallback)');
            }
        }
    } catch (e) {}
    console.log(`Final filter column: ${filterColumn}`);

    const query = `
      SELECT 
        COUNT(o.id) as orders_matched,
        COALESCE(SUM(o.order_amount), 0) as potential_revenue,
        COALESCE(SUM(pe.price_after_gst), 0) as potential_cost,
        COALESCE(SUM(o.order_amount), 0) - COALESCE(SUM(pe.price_after_gst), 0) as estimated_gross_profit
      FROM orders o
      JOIN suppliers su ON TRIM(o.${filterColumn}) = TRIM(su.name)
      JOIN price_entries pe ON pe.supplier_id = su.id 
        AND TRIM(pe.product_name) = TRIM(o.product_name)
      WHERE LOWER(o.status) NOT LIKE '%cancel%'
        AND (
          o.order_date BETWEEN pe.effective_from AND pe.effective_to
          OR (pe.effective_to IS NULL AND o.order_date >= pe.effective_from)
        )
    `;

    const [rows] = await connection.query(query);
    console.log('Join Result:', rows[0]);

    if (rows[0].orders_matched === 0) {
        console.log('WARNING: No orders matched with price entries!');
        
        // 1. List all suppliers
        const [suppliers] = await connection.query('SELECT id, name FROM suppliers');
        console.log('Suppliers:', suppliers);

        // 2. Check sample order again
        const [sample] = await connection.query(`SELECT product_name, ${filterColumn} as supplier_ref, pickup_warehouse, order_date FROM orders LIMIT 1`);
        if (sample.length > 0) {
            console.log('Sample Order:', sample[0]);
            console.log('Order Date type:', typeof sample[0].order_date);
            
            // Check if supplier exists via order_account
            let matchedSupplier = suppliers.find((s: any) => s.name.trim() === sample[0].supplier_ref.trim());

            // ... (keep supplier finding logic) ...

            if (matchedSupplier) {
                // Check price entries for this supplier
                const [pe] = await connection.query('SELECT product_name, price_after_gst, effective_from, effective_to FROM price_entries WHERE supplier_id = ?', [matchedSupplier.id]);
                console.log(`Price Entries for Supplier ${matchedSupplier.id}:`, pe);
                
                // Check name match
                const exactMatch = pe.find((p: any) => p.product_name.trim() === sample[0].product_name.trim());
                console.log('Exact Product Name Match:', !!exactMatch);
                
                if (exactMatch) {
                   console.log('--- Date Check ---');
                   console.log(`Order Date: ${sample[0].order_date}`);
                   console.log(`PE From: ${exactMatch.effective_from}`);
                   console.log(`PE To: ${exactMatch.effective_to}`);
                   
                   const oDate = new Date(sample[0].order_date);
                   const fromDate = new Date(exactMatch.effective_from);
                   const toDate = exactMatch.effective_to ? new Date(exactMatch.effective_to) : null;
                   
                   console.log(`Order >= From? ${oDate >= fromDate}`);
                   if (toDate) console.log(`Order <= To? ${oDate <= toDate}`);
                   else console.log('To Date is NULL (Open ended)');
                }
            }
        }
    } else {
        console.log('SUCCESS: Revenue calculation seems to have data reference.');
    }

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await connection.end();
  }
}

verifyRevenueJoin();
