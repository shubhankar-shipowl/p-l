import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spend_date, amount, channel, notes } = body;

    if (!spend_date || !amount) {
      return NextResponse.json(
        { error: 'spend_date and amount are required' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    try {
      // Check if table exists and create if missing
      const [tables] = await connection.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'marketing_spend'
      `) as any[];

      if (tables.length === 0) {
        // Create marketing_spend table
        await connection.query(`
          CREATE TABLE marketing_spend (
            id INT AUTO_INCREMENT PRIMARY KEY,
            spend_date DATE NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            channel VARCHAR(100),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_spend_date (spend_date)
          )
        `);
        console.log('marketing_spend table created');
      }

      const [result] = await connection.query(
        `INSERT INTO marketing_spend (spend_date, amount, channel, notes)
         VALUES (?, ?, ?, ?)`,
        [spend_date, parseFloat(amount), channel || null, notes || null]
      );

      return NextResponse.json({
        message: 'Marketing spend added successfully',
        id: (result as any).insertId,
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('Error adding marketing spend:', error);
    return NextResponse.json(
      { error: 'Failed to add marketing spend', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM marketing_spend';
      const params: any[] = [];

      if (startDate && endDate) {
        query += ' WHERE spend_date BETWEEN ? AND ?';
        params.push(startDate, endDate);
      } else if (startDate) {
        query += ' WHERE spend_date >= ?';
        params.push(startDate);
      } else if (endDate) {
        query += ' WHERE spend_date <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY spend_date DESC';

      let rows: any = [];
      try {
        [rows] = await connection.query(query, params);
      } catch (err: any) {
        if (err?.code === 'ER_NO_SUCH_TABLE') {
          // Table missing, return empty array instead of 500
          console.warn('marketing_spend table not found; returning empty list');
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
      { error: 'Failed to fetch marketing spend', details: error.message },
      { status: 500 }
    );
  }
}

