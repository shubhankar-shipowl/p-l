import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  let connection;
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const forcePickupWarehouse = searchParams.get('force_pickup_warehouse') === 'true';
    
    connection = await pool.getConnection();
    
    // Check if orders table exists first
    try {
      const [tables] = await connection.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders'
      `) as any[];

      if (tables.length === 0) {
        console.warn('Orders table not found; returning empty warehouses list');
        return NextResponse.json({ warehouses: [] });
      }
    } catch (tableCheckError: any) {
      console.error('Error checking orders table:', tableCheckError);
      return NextResponse.json({ warehouses: [] });
    }

    let columnName = 'pickup_warehouse';
    
    // If not forcing pickup_warehouse, check if order_account exists and prefer it
    if (!forcePickupWarehouse) {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'order_account'
      `) as any[];
      
      const hasOrderAccount = columns.length > 0;
      if (hasOrderAccount) {
        columnName = 'order_account';
      }
    }
    
    const [rows] = await connection.query(
      `SELECT DISTINCT ${columnName} as warehouse
       FROM orders 
       WHERE ${columnName} IS NOT NULL 
         AND ${columnName} != '' 
       ORDER BY ${columnName}`
    );

    const warehouses = (rows as any[])
      .map((r) => r.warehouse)
      .filter(Boolean);

    return NextResponse.json({ warehouses });
  } catch (error: any) {
    console.error('Failed to fetch pickup warehouses:', error);
    
    // Handle connection errors gracefully
    if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.warn('Database connection lost. Returning empty warehouses list.');
      return NextResponse.json({ warehouses: [] });
    }
    
    // For other errors, return empty list instead of 500
    return NextResponse.json({ warehouses: [] });
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

