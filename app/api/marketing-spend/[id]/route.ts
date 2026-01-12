import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        'DELETE FROM marketing_spend WHERE id = ?',
        [id]
      );

      if ((result as any).affectedRows === 0) {
        return NextResponse.json(
          { error: 'Marketing spend entry not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: 'Marketing spend deleted successfully',
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete marketing spend', details: error.message },
      { status: 500 }
    );
  }
}

