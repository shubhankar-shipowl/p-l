import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Get orders statistics
    let ordersStats = {
      count: 0,
      latestUpload: null,
      oldestOrder: null,
      newestOrder: null,
    };

    try {
      const [ordersCount] = await connection.query(
        'SELECT COUNT(*) as count FROM orders'
      ) as any[];
      ordersStats.count = ordersCount[0]?.count || 0;

      if (ordersStats.count > 0) {
        const [uploadDate] = await connection.query(
          'SELECT MAX(created_at) as latest FROM orders'
        ) as any[];
        ordersStats.latestUpload = uploadDate[0]?.latest;

        const [dateRange] = await connection.query(
          'SELECT MIN(order_date) as oldest, MAX(order_date) as newest FROM orders'
        ) as any[];
        ordersStats.oldestOrder = dateRange[0]?.oldest;
        ordersStats.newestOrder = dateRange[0]?.newest;
      }
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Error fetching orders stats:', err);
      }
    }

    // Get shipping costs statistics
    let shippingStats = {
      count: 0,
      latestUpload: null,
    };

    try {
      const [shippingCount] = await connection.query(
        'SELECT COUNT(*) as count FROM shipping_costs'
      ) as any[];
      shippingStats.count = shippingCount[0]?.count || 0;

      if (shippingStats.count > 0) {
        const [uploadDate] = await connection.query(
          'SELECT MAX(created_at) as latest FROM shipping_costs'
        ) as any[];
        shippingStats.latestUpload = uploadDate[0]?.latest;
      }
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Error fetching shipping stats:', err);
      }
    }

    // Get marketing spend statistics
    let marketingStats = {
      count: 0,
      latestUpload: null,
      totalAmount: 0,
    };

    try {
      const [marketingCount] = await connection.query(
        'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM marketing_spend'
      ) as any[];
      marketingStats.count = marketingCount[0]?.count || 0;
      marketingStats.totalAmount = parseFloat(marketingCount[0]?.total || 0);

      if (marketingStats.count > 0) {
        const [uploadDate] = await connection.query(
          'SELECT MAX(created_at) as latest FROM marketing_spend'
        ) as any[];
        marketingStats.latestUpload = uploadDate[0]?.latest;
      }
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Error fetching marketing stats:', err);
      }
    }

    // Get price entries statistics
    let priceStats = {
      count: 0,
      latestUpload: null,
      suppliers: 0,
    };

    try {
      const [priceCount] = await connection.query(
        'SELECT COUNT(*) as count FROM price_entries'
      ) as any[];
      priceStats.count = priceCount[0]?.count || 0;

      if (priceStats.count > 0) {
        const [uploadDate] = await connection.query(
          'SELECT MAX(created_at) as latest FROM price_entries'
        ) as any[];
        priceStats.latestUpload = uploadDate[0]?.latest;
      }

      const [suppliersCount] = await connection.query(
        'SELECT COUNT(*) as count FROM suppliers'
      ) as any[];
      priceStats.suppliers = suppliersCount[0]?.count || 0;
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Error fetching price stats:', err);
      }
    }

    return NextResponse.json({
      orders: ordersStats,
      shippingCosts: shippingStats,
      marketingSpend: marketingStats,
      priceEntries: priceStats,
    });
  } catch (error: any) {
    console.error('Failed to fetch data stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data stats', details: error.message },
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

