import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const supplier = searchParams.get('supplier');

    connection = await pool.getConnection();
    
    // Check if tables exist first
    try {
      const [tables] = await connection.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('price_entries', 'suppliers')
      `) as any[];
      
      const tableNames = tables.map((t: any) => t.TABLE_NAME);
      
      if (!tableNames.includes('price_entries')) {
        console.warn('price_entries table not found; returning empty list');
        return NextResponse.json([]);
      }
      
      if (!tableNames.includes('suppliers')) {
        console.warn('suppliers table not found; using price_entries only');
        // Query without supplier join
        const [rows] = await connection.query(
          `SELECT 
            id,
            supplier_id,
            '' as supplier_name,
            product_name,
            currency,
            price_before_gst,
            gst_rate,
            price_after_gst,
            hsn_code as hsn,
            effective_from,
            effective_to,
            created_at,
            updated_at
          FROM price_entries
          ORDER BY created_at DESC`
        );
        return NextResponse.json(rows);
      }
    } catch (tableCheckError: any) {
      console.error('Error checking tables:', tableCheckError);
      return NextResponse.json([]);
    }

    // Check for schema drift: ensure 'updated_at' column exists
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'price_entries' 
        AND COLUMN_NAME = 'updated_at'
      `) as any[];

      if (columns.length === 0) {
        console.warn('updated_at column missing in price_entries; adding it now...');
        await connection.query(`
          ALTER TABLE price_entries 
          ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `);
        console.log('Successfully added updated_at column to price_entries');
      }
    } catch (schemaError: any) {
      console.error('Error checking/updating schema:', schemaError);
      // Continue anyway, worst case the query fails but we logged the error
    }
    
    // Check for schema drift: ensure 'supplier_product_id' column exists
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'price_entries' 
        AND COLUMN_NAME = 'supplier_product_id'
      `) as any[];

      if (columns.length === 0) {
        console.warn('supplier_product_id column missing in price_entries; adding it now...');
        await connection.query(`
          ALTER TABLE price_entries 
          ADD COLUMN supplier_product_id VARCHAR(512)
        `);
      }
    } catch (schemaError) {
      // ignore schema check errors
    }
    
    // Check if order_account column exists for safe joining
    let hasOrderAccount = false;
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_account'
      `) as any[];
      hasOrderAccount = columns.length > 0;
    } catch (e) { /* ignore */ }

    const supplierCol = hasOrderAccount ? 'order_account' : 'pickup_warehouse';

    // Both tables exist, proceed with join query
    // We LEFT JOIN with orders to find the matching 'pickup_warehouse' name for this supplier/product
    // This prioritizes the readable Warehouse Name over the email address often stored in suppliers table
    let query = `
      SELECT 
        pe.id,
        pe.supplier_id,
        pe.supplier_product_id,
        COALESCE(NULLIF(TRIM(MAX(o.pickup_warehouse)), ''), s.name) as supplier_name,
        pe.product_name,
        pe.currency,
        pe.price_before_gst,
        pe.gst_rate,
        pe.price_after_gst,
        pe.hsn_code as hsn,
        pe.effective_from,
        pe.effective_to,
        pe.created_at,
        pe.updated_at
      FROM price_entries pe
      LEFT JOIN suppliers s ON pe.supplier_id = s.id
      LEFT JOIN orders o ON 
        TRIM(o.product_name) = TRIM(pe.product_name) AND (
          TRIM(o.${supplierCol}) = s.name OR 
          TRIM(o.pickup_warehouse) = s.name OR 
          TRIM(o.fulfilled_by) = s.name
        )
      WHERE 1=1
    `;
    const params: any[] = [];

    if (supplier && supplier !== 'all') {
      query += ' AND s.name = ?';
      params.push(supplier);
    }
    
    // We need to group by Price Entry ID because the JOIN with orders might produce duplicates
    // aggregation functions like MAX(orders.pickup_warehouse) work with GROUP BY
    query += ' GROUP BY pe.id ORDER BY pe.created_at DESC';

    const [rows] = await connection.query(query, params);
    return NextResponse.json(rows);
    
  } catch (error: any) {
    console.error('Price entries GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price entries', details: error.message },
      { status: 500 }
    );
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

