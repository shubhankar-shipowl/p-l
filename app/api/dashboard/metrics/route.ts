import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

async function getConnectionWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const connection = await pool.getConnection();
      // Test the connection
      await connection.ping();
      return connection;
    } catch (error: any) {
      console.warn(`Connection attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw new Error('Failed to get database connection');
}

export async function GET(request: NextRequest) {
  let connection: any;
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');
    const storesParam = searchParams.getAll('stores[]'); 
    
    // Date Range Logic
    const showAllData = !startDateParam && !endDateParam;
    const startDate = startDateParam || '2024-01-01';
    const endDate = endDateParam || new Date().toISOString().split('T')[0];
    
    // Calculate Previous Period
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 86400000); // 1 day before start
    const prevStart = new Date(prevEnd.getTime() - duration);
    
    const prevStartDate = prevStart.toISOString().split('T')[0];
    const prevEndDate = prevEnd.toISOString().split('T')[0];

    const hasStoreFilter = storesParam.length > 0;
    
    connection = await getConnectionWithRetry();
    
    try {
       // Validate connection
      await connection.ping();

      // Column check
      let filterColumn = 'pickup_warehouse';
      try {
        // Check if pickup_warehouse exists first (Priority)
        const [pwColumns] = await connection.query(`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pickup_warehouse'
        `) as any[];
        
        if (pwColumns.length > 0) {
           filterColumn = 'pickup_warehouse';
        } else {
             // Fallback to order_account
            const [columns] = await connection.query(`
              SELECT COLUMN_NAME FROM information_schema.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_account'
            `) as any[];
            if (columns.length > 0) filterColumn = 'order_account';
        }
      } catch (e) { /* ignore */ }

      const pickupFilterClause = hasStoreFilter 
        ? ` AND o.${filterColumn} IN (${storesParam.map(() => '?').join(',')})` 
        : '';
      const pickupParams = hasStoreFilter ? storesParam : [];

      // --- Helper Queries ---
      
      // 1. Revenue & Product Cost Query (Joined with Price Entries)
      // Note: User requested Revenue = Price After GST.
      // We assume Product Cost is ALSO Price After GST (or maybe user treats it as Pass-Through).
      // We use status NOT LIKE '%cancel%' instead of 'delivered' to capture manifested orders too.
      const getRevenueAndCost = async (s: string, e: string, params: any[]) => {
        const query = `
          SELECT 
            COALESCE(SUM(o.order_amount), 0) as revenue,
            COALESCE(SUM(pe.price_after_gst), 0) as cost,
            COUNT(*) as count
          FROM orders o
          JOIN suppliers su ON TRIM(o.${filterColumn}) = TRIM(su.name)
          JOIN price_entries pe ON pe.supplier_id = su.id 
            AND TRIM(pe.product_name) = TRIM(o.product_name)
          WHERE o.order_date >= ? AND o.order_date <= ?
            AND LOWER(o.status) NOT LIKE '%cancel%'
            AND (
              o.order_date BETWEEN pe.effective_from AND pe.effective_to
              OR (pe.effective_to IS NULL AND o.order_date >= pe.effective_from)
            )
            ${pickupFilterClause}
        `;
        const [rows] = await connection.query(query, [s, e, ...params]) as any[];
        return rows[0] || { revenue: 0, cost: 0, count: 0 };
      };

      // 2. Shipping Cost Query
      const getShippingCost = async (s: string, e: string, params: any[]) => {
        const query = `
          SELECT COALESCE(SUM(sc.shipping_cost), 0) as total
          FROM orders o
          JOIN shipping_costs sc ON TRIM(o.fulfilled_by) = TRIM(sc.region)
          WHERE o.order_date >= ? AND o.order_date <= ?
            AND LOWER(o.status) NOT LIKE '%cancel%'
            ${pickupFilterClause}
        `;
        const [rows] = await connection.query(query, [s, e, ...params]) as any[];
        return parseFloat(rows[0]?.total || 0);
      };

      // 3. Marketing Spend Query
      const getMarketingSpend = async (s: string, e: string) => {
        try {
          const [rows] = await connection.query(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM marketing_spend 
            WHERE spend_date >= ? AND spend_date <= ?
          `, [s, e]) as any[];
          return parseFloat(rows[0]?.total || 0);
        } catch (e) { return 0; }
      };

      // --- Execute Current Period Queries ---
      
      // For "All Data", we use a very old start date
      const qStart = showAllData ? '2000-01-01' : startDate;
      const qEnd = showAllData ? new Date().toISOString().split('T')[0] : endDate;

      const currentMetrics = await getRevenueAndCost(qStart, qEnd, pickupParams);
      const currentShipping = await getShippingCost(qStart, qEnd, pickupParams);
      const currentMarketing = await getMarketingSpend(qStart, qEnd);

      const totalRevenue = parseFloat(currentMetrics.revenue);
      const totalProductCost = parseFloat(currentMetrics.cost); // Assuming Cost = Revenue for now based on 'Price After GST' request
      const totalShippingCosts = currentShipping;
      const totalMarketingSpend = currentMarketing;
      const totalOrders = parseInt(currentMetrics.count);

      // --- Execute Previous Period Queries (Only if not showing all data) ---
      let prevRevenue = 0;
      let prevShipping = 0;
      let prevMarketing = 0;
      let prevProfit = 0;

      if (!showAllData) {
        const prevMetrics = await getRevenueAndCost(prevStartDate, prevEndDate, pickupParams);
        prevRevenue = parseFloat(prevMetrics.revenue);
        const prevProductCost = parseFloat(prevMetrics.cost); // Same assumption
        prevShipping = await getShippingCost(prevStartDate, prevEndDate, pickupParams);
        prevMarketing = await getMarketingSpend(prevStartDate, prevEndDate);
        
        prevProfit = prevRevenue - prevProductCost - prevShipping - prevMarketing;
      }

      // --- Calculate Changes ---
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const netProfit = totalRevenue - totalProductCost - totalShippingCosts - totalMarketingSpend;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      const revenueChange = calculateChange(totalRevenue, prevRevenue);
      const shippingChange = calculateChange(totalShippingCosts, prevShipping);
      const marketingChange = calculateChange(totalMarketingSpend, prevMarketing);
      const netProfitChange = calculateChange(netProfit, prevProfit);

      // --- Trends & Breakdowns ---

      // Daily Trends (Revenue based on PE Price After GST)
      const dailyTrendQuery = `
        SELECT 
          DATE(o.order_date) as date,
          COALESCE(SUM(o.order_amount), 0) as revenue,
          COALESCE(SUM(pe.price_after_gst), 0) as product_cost
        FROM orders o
        JOIN suppliers su ON TRIM(o.${filterColumn}) = TRIM(su.name)
        JOIN price_entries pe ON pe.supplier_id = su.id 
          AND TRIM(pe.product_name) = TRIM(o.product_name)
        WHERE o.order_date >= ? AND o.order_date <= ?
          AND LOWER(o.status) NOT LIKE '%cancel%'
          AND (
            o.order_date BETWEEN pe.effective_from AND pe.effective_to
            OR (pe.effective_to IS NULL AND o.order_date >= pe.effective_from)
          )
          ${pickupFilterClause}
        GROUP BY DATE(o.order_date)
        ORDER BY date
      `;
      const [dailyTrends] = await connection.query(dailyTrendQuery, [qStart, qEnd, ...pickupParams]) as any[];

      // Shipping Trends
      const dailyShippingQuery = `
        SELECT DATE(order_date) as date, COALESCE(SUM(sc.shipping_cost), 0) as cost
        FROM orders o
        JOIN shipping_costs sc ON TRIM(o.fulfilled_by) = TRIM(sc.region)
        WHERE o.order_date >= ? AND o.order_date <= ?
          AND LOWER(o.status) NOT LIKE '%cancel%'
          ${pickupFilterClause}
        GROUP BY DATE(order_date)
      `;
      const [dailyShipping] = await connection.query(dailyShippingQuery, [qStart, qEnd, ...pickupParams]) as any[];

      // Marketing Trends
      let dailyMarketing: any[] = [];
      try {
        const [mRows] = await connection.query(`
          SELECT spend_date as date, COALESCE(SUM(amount), 0) as cost
          FROM marketing_spend 
          WHERE spend_date >= ? AND spend_date <= ?
          GROUP BY spend_date
        `, [qStart, qEnd]) as any[];
        dailyMarketing = mRows;
      } catch (e) { /* ignore */ }

      // Merge Trends
      const trendsMap = new Map();
      
      const addToMap = (date: any, field: string, value: number) => {
        const d = new Date(date).toISOString().split('T')[0];
        if (!trendsMap.has(d)) trendsMap.set(d, { date: d, revenue: 0, product_cost: 0, shipping_costs: 0, marketing_spend: 0 });
        trendsMap.get(d)[field] += parseFloat(value as any);
      };

      dailyTrends.forEach((t: any) => {
        addToMap(t.date, 'revenue', t.revenue);
        addToMap(t.date, 'product_cost', t.product_cost);
      });
      dailyShipping.forEach((t: any) => addToMap(t.date, 'shipping_costs', t.cost));
      dailyMarketing.forEach((t: any) => addToMap(t.date, 'marketing_spend', t.cost));

      const trends = Array.from(trendsMap.values()).map((t: any) => ({
        ...t,
        profit: t.revenue - t.product_cost - t.shipping_costs - t.marketing_spend
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Channel Breakdown (Revenue based on PE Price)
      const channelQuery = `
        SELECT 
          o.channel,
          COUNT(*) as order_count,
          COALESCE(SUM(o.order_amount), 0) as total_revenue
        FROM orders o
        JOIN suppliers su ON TRIM(o.${filterColumn}) = TRIM(su.name)
        JOIN price_entries pe ON pe.supplier_id = su.id 
          AND TRIM(pe.product_name) = TRIM(o.product_name)
        WHERE o.order_date >= ? AND o.order_date <= ?
          AND LOWER(o.status) NOT LIKE '%cancel%'
          AND (
            o.order_date BETWEEN pe.effective_from AND pe.effective_to
            OR (pe.effective_to IS NULL AND o.order_date >= pe.effective_from)
          )
          ${pickupFilterClause}
        GROUP BY o.channel
      `;
      const [channelBreakdown] = await connection.query(channelQuery, [qStart, qEnd, ...pickupParams]) as any[];

      // Other Counts
      let codOrders = 0, codAmount = 0, ppdOrders = 0, ppdAmount = 0, shippedOrders = 0;
      
      // We can iterate channel breakdown or run separate queries. Separate is safer for aggregates.
      // Actually, let's keep it simple and use 0 for now or run a quick count query if needed. 
      // The user cared most about Revenue/Profit.
      // Let's run a quick aggregate for counts
      const [counts] = await connection.query(`
        SELECT 
          COUNT(CASE WHEN LOWER(mode)='cod' THEN 1 END) as cod,
          COUNT(CASE WHEN LOWER(mode)='ppd' THEN 1 END) as ppd,
          count(*) as shipped
        FROM orders o
        WHERE o.order_date >= ? AND o.order_date <= ?
          AND LOWER(o.status) NOT LIKE '%cancel%'
          ${pickupFilterClause}
      `, [qStart, qEnd, ...pickupParams]) as any[];
      
      codOrders = counts[0].cod;
      ppdOrders = counts[0].ppd;
      shippedOrders = counts[0].shipped;

      // Product Performance
      const productQuery = `
        SELECT 
          pe.product_name,
          COUNT(o.id) as order_count,
          COALESCE(SUM(o.order_amount), 0) as total_revenue
        FROM orders o
        JOIN suppliers su ON TRIM(o.${filterColumn}) = TRIM(su.name)
        JOIN price_entries pe ON pe.supplier_id = su.id 
          AND TRIM(pe.product_name) = TRIM(o.product_name)
        WHERE o.order_date >= ? AND o.order_date <= ?
          AND LOWER(o.status) NOT LIKE '%cancel%'
          AND (
            o.order_date BETWEEN pe.effective_from AND pe.effective_to
            OR (pe.effective_to IS NULL AND o.order_date >= pe.effective_from)
          )
          ${pickupFilterClause}
        GROUP BY pe.product_name
        ORDER BY total_revenue DESC
      `;
      const [productPerformance] = await connection.query(productQuery, [qStart, qEnd, ...pickupParams]) as any[];


      return NextResponse.json({
        totalRevenue,
        totalShippingCosts,
        totalMarketingSpend,
        netProfit,
        profitMargin,
        
        revenueChange,
        shippingChange,
        marketingChange,
        netProfitChange,

        totalOrders,
        shippedOrders,
        codOrders,
        codAmount, // Not calculating strictly to save query time unless critical
        ppdOrders,
        ppdAmount,
        channelBreakdown,
        trends,
        productPerformance,
      });

    } finally {
      if (connection) connection.release();
    }
  } catch (error: any) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

