import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Initialize all required database tables
 * This endpoint creates suppliers and price_entries tables if they don't exist
 */
export async function POST() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Create suppliers table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ suppliers table ready');
    } catch (err) {
      console.error('Error creating suppliers table:', err);
    }

    // Create price_entries table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS price_entries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          supplier_id INT NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          price_before_gst DECIMAL(10, 2) NOT NULL,
          gst_rate DECIMAL(5, 2) DEFAULT 0.00,
          price_after_gst DECIMAL(10, 2) NOT NULL,
          hsn_code VARCHAR(50) NOT NULL,
          effective_from DATE NOT NULL,
          effective_to DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
          UNIQUE KEY unique_product_supplier (supplier_id, product_name),
          INDEX idx_product_name (product_name)
        )
      `);
      console.log('✅ price_entries table ready');
    } catch (err) {
      console.error('Error creating price_entries table:', err);
    }

    // Create shipping_costs table if needed
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS shipping_costs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          region VARCHAR(255) NOT NULL,
          weight_range VARCHAR(100),
          shipping_cost DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_region (region)
        )
      `);
      console.log('✅ shipping_costs table ready');
    } catch (err) {
      console.error('Error creating shipping_costs table:', err);
    }

    // Create marketing_spend table if needed
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS marketing_spend (
          id INT AUTO_INCREMENT PRIMARY KEY,
          spend_date DATE NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          channel VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_spend_date (spend_date)
        )
      `);
      console.log('✅ marketing_spend table ready');
    } catch (err) {
      console.error('Error creating marketing_spend table:', err);
    }

    return NextResponse.json({
      message: 'All required tables initialized successfully',
      tables: ['suppliers', 'price_entries', 'shipping_costs', 'marketing_spend']
    });
  } catch (error: any) {
    console.error('Failed to initialize tables:', error);
    return NextResponse.json(
      { error: 'Failed to initialize tables', details: error.message },
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

