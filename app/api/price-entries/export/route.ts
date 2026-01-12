
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const connection = await pool.getConnection();
    let priceEntries: any[] = [];

    try {
      // Dynamic column check for orders table to safely join
      let hasOrderAccount = false;
      try {
        const [columns] = await connection.query(`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_account'
        `) as any[];
        hasOrderAccount = columns.length > 0;
      } catch (e) { /* ignore */ }

      const supplierCol = hasOrderAccount ? 'order_account' : 'pickup_warehouse';
      
      // Get all price entries with supplier names and order counts
      // We join with orders to calculate the count of orders for this product/supplier combo
      const query = `
        SELECT 
          pe.id,
          pe.supplier_id,
          pe.supplier_product_id,
          COALESCE(NULLIF(TRIM(MAX(o.pickup_warehouse)), ''), s.name) as supplier_name,
          pe.product_name,
          pe.currency,
          pe.price_before_gst as price_before_gst,
          pe.gst_rate as gst_rate,
          pe.price_after_gst as price_after_gst,
          pe.hsn_code as hsn_code,
          pe.effective_from,
          pe.effective_to,
          COUNT(o.id) as order_count
        FROM price_entries pe
        LEFT JOIN suppliers s ON pe.supplier_id = s.id
        LEFT JOIN orders o ON 
          TRIM(o.product_name) = TRIM(pe.product_name) AND (
            TRIM(o.${supplierCol}) = s.name OR 
            TRIM(o.pickup_warehouse) = s.name OR 
            TRIM(o.fulfilled_by) = s.name
          )
        WHERE 1=1 GROUP BY pe.id ORDER BY pe.created_at DESC
      `;

      const [rows] = await connection.query(query) as any[];

      priceEntries = rows || [];
    } catch (err: any) {
      console.warn('Error fetching price entries:', err.message);
    } finally {
      if (connection) connection.release();
    }

    // Create CSV content with exact column order
    const headers = [
      'Supplier Name',
      'Product Name',
      'Order Count',
      'Supplier Product ID',
      'Price Before GST (INR)',
      'GST Rate (%)',
      'Price After GST (INR)',
      'HSN Code',
      'Currency',
      'Effective From (YYYY-MM-DD)',
      'Effective To (YYYY-MM-DD)'
    ];

    // Helper to escape CSV fields
    const toCsvField = (field: any) => {
      if (field === null || field === undefined) return '';
      const stringField = String(field);
      // Escape quotes by doubling them, and wrap in quotes if contains comma, quote or newline
      if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    // Start with headers
    let csvContent = headers.join(',') + '\n';

    // Add price entries
    priceEntries.forEach((entry) => {
      const effectiveFrom = entry.effective_from 
        ? new Date(entry.effective_from).toISOString().split('T')[0]
        : '';
      const effectiveTo = entry.effective_to 
        ? new Date(entry.effective_to).toISOString().split('T')[0]
        : '';
      
      // Fallback for supplier_product_id if missing in DB
      const supplierProductId = entry.supplier_product_id || 
        (entry.supplier_name && entry.product_name ? `${entry.supplier_name}${entry.product_name}` : '');

      const row = [
        entry.supplier_name || '',
        entry.product_name || '',
        entry.order_count || '0',
        supplierProductId,
        entry.price_before_gst || '',
        entry.gst_rate || '0',
        entry.price_after_gst || '',
        entry.hsn_code || '',
        entry.currency || 'INR',
        effectiveFrom,
        effectiveTo
      ];
      csvContent += row.map(toCsvField).join(',') + '\n';
    });

    // Return as Excel-compatible CSV
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="product-database-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to export product database', details: error.message },
      { status: 500 }
    );
  }
}
