import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const supplierName = searchParams.get('supplier') || '';
    const decodedSupplierName = decodeURIComponent(supplierName).trim();

    if (!decodedSupplierName) {
      return NextResponse.json({ products: [] });
    }

    connection = await pool.getConnection();

    // Check if order_account column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'order_account'
    `) as any[];

    const hasOrderAccount = columns.length > 0;
    
    // User requested prioritization of pickup_warehouse
    // But we should check both if possible, or fallback to pickup_warehouse as primary for supplier match
    // Since the frontend populates suppliers list from pickup_warehouse mostly.
    
    // Construct WHERE clause dynamically
    let whereClause = `TRIM(pickup_warehouse) = ?`;
    if (hasOrderAccount) {
        whereClause = `(TRIM(pickup_warehouse) = ? OR TRIM(order_account) = ?)`;
    }

    // Get distinct products for this supplier
    // Use trim on the database column too just in case
    const [rows] = await connection.query(
      `SELECT DISTINCT product_name 
       FROM orders 
       WHERE ${hasOrderAccount ? `(TRIM(pickup_warehouse) = ? OR TRIM(order_account) = ?)` : `TRIM(pickup_warehouse) = ?`}
         AND product_name IS NOT NULL 
         AND product_name != ''
       ORDER BY product_name`,
      [decodedSupplierName, ...(hasOrderAccount ? [decodedSupplierName] : [])]
    ) as any[];

    const products = rows.map((row: any) => row.product_name);

    console.log(`✅ Found ${products.length} products for supplier: "${decodedSupplierName}"`);

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error('Error fetching products by supplier:', error);
    return NextResponse.json({ products: [] });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
  }
}

