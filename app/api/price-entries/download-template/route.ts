import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const connection = await pool.getConnection();
  
  try {
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
    
    // User requested Supplier Name to be Pickup Warehouse
    // And Supplier Product ID to be Pickup Warehouse + Product Name
    
    let missingEntries: any[] = [];
    let priceRows: any[] = [];

    try {
      // Try full join with suppliers and price_entries to detect missing prices
      // We use o.pickup_warehouse as the supplier source as requested
      const [rows] = await connection.query(`
        SELECT 
          COALESCE(
            NULLIF(o.pickup_warehouse, ''),
            'Unknown'
          ) as supplier_name,
          o.product_name,
          s.id as supplier_id,
          COUNT(*) as order_count
        FROM orders o
        LEFT JOIN suppliers s 
          ON s.name = o.pickup_warehouse
        LEFT JOIN price_entries pe 
          ON pe.product_name = o.product_name 
         AND pe.supplier_id = s.id
        WHERE pe.id IS NULL
          AND o.product_name IS NOT NULL
          AND o.product_name != ''
        GROUP BY supplier_name, o.product_name, s.id
        ORDER BY order_count DESC
        LIMIT 200
      `) as any[];

      missingEntries = rows || [];
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') {
        // Fallback: if price_entries or suppliers table missing, base on orders alone
        console.warn('price_entries or suppliers table not found; falling back to orders only');
        const [rows] = await connection.query(`
        SELECT 
            COALESCE(
              NULLIF(o.pickup_warehouse, ''),
              'Unknown'
            ) as supplier_name,
          o.product_name,
          NULL as supplier_id,
            COUNT(*) as order_count
          FROM orders o
          WHERE o.product_name IS NOT NULL
            AND o.product_name != ''
          GROUP BY supplier_name, o.product_name
          ORDER BY order_count DESC
          LIMIT 200
        `) as any[];
        missingEntries = rows || [];
      } else {
        console.warn('Error fetching missing entries:', err.message);
      }
    }

    // load existing price entries to filter out already-priced products
    // A product is considered "complete" if price_after_gst is filled
    try {
      const [pr] = await connection.query(
        `SELECT supplier_id, product_name, price_after_gst 
         FROM price_entries 
         WHERE price_after_gst IS NOT NULL AND price_after_gst > 0`
      );
      priceRows = pr as any[];
      console.log(`Found ${priceRows.length} complete price entries (with Price After GST)`);
    } catch (err: any) {
      // Table doesn't exist yet - this is OK, just means no prices have been added
      if (err?.code === 'ER_NO_SUCH_TABLE') {
        console.log('price_entries table does not exist yet - template will include all products');
      } else {
        console.warn('Error loading price entries for filtering:', err.message);
      }
      priceRows = [];
    }

    // Build sets to filter out products with complete price entries (price_after_gst filled)
    const existingPrices = new Set<string>();
    const existingProductNames = new Set<string>();
    (priceRows || []).forEach((p) => {
      const prod = p.product_name?.toString().toLowerCase();
      if (p.supplier_id && prod) {
        existingPrices.add(`${p.supplier_id}-${prod}`);
      }
      if (prod) existingProductNames.add(prod);
    });

    // Filter missingEntries: exclude those with complete price entries (price_after_gst filled)
    missingEntries = (missingEntries || []).filter((entry) => {
      const prod = entry.product_name?.toString().toLowerCase();
      const sid = entry.supplier_id || null;
      if (sid && prod && existingPrices.has(`${sid}-${prod}`)) return false;
      if (prod && existingProductNames.has(prod)) return false;
      return true;
    });
    
    console.log(`Template will include ${missingEntries.length} products without complete price entries`);

    // Create CSV content with exact column order as specified
    const headers = [
      'Supplier Name',
      'Product Name',
      'Order Count',
      'Supplier Product ID',
      'Price Before GST (INR)',
      'GST Rate (%)',
      'Price After GST (INR)',
      'HSN Code',
      'Currency',
      'Effective From (YYYY-MM-DD)',
      'Effective To (YYYY-MM-DD)'
    ];

    // Start with headers
    let csvContent = headers.join(',') + '\n';

    // Add missing entries with placeholder values
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      .toISOString().split('T')[0];

    missingEntries.forEach((entry) => {
      const supplierName = entry.supplier_name || '';
      const productName = entry.product_name || '';
      const supplierProductId = `${supplierName}${productName}`;
      const priceBeforeGst = ''; // To be filled by user
      const gstRate = ''; // Leave empty per requirement
      const priceAfterGst = ''; // Will be calculated or filled by user
      
      const row = [
        supplierName,
        productName,
        entry.order_count || '0',
        supplierProductId,
        priceBeforeGst, // Price Before GST (INR) - to be filled
        gstRate, // GST Rate (%)
        priceAfterGst, // Price After GST (INR) - to be calculated or filled
        '', // HSN Code - to be filled
        'INR', // Currency
        today, // Effective From (YYYY-MM-DD)
        nextYear // Effective To (YYYY-MM-DD)
      ];
      csvContent += row.join(',') + '\n';
    });

    // If no missing entries, add a sample row
    if (missingEntries.length === 0) {
      csvContent += [
        'Sample Supplier',
        'Sample Product',
        '5',
        'Sample SupplierSample Product',
        '', // Price Before GST (INR)
        '', // GST Rate (%)
        '', // Price After GST (INR)
        '',
        'INR',
        today,
        nextYear
      ].join(',') + '\n';
    }

    // Return as Excel-compatible CSV (Excel can open CSV files)
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="price-entries-template.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template', details: error.message },
      { status: 500 }
    );
  } finally {
    // Always release the connection
    connection.release();
  }
}

