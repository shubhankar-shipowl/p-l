import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const connection = await pool.getConnection();
    try {
      let rows: any = [];
      try {
        [rows] = await connection.query(
          'SELECT id, name, created_at FROM suppliers ORDER BY name ASC'
        );
      } catch (err: any) {
        if (err?.code === 'ER_NO_SUCH_TABLE') {
          console.warn('suppliers table not found; returning empty list');
          rows = [];
        } else {
          throw err;
        }
      }

      return NextResponse.json(rows);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch suppliers', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const trimmedName = String(name).trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    try {
      // Ensure table exists
      await connection.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const [result] = await connection.query(
        'INSERT INTO suppliers (name) VALUES (?)',
        [trimmedName]
      );

      return NextResponse.json({
        message: 'Supplier created successfully',
        id: (result as any).insertId,
      });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        // fetch existing id
        const [rows] = await connection.query(
          'SELECT id FROM suppliers WHERE name = ? LIMIT 1',
          [trimmedName]
        ) as any[];
        const existingId = Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
        return NextResponse.json(
          {
            message: 'Supplier already exists',
            id: existingId,
          },
          { status: 200 }
        );
      }
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create supplier', details: error.message },
      { status: 500 }
    );
  }
}

