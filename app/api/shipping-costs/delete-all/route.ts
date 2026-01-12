import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * DELETE endpoint to remove all shipping costs data from the database
 */
export async function DELETE() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Check if shipping_costs table exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipping_costs'
    `) as any[];

    if (tables.length === 0) {
      return NextResponse.json(
        { message: 'Shipping costs table does not exist. Nothing to delete.' },
        { status: 200 }
      );
    }

    // Get count before deletion
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM shipping_costs'
    ) as any[];
    const totalRecords = countResult[0]?.total || 0;

    // Delete all shipping costs
    await connection.query('DELETE FROM shipping_costs');

    // Reset auto-increment
    await connection.query('ALTER TABLE shipping_costs AUTO_INCREMENT = 1');

    return NextResponse.json({
      message: 'All shipping costs deleted successfully',
      deletedCount: totalRecords,
    });
  } catch (error: any) {
    console.error('Error deleting shipping costs:', error);
    return NextResponse.json(
      { error: 'Failed to delete shipping costs', details: error.message },
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

