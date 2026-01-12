import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
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

    if (!supplier_id || !product_name || !price_before_gst || !hsn_code || !effective_from) {
      return NextResponse.json(
        { error: 'supplier_id, product_name, price_before_gst, hsn_code, and effective_from are required' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        `UPDATE price_entries SET
          supplier_id = ?,
          product_name = ?,
          currency = ?,
          price_before_gst = ?,
          gst_rate = ?,
          price_after_gst = ?,
          hsn_code = ?,
          effective_from = ?,
          effective_to = ?
        WHERE id = ?`,
        [
          supplier_id,
          product_name,
          currency,
          parseFloat(price_before_gst),
          parseFloat(gst_rate),
          parseFloat(price_after_gst || price_before_gst * (1 + parseFloat(gst_rate) / 100)),
          hsn_code,
          effective_from,
          effective_to || null,
          id,
        ]
      );

      if ((result as any).affectedRows === 0) {
        return NextResponse.json(
          { error: 'Price entry not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: 'Price entry updated successfully',
      });
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') {
        return NextResponse.json(
          { error: 'price_entries table is missing. Please run the database migrations.' },
          { status: 500 }
        );
      }
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update price entry', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        'DELETE FROM price_entries WHERE id = ?',
        [id]
      );

      if ((result as any).affectedRows === 0) {
        return NextResponse.json(
          { error: 'Price entry not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: 'Price entry deleted successfully',
      });
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') {
        return NextResponse.json(
          { error: 'price_entries table is missing. Please run the database migrations.' },
          { status: 500 }
        );
      }
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete price entry', details: error.message },
      { status: 500 }
    );
  }
}

