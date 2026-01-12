import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { parseFile } from '@/lib/file-parser';

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

    try {
      const data = await parseFile(file);
      const connection = await pool.getConnection();

      try {
        // Check if shipping_costs table exists
        const [tables] = await connection.query(`
          SELECT TABLE_NAME 
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'shipping_costs'
        `) as any[];

        if (tables.length > 0) {
          // Table exists - DELETE ALL existing data before importing new data (OVERRIDE mode)
          console.log('Deleting all existing shipping costs before import...');
          const [deleteResult] = await connection.query('DELETE FROM shipping_costs') as any[];
          console.log(`Deleted ${deleteResult.affectedRows || 0} existing shipping costs`);
          
          // Reset auto-increment
          await connection.query('ALTER TABLE shipping_costs AUTO_INCREMENT = 1');
        }

        await connection.beginTransaction();

        const insertQuery = `
          INSERT INTO shipping_costs (region, weight_range, shipping_cost)
          VALUES (?, ?, ?)
        `;

        let insertedCount = 0;
        for (const row of data) {
          // Support both new column names and legacy names
          const fulfilledBy = row['Fulfilled By'] || row['fulfilled_by'] || row['Fulfilled By'] || row.region || '';
          const shippingCost = row['Shipping Cost'] || row['shipping_cost'] || row['Shipping Cost'] || row.shipping_cost || 0;
          
          if (!fulfilledBy || !shippingCost) {
            continue;
          }

          await connection.query(insertQuery, [
            fulfilledBy, // Using fulfilled_by as region
            '', // weight_range can be empty or set to default
            parseFloat(String(shippingCost)) || 0,
          ]);
          insertedCount++;
        }

        await connection.commit();
        return NextResponse.json({ 
          message: `Successfully imported ${insertedCount} shipping cost entries`,
          count: insertedCount 
        });
      } catch (error: any) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Failed to import shipping costs', details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
