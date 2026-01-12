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
      
      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: "No data found in file. Please check the file format." },
          { status: 400 }
        );
      }

      console.log('Parsed data sample:', JSON.stringify(data[0], null, 2));
      console.log('Total rows:', data.length);
      
      const connection = await pool.getConnection();

            try {
              // Ensure orders table exists - check if it exists first
              const [tables] = await connection.query(`
                SELECT TABLE_NAME 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders'
              `) as any[];

              if (tables.length === 0) {
                // Create new table with VARCHAR status to support any status value
                await connection.query(`
                  CREATE TABLE orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    channel VARCHAR(100),
                    order_date DATE NOT NULL,
                    fulfilled_by VARCHAR(100),
                    delivered_date DATE,
                    product_name VARCHAR(255),
                    order_amount DECIMAL(10, 2),
                    pickup_warehouse VARCHAR(255),
                    order_account VARCHAR(255),
                    waybill_number VARCHAR(255),
                    product_value DECIMAL(10, 2),
                    mode VARCHAR(100),
                    status VARCHAR(100) NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_order_date (order_date),
                    INDEX idx_status (status)
                  )
                `);
                console.log('Orders table created');
              } else {
                // Check if order_account column exists, if not add it
                try {
                  const [orderAccountCheck] = await connection.query(`
                    SELECT COLUMN_NAME 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'orders' 
                    AND COLUMN_NAME = 'order_account'
                  `) as any[];
                  
                  if (orderAccountCheck.length === 0) {
                    await connection.query(`
                      ALTER TABLE orders ADD COLUMN order_account VARCHAR(255) AFTER pickup_warehouse
                    `);
                    console.log('Added order_account column');
                  } else {
                    console.log('order_account column already exists');
                  }
                } catch (alterError: any) {
                  console.log('Error checking/adding order_account column:', alterError.message);
                }
                // Table exists - DELETE ALL existing data before importing new data (OVERRIDE mode)
                console.log('Deleting all existing orders before import...');
                const [deleteResult] = await connection.query('DELETE FROM orders') as any[];
                console.log(`Deleted ${deleteResult.affectedRows || 0} existing orders`);
                
                // Reset auto-increment
                await connection.query('ALTER TABLE orders AUTO_INCREMENT = 1');
                
                // Check if status column is ENUM and needs to be changed
                try {
                  const [columns] = await connection.query(`
                    SELECT COLUMN_TYPE 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'orders' 
                    AND COLUMN_NAME = 'status'
                  `) as any[];
                  
                  if (columns.length > 0 && columns[0].COLUMN_TYPE && columns[0].COLUMN_TYPE.toLowerCase().includes('enum')) {
                    // Change ENUM to VARCHAR to support any status value
                    await connection.query(`
                      ALTER TABLE orders 
                      MODIFY COLUMN status VARCHAR(100) NOT NULL DEFAULT 'pending'
                    `);
                    console.log('Status column changed from ENUM to VARCHAR');
                  }
                } catch (alterError: any) {
                  console.warn('Could not check/alter status column:', alterError.message);
                }
              }
              console.log('Orders table verified/ready');

              await connection.beginTransaction();

              // Helper function to get value from row (case-insensitive)
              const getValue = (row: any, keys: string[]): string => {
                const rowKeys = Object.keys(row);
                for (const key of keys) {
                  // Try exact match first
                  if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                    return String(row[key]).trim();
                  }
                  // Try case-insensitive match
                  const found = rowKeys.find(k => k.toLowerCase() === key.toLowerCase());
                  if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
                    return String(row[found]).trim();
                  }
                }
                return '';
              };

              // Parse and prepare data in batches
              const BATCH_SIZE = 1000;
              const values: any[] = [];
              let skippedCount = 0;

              console.log('Processing', data.length, 'rows...');
              if (data.length > 0) {
                console.log('First row columns:', Object.keys(data[0]));
                console.log('First row sample:', JSON.stringify(data[0], null, 2));
              }

              for (let i = 0; i < data.length; i++) {
                const row = data[i];
                
                // Get values with flexible column name matching
                const channelOrderDate = getValue(row, ['Channel Order Date', 'channel order date', 'ChannelOrderDate']);
                const orderDate = getValue(row, ['Order Date', 'order date', 'OrderDate']) || channelOrderDate;
                const fulfilledBy = getValue(row, ['Fulfilled By', 'fulfilled by', 'FulfilledBy']) || null;
                const deliveredDate = getValue(row, ['Delivered Date', 'delivered date', 'DeliveredDate']) || null;
                const productName = getValue(row, ['Product Name', 'product name', 'ProductName']);
                const orderAmount = getValue(row, ['Order Amount', 'order amount', 'OrderAmount']) || '0';
                const pickupWarehouse = getValue(row, ['Pickup Warehouse', 'pickup warehouse', 'PickupWarehouse']) || null;
                const orderAccount = getValue(row, ['Order Account', 'order account', 'OrderAccount']) || null;
                const waybillNumber = getValue(row, ['WayBill Number', 'waybill number', 'WayBill Number', 'WaybillNumber']) || null;
                const productValue = getValue(row, ['Product Value', 'product value', 'ProductValue']) || '0';
                const mode = getValue(row, ['Mode', 'mode']) || null;
                const status = getValue(row, ['Status', 'status']) || 'pending';

                // Validate required fields - use Order Date or Channel Order Date
                const finalOrderDate = orderDate || channelOrderDate;
                if (!finalOrderDate || !productName) {
                  skippedCount++;
                  if (i < 5) {
                    console.log(`Row ${i + 1} skipped - missing fields. Available columns:`, Object.keys(row));
                  }
                  continue;
                }

                // Format dates
                let validOrderDate = finalOrderDate;
                if (validOrderDate && !/^\d{4}-\d{2}-\d{2}$/.test(validOrderDate)) {
                  // Handle datetime format (e.g., "2025-12-08 09:03:34")
                  const datePart = validOrderDate.split(' ')[0];
                  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    validOrderDate = datePart;
                  } else {
                    const parsedDate = new Date(validOrderDate);
                    if (!isNaN(parsedDate.getTime())) {
                      validOrderDate = parsedDate.toISOString().split('T')[0];
                    } else {
                      skippedCount++;
                      continue;
                    }
                  }
                }

                let validDeliveredDate = deliveredDate;
                if (validDeliveredDate && !/^\d{4}-\d{2}-\d{2}$/.test(validDeliveredDate)) {
                  const datePart = validDeliveredDate.split(' ')[0];
                  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    validDeliveredDate = datePart;
                  } else {
                    const parsedDate = new Date(validDeliveredDate);
                    if (!isNaN(parsedDate.getTime())) {
                      validDeliveredDate = parsedDate.toISOString().split('T')[0];
                    } else {
                      validDeliveredDate = null;
                    }
                  }
                }

                const channel = fulfilledBy || 'Unknown';

                values.push([
                  channel || null,
                  validOrderDate,
                  fulfilledBy,
                  validDeliveredDate || null,
                  productName,
                  parseFloat(String(orderAmount)) || 0,
                  pickupWarehouse,
                  orderAccount,
                  waybillNumber,
                  parseFloat(String(productValue)) || 0,
                  mode,
                  status || 'pending',
                ]);
              }

              if (values.length === 0) {
                throw new Error(`No valid rows found. Skipped ${skippedCount} rows. Please check column names. Available columns in first row: ${Object.keys(data[0] || {}).join(', ')}`);
              }

              // Bulk insert in batches
              const insertQuery = `
                INSERT INTO orders (
                  channel,
                  order_date,
                  fulfilled_by,
                  delivered_date,
                  product_name,
                  order_amount,
                  pickup_warehouse,
                  order_account,
                  waybill_number,
                  product_value,
                  mode,
                  status
                )
                VALUES ?
              `;

              // Insert in batches to avoid memory issues
              let insertedCount = 0;
              for (let i = 0; i < values.length; i += BATCH_SIZE) {
                const batch = values.slice(i, i + BATCH_SIZE);
                await connection.query(insertQuery, [batch]);
                insertedCount += batch.length;
                console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows (Total: ${insertedCount}/${values.length})`);
              }

              await connection.commit();
              return NextResponse.json({
                message: `Successfully imported ${insertedCount} orders${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`,
                count: insertedCount,
                skipped: skippedCount,
              });
            } catch (error: any) {
              await connection.rollback();
              console.error('Database error:', error);
              // Check if table doesn't exist
              if (error.code === 'ER_NO_SUCH_TABLE') {
                throw new Error('Orders table does not exist. Please run the database migrations.');
              }
              throw error;
            } finally {
              connection.release();
            }
    } catch (error: any) {
      console.error('Upload error:', error);
      return NextResponse.json(
        { 
          error: "Failed to import orders", 
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
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

