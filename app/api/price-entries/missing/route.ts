import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Missing Price Detection API
 * 
 * Algorithm (as per documentation):
 * 1. Load orders, price entries, suppliers
 * 2. Build set of existing prices keyed by supplierId-productName
 * 3. Build unique (supplierName, productName) combos from orders:
 *    - Track orderCount, latestOrderDate, supplierProductId
 * 4. For each combo without a matching price entry, emit a "missing" row
 * 
 * Returns: Array of missing price entries with supplier/product details
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // basis: delivered_date | order_date (default delivered_date)
    const basis = (searchParams.get('basis') || 'delivered_date').toLowerCase();

    const connection = await pool.getConnection();
    try {
      // Load suppliers
      let suppliers: any[] = [];
      try {
        const [suppliersRows] = await connection.query(`SELECT id, name FROM suppliers`);
        suppliers = (suppliersRows as any[]) || [];
      } catch (err: any) {
        if (err?.code === 'ER_NO_SUCH_TABLE') {
          console.warn('suppliers table not found; continuing with empty suppliers');
          suppliers = [];
        } else {
          throw err;
        }
      }
      const supplierIdByName = new Map<string, number>();
      suppliers.forEach((s) => {
        if (s.name) supplierIdByName.set(s.name.toString().toLowerCase(), s.id);
      });

      // Load existing price entries keyed by supplierId-productName (case-insensitive)
      let priceRows: any[] = [];
      try {
        const [pr] = await connection.query(
          `SELECT supplier_id, product_name FROM price_entries`
        );
        priceRows = pr as any[];
      } catch (err: any) {
        if (err?.code === 'ER_NO_SUCH_TABLE') {
          console.warn('price_entries table not found; continuing with empty price list');
          priceRows = [];
        } else {
          throw err;
        }
      }
      const existingPrices = new Set<string>();
      priceRows.forEach((p) => {
        if (p.supplier_id && p.product_name) {
          existingPrices.add(
            `${p.supplier_id}-${p.product_name.toString().toLowerCase()}`
          );
        }
      });

      // Check if order_account column exists
      let hasOrderAccount = false;
      try {
        const [columns] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'orders' 
          AND COLUMN_NAME = 'order_account'
        `) as any[];
        hasOrderAccount = columns.length > 0;
      } catch (colCheckErr) {
        console.log('Column check failed, using pickup_warehouse');
      }
      
      // Load missing prices using a single optimized SQL query
      // This implementation replaces the memory-intensive "load all orders" approach
      // Logic: Group orders by supplier/product, Left Join with price_entries. 
      // If price_entries.id is NULL, it's missing.

      const supplierCol = hasOrderAccount ? 'order_account' : 'pickup_warehouse';
      
      // Determine supplier name expression (handles empty strings as well as NULLs)
      // Prioritize pickup_warehouse as per user request ("Supplier should be the Pickup Warehouse")
      const supplierNameExpr = `
        COALESCE(
          NULLIF(TRIM(pickup_warehouse), ''),
          NULLIF(TRIM(${supplierCol}), ''),
          NULLIF(TRIM(fulfilled_by), ''),
          'Unknown'
        )
      `;

      // We only care about products present in orders but missing in price list
      // We look for:
      // 1. Orders grouped by (Supplier, Product)
      // 2. Aggregate stats (count, latest date)
      // 3. JOIN suppliers s ON name = Supplier
      // 4. JOIN price_entries pe ON pe.supplier_id = s.id AND pe.product_name = orders.product_name
      // 5. WHERE pe.id IS NULL
      
      const query = `
        SELECT 
          ${supplierNameExpr} as supplier_name,
          TRIM(orders.product_name) as product_name,
          COUNT(*) as order_count,
          MAX(order_date) as latestOrderDate,
          s.id as supplierId
        FROM orders
        LEFT JOIN suppliers s ON s.name = ${supplierNameExpr}
        LEFT JOIN price_entries pe ON 
          pe.supplier_id = s.id 
          AND TRIM(pe.product_name) = TRIM(orders.product_name)
        WHERE 
          orders.product_name IS NOT NULL 
          AND orders.product_name != ''
          AND pe.id IS NULL
        GROUP BY supplier_name, product_name, s.id
        ORDER BY order_count DESC
        LIMIT 200
      `;

      const [missingRows] = await connection.query(query);
      
      const limited = (missingRows as any[]).map((entry) => ({
        supplier_name: entry.supplier_name,
        product_name: entry.product_name,
        order_count: Number(entry.order_count),
        latestOrderDate: entry.latestOrderDate,
        supplierId: entry.supplierId || null,
        // Generate automatic ID as per requirements
        supplier_product_id: `${entry.supplier_name}${entry.product_name}`,
        needs_pricing: true,
      }));

      return NextResponse.json(limited);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('Failed to fetch missing price entries', error);
    return NextResponse.json(
      { error: 'Failed to fetch missing price entries', details: error.message },
      { status: 500 }
    );
  }
}