export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();
    const {
      supplier_id,
      product_name,
      currency = 'INR',
      price_before_gst,
      gst_rate = 0,
      price_after_gst,
      hsn_code,
      effective_from,
      effective_to,
    } = body;

    if (!supplier_id || !product_name || !effective_from) {
      return NextResponse.json(
        { error: 'supplier_id, product_name, and effective_from are required' },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    
    // Check if table exists, create if not
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS price_entries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          supplier_id INT NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          price_before_gst DECIMAL(10, 2) DEFAULT 0,
          gst_rate DECIMAL(5, 2) DEFAULT 0,
          price_after_gst DECIMAL(10, 2) DEFAULT 0,
          hsn_code VARCHAR(20) DEFAULT '',
          effective_from DATE NOT NULL,
          effective_to DATE,
          supplier_product_id VARCHAR(512),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_supplier (supplier_id),
          INDEX idx_product (product_name),
          INDEX idx_effective (effective_from, effective_to)
        )
      `);
    } catch (createError: any) {
      console.warn('Table creation check failed:', createError.message);
    }
    
    const [supplierResult] = await connection.query(
      'SELECT name FROM suppliers WHERE id = ?',
      [supplier_id]
    ) as any[];

    let supplierName = 'Unknown';
    if (supplierResult.length > 0) {
      supplierName = supplierResult[0].name;
    }

    // Generate Supplier Product ID (Supplier Name + Product Name)
    // Using concatenation as requested: Pickup Warehouse (Supplier Name) + Product Name
    const supplier_product_id = `${supplierName}${product_name}`;

    const [result] = await connection.query(
      `INSERT INTO price_entries (
        supplier_id, product_name, supplier_product_id, currency, price_before_gst, 
        gst_rate, price_after_gst, hsn_code, effective_from, effective_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplier_id,
        product_name,
        supplier_product_id,
        currency,
        (() => {
          // Logic for Price Validation & Calculation
          const afterGst = price_after_gst ? parseFloat(price_after_gst) : 0;
          const beforeGst = price_before_gst ? parseFloat(price_before_gst) : 0;
          let rate = gst_rate ? parseFloat(gst_rate) : 0;

          // Case 1: Users entered Price After GST only (Back Calculation)
          if (afterGst > 0 && beforeGst === 0) {
            // Default to 18% if not provided, as this is the standard use case requested
            if (rate === 0) rate = 18;
            return (afterGst / (1 + rate / 100)).toFixed(2);
          }
          
          // Case 2: Standard entry
          return beforeGst;
        })(),
        (() => {
          const afterGst = price_after_gst ? parseFloat(price_after_gst) : 0;
          const beforeGst = price_before_gst ? parseFloat(price_before_gst) : 0;
          let rate = gst_rate ? parseFloat(gst_rate) : 0;

          if (afterGst > 0 && beforeGst === 0 && rate === 0) return 18; // Default 18 for back-calc
          return rate;
        })(),
        (() => {
           const afterGst = price_after_gst ? parseFloat(price_after_gst) : 0;
           const beforeGst = price_before_gst ? parseFloat(price_before_gst) : 0;
           const rate = gst_rate ? parseFloat(gst_rate) : (afterGst > 0 && beforeGst === 0 ? 18 : 0);
           
           if (afterGst > 0) return afterGst;
           return (beforeGst * (1 + rate / 100)).toFixed(2);
        })(),
        hsn_code || '',
        effective_from,
        effective_to || null,
      ]
    );

    return NextResponse.json({
      message: 'Price entry created successfully',
      id: (result as any).insertId,
    });
  } catch (error: any) {
    console.error('Price entries POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create price entry', details: error.message },
      { status: 500 }
    );
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

