import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const text = await file.text();
    
    const result = await new Promise<NextResponse>((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const data = results.data as any[];
            const connection = await pool.getConnection();

            try {
              await connection.beginTransaction();

              const insertQuery = `
                INSERT INTO price_list (product_name, cost_price, selling_price)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  cost_price = VALUES(cost_price),
                  selling_price = VALUES(selling_price)
              `;

              for (const row of data) {
                if (!row.product_name) {
                  continue;
                }

                await connection.query(insertQuery, [
                  row.product_name,
                  parseFloat(row.cost_price) || 0,
                  parseFloat(row.selling_price) || 0,
                ]);
              }

              await connection.commit();
              resolve(NextResponse.json({ 
                message: `Successfully imported ${data.length} price list entries`,
                count: data.length 
              }));
            } catch (error: any) {
              await connection.rollback();
              throw error;
            } finally {
              connection.release();
            }
          } catch (error: any) {
            resolve(NextResponse.json(
              { error: 'Failed to import price list', details: error.message },
              { status: 500 }
            ));
          }
        },
        error: (error: any) => {
          resolve(NextResponse.json(
            { error: 'Failed to parse CSV', details: error.message },
            { status: 400 }
          ));
        },
      });
    });

    return result;
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}

