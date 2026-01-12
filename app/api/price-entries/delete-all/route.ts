import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * DELETE endpoint to remove all price entries and suppliers from the database
 */
export async function DELETE() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    await connection.beginTransaction();

    let deletedPrices = 0;
    let deletedSuppliers = 0;

    // Delete price entries first (due to foreign key)
    try {
      const [priceResult] = await connection.query('DELETE FROM price_entries') as any[];
      deletedPrices = priceResult.affectedRows || 0;
      await connection.query('ALTER TABLE price_entries AUTO_INCREMENT = 1');
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') {
        throw err;
      }
    }

    // Delete suppliers
    try {
      const [supplierResult] = await connection.query('DELETE FROM suppliers') as any[];
      deletedSuppliers = supplierResult.affectedRows || 0;
      await connection.query('ALTER TABLE suppliers AUTO_INCREMENT = 1');
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') {
        throw err;
      }
    }

    await connection.commit();

    return NextResponse.json({
      message: 'All price entries and suppliers deleted successfully',
      deletedPrices,
      deletedSuppliers,
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error deleting price entries:', error);
    return NextResponse.json(
      { error: 'Failed to delete price entries', details: error.message },
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

