import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { parseFile } from '@/lib/file-parser';

export async function POST(request: NextRequest) {
  let connection;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    console.log(`Parsing bulk import file: ${file.name}, size: ${file.size} bytes`);

    // Parse the file (CSV or Excel)
    const data = await parseFile(file);
    
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No data found in file' },
        { status: 400 }
      );
    }

    console.log(`Parsed ${data.length} rows from file`);

    connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Ensure tables exist
      await connection.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS price_entries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          supplier_id INT NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          price_before_gst DECIMAL(10, 2) NOT NULL,
          gst_rate DECIMAL(5, 2) DEFAULT 0.00,
          price_after_gst DECIMAL(10, 2) NOT NULL,
          hsn_code VARCHAR(50) NOT NULL,
          effective_from DATE NOT NULL,
          effective_to DATE,
          supplier_product_id VARCHAR(512),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
          UNIQUE KEY unique_product_supplier (supplier_id, product_name),
          INDEX idx_product_name (product_name)
        )
      `);
      
      // Auto-migrate: Add supplier_product_id if missing
      try {
        const [columns] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'price_entries' 
          AND COLUMN_NAME = 'supplier_product_id'
        `) as any[];

        if (columns.length === 0) {
          console.warn('supplier_product_id column missing in price_entries; adding it now...');
          await connection.query(`
            ALTER TABLE price_entries 
            ADD COLUMN supplier_product_id VARCHAR(512)
          `);
        }
      } catch (err) {
        // ignore
      }

      // Helper function to get value from row (case-insensitive)
      const getValue = (row: any, keys: string[]): string => {
        const rowKeys = Object.keys(row);
        for (const key of keys) {
          // Try exact match first
          if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return String(row[key]).trim();
          }
          // Try case-insensitive match
          const found = rowKeys.find(k => k.toLowerCase().replace(/\s+/g, '') === key.toLowerCase().replace(/\s+/g, ''));
          if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
            return String(row[found]).trim();
          }
        }
        return '';
      };

      // Expected CSV/Excel columns:
      // Supplier Name, Product Name, Order Count, Supplier Product ID, Price Before GST (INR), GST Rate (%), Price After GST (INR), HSN Code, Currency, Effective From (YYYY-MM-DD), Effective To (YYYY-MM-DD)

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Get supplier ID by name (or create if doesn't exist)
          const supplierName = getValue(row, ['Supplier Name', 'supplier_name', 'Supplier']);
          const productName = getValue(row, ['Product Name', 'product_name', 'Product']);
          // Order Count and Supplier Product ID are informational, not stored
          const currency = getValue(row, ['Currency', 'currency']) || 'INR';
          const priceBeforeGstStr = getValue(row, ['Price Before GST (INR)', 'Price Before GST', 'price_before_gst', 'Price']);
          const gstRateStr = getValue(row, ['GST Rate (%)', 'gst_rate', 'GST Rate', 'GST']);
          const priceAfterGstStr = getValue(row, ['Price After GST (INR)', 'Price After GST', 'price_after_gst']);
          const hsnCode = getValue(row, ['HSN Code', 'hsn_code', 'HSN']);
          const effectiveFrom = getValue(row, ['Effective From (YYYY-MM-DD)', 'Effective From', 'effective_from', 'From']);
          const effectiveTo = getValue(row, ['Effective To (YYYY-MM-DD)', 'Effective To', 'effective_to', 'To']) || null;

          // Parse numeric values and handle NaN
          let priceBeforeGst = priceBeforeGstStr ? parseFloat(priceBeforeGstStr) : 0;
          let gstRate = gstRateStr ? parseFloat(gstRateStr) : 0;
          let priceAfterGst = priceAfterGstStr ? parseFloat(priceAfterGstStr) : 0;

          // Check for NaN and set to 0
          if (isNaN(priceBeforeGst)) priceBeforeGst = 0;
          if (isNaN(gstRate)) gstRate = 0;
          if (isNaN(priceAfterGst)) priceAfterGst = 0;

          // If Price After GST not provided, calculate it
          if (priceAfterGst === 0 && priceBeforeGst > 0) {
            priceAfterGst = priceBeforeGst * (1 + gstRate / 100);
          } else if (priceBeforeGst === 0 && priceAfterGst > 0) {
            // Back Calculation: If Price Before GST is missing but After GST is present
            if (gstRate === 0) gstRate = 18; // Default to 18%
            priceBeforeGst = parseFloat((priceAfterGst / (1 + gstRate / 100)).toFixed(2));
          }

          // Validate required fields
          if (!supplierName || !productName || !hsnCode || !effectiveFrom) {
            errorCount++;
            errors.push(`Row ${i + 2}: Missing required fields (Supplier: ${supplierName}, Product: ${productName}, HSN: ${hsnCode}, From: ${effectiveFrom})`);
            continue;
          }

          if (priceAfterGst <= 0) {
            errorCount++;
            errors.push(`Row ${i + 2}: Invalid price (Price After GST must be > 0)`);
            continue;
          }

          // Find or create supplier
          let [suppliers] = await connection.query(
            'SELECT id FROM suppliers WHERE name = ?',
            [supplierName]
          ) as any[];

          let supplierId: number;
          if (suppliers.length === 0) {
            // Create new supplier
            const [result] = await connection.query(
              'INSERT INTO suppliers (name) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
              [supplierName]
            );
            supplierId = (result as any).insertId;
          } else {
            supplierId = suppliers[0].id;
          }

          // Insert or update price entry
          const supplier_product_id = `${supplierName}${productName}`;
          
          await connection.query(`
            INSERT INTO price_entries (
              supplier_id, product_name, supplier_product_id, currency, price_before_gst,
              gst_rate, price_after_gst, hsn_code, effective_from, effective_to
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              currency = VALUES(currency),
              price_before_gst = VALUES(price_before_gst),
              gst_rate = VALUES(gst_rate),
              price_after_gst = VALUES(price_after_gst),
              hsn_code = VALUES(hsn_code),
              effective_from = VALUES(effective_from),
              effective_to = VALUES(effective_to),
              supplier_product_id = VALUES(supplier_product_id)
          `, [
            supplierId,
            productName,
            supplier_product_id,
            currency,
            priceBeforeGst,
            gstRate,
            priceAfterGst,
            hsnCode,
            effectiveFrom,
            effectiveTo || null,
          ]);

          successCount++;
        } catch (rowError: any) {
          errorCount++;
          console.error(`Error processing row ${i + 2}:`, rowError);
          errors.push(`Row ${i + 2}: ${rowError.message}`);
        }
      }

      await connection.commit();
      console.log(`Bulk import completed: ${successCount} success, ${errorCount} errors`);
      
      return NextResponse.json({
        message: `Successfully imported ${successCount} price entries`,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors.slice(0, 20) : [], // Show first 20 errors
      });
    } catch (error: any) {
      if (connection) {
        await connection.rollback();
      }
      console.error('Bulk import transaction error:', error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  } catch (error: any) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { error: 'Failed to import price entries', details: error.message },
      { status: 500 }
    );
  }
}

