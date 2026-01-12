import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * DELETE endpoint to remove all marketing spend data from the database
 */
export async function DELETE() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Check if marketing_spend table exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'marketing_spend'
    `) as any[];

    if (tables.length === 0) {
      return NextResponse.json(
        { message: 'Marketing spend table does not exist. Nothing to delete.' },
        { status: 200 }
      );
    }

    // Get count before deletion
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM marketing_spend'
    ) as any[];
    const totalRecords = countResult[0]?.total || 0;

    // Delete all marketing spend
    await connection.query('DELETE FROM marketing_spend');

    // Reset auto-increment
    await connection.query('ALTER TABLE marketing_spend AUTO_INCREMENT = 1');

    return NextResponse.json({
      message: 'All marketing spend deleted successfully',
      deletedCount: totalRecords,
    });
  } catch (error: any) {
    console.error('Error deleting marketing spend:', error);
    return NextResponse.json(
      { error: 'Failed to delete marketing spend', details: error.message },
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

