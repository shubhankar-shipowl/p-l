import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * DELETE endpoint to remove all order data from the database
 * This is a destructive operation - use with caution!
 */
export async function DELETE(request: NextRequest) {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Check if orders table exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders'
    `) as any[];

    if (tables.length === 0) {
      return NextResponse.json(
        { message: 'Orders table does not exist. Nothing to delete.' },
        { status: 200 }
      );
    }

    // Get count before deletion
    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM orders') as any[];
    const totalOrders = countResult[0]?.total || 0;

    // Delete all orders
    await connection.query('DELETE FROM orders');

    // Reset auto-increment (optional)
    await connection.query('ALTER TABLE orders AUTO_INCREMENT = 1');

    return NextResponse.json({
      message: 'All order data deleted successfully',
      deletedCount: totalOrders,
    });
  } catch (error: any) {
    console.error('Error deleting orders:', error);
    return NextResponse.json(
      { error: 'Failed to delete orders', details: error.message },
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

