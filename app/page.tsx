"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Truck,
  Target,
  Calendar,
  Download,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import * as XLSX from "xlsx";

interface DashboardMetrics {
  totalRevenue: number;
  totalShippingCosts: number;
  totalMarketingSpend: number;
  netProfit: number;
  profitMargin: number;
  
  revenueChange: number;
  shippingChange: number;
  marketingChange: number;
  netProfitChange: number;

  totalOrders: number;
  shippedOrders: number;
  codOrders: number;
  codAmount: number;
  ppdOrders: number;
  ppdAmount: number;
  channelBreakdown: any[];
  trends: any[];
  productPerformance?: any[];
}

const MetricCard = ({
  title,
  value,
  change,
  icon: Icon,
  color,
  prefix = "",
  suffix = "",
}: {
  title: string;
  value: number;
  change?: number;
  icon: any;
  color: string;
  prefix?: string;
  suffix?: string;
}) => {
  const valueStr = typeof value === "number" ? value.toLocaleString() : String(value);
  const fullValue = `${prefix}${valueStr}${suffix}`;
  const isLongValue = fullValue.length > 12;
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <h3 className={`font-bold text-gray-900 mb-2 whitespace-nowrap overflow-hidden text-ellipsis ${isLongValue ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`} title={fullValue}>
            {prefix}{valueStr}{suffix}
          </h3>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {change >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />
              )}
              <span
                className={`text-sm font-medium ${
                  change >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {Math.abs(change).toFixed(1)}% {change >= 0 ? "increase" : "decrease"}
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [pickupWarehouses, setPickupWarehouses] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [showAllData, setShowAllData] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Build stores parameter for multiple selection
      const storesParam =
        selectedStores.length > 0
          ? selectedStores.map(s => `stores[]=${encodeURIComponent(s)}`).join('&')
          : "";
      const timestamp = new Date().getTime();
      const url = showAllData
        ? `/api/dashboard/metrics?t=${timestamp}${storesParam ? `&${storesParam}` : ""}`
        : `/api/dashboard/metrics?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}&t=${timestamp}${storesParam ? `&${storesParam}` : ""}`;
      
      console.log('Fetching metrics with URL:', url);
      console.log('Selected stores:', selectedStores);
      
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }
      const data = await response.json();
      console.log('Dashboard metrics received:', data);
      setMetrics(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!metrics) return;

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary Metrics
      const summaryData = [
        ["Metric", "Value"],
        ["Total Revenue", metrics.totalRevenue],
        ["Total Shipping Costs", metrics.totalShippingCosts],
        ["Total Marketing Spend", metrics.totalMarketingSpend],
        ["Net Profit", metrics.netProfit],
        ["Profit Margin (%)", metrics.profitMargin],
        ["Total Orders", metrics.totalOrders],
        ["Shipped Orders", metrics.shippedOrders],
        ["COD Orders", metrics.codOrders],
        ["COD Amount", metrics.codAmount],
        ["Prepaid Orders", metrics.ppdOrders],
        ["Prepaid Amount", metrics.ppdAmount],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

      // Sheet 2: Daily Trends
      if (metrics.trends && metrics.trends.length > 0) {
        const trendsData = metrics.trends.map((t: any) => ({
          Date: t.date,
          Revenue: t.revenue,
          "Product Cost": t.product_cost || 0,
          "Shipping Cost": t.shipping_costs,
          "Marketing Spend": t.marketing_spend,
          Profit: t.profit,
        }));
        const trendsSheet = XLSX.utils.json_to_sheet(trendsData);
        XLSX.utils.book_append_sheet(wb, trendsSheet, "Daily Trends");
      }

      // Sheet 3: Channel Breakdown
      if (metrics.channelBreakdown && metrics.channelBreakdown.length > 0) {
        const channelData = metrics.channelBreakdown.map((c: any) => ({
          Channel: c.channel,
          "Order Count": c.order_count,
          Revenue: c.total_revenue,
        }));
        const channelSheet = XLSX.utils.json_to_sheet(channelData);
        XLSX.utils.book_append_sheet(wb, channelSheet, "Channel Breakdown");
      }

      // Sheet 4: Product Performance
      if (metrics.productPerformance && metrics.productPerformance.length > 0) {
        const productData = metrics.productPerformance.map((p: any) => ({
          "Product Name": p.product_name,
          "Order Count": p.order_count,
          "Revenue": p.total_revenue,
        }));
        const productSheet = XLSX.utils.json_to_sheet(productData);
        XLSX.utils.book_append_sheet(wb, productSheet, "Product Performance");
      }

      // Generate filename
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `dashboard_export_${dateStr}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);

      toast({
        title: "Export Successful",
        description: "Dashboard data exported to Excel",
      });
    } catch (error: any) {
      console.error("Export failed:", error);
      toast({
        title: "Export Failed",
        description: "Could not generate Excel file",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate, showAllData, selectedStores, status]);

  // Fetch pickup warehouses once
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch("/api/pickup-warehouses");
        if (!res.ok) throw new Error("Failed to load stores");
        const data = await res.json();
        setPickupWarehouses(data.warehouses || []);
      } catch (err) {
        console.error("Failed to fetch stores", err);
      }
    };
    fetchWarehouses();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.store-dropdown-container')) {
        setStoreDropdownOpen(false);
      }
    };

    if (storeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [storeDropdownOpen]);

  if (status === "loading" || (loading && !metrics)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  // Prepare chart data from API
  const trendData = metrics?.trends?.map((trend) => ({
    month: new Date(trend.date).toLocaleDateString("en-US", { month: "short" }),
    revenue: trend.revenue || 0,
    costs: (trend.shipping_costs || 0) + (trend.marketing_spend || 0),
    profit: trend.profit || 0,
  })) || [];

  // Prepare channel data
  const channelData =
    metrics?.channelBreakdown?.map((channel, index) => {
      const colors = ["#FF9900", "#96BF48", "#E53238", "#3B82F6", "#8B5CF6"];
      return {
        name: channel.channel || "Unknown",
        value: parseFloat(channel.total_revenue || 0),
        color: colors[index % colors.length],
      };
    }) || [];

  // Use totalOrders from API (based on Channel Order Date)
  const totalOrders = metrics?.totalOrders || 0;
  const shippedOrders = metrics?.shippedOrders || 0;
  const codOrders = metrics?.codOrders || 0;
  const codAmount = metrics?.codAmount || 0;
  const ppdOrders = metrics?.ppdOrders || 0;
  const ppdAmount = metrics?.ppdAmount || 0;

  // Calculate average order value based on delivered orders
  const deliveredOrderCount =
    metrics?.channelBreakdown?.reduce(
      (sum, channel) => sum + (parseInt(channel.order_count) || 0),
      0
    ) || 0;
  const avgOrderValue =
    deliveredOrderCount > 0 && metrics
      ? metrics.totalRevenue / deliveredOrderCount
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Page Heading */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Dashboard Overview
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Track your profits and optimize your business
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={loading || !metrics}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Date Range Selector */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-900">Date Range:</span>
            </div>
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <button
                onClick={() => {
                  setShowAllData(!showAllData);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showAllData
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                {showAllData ? "All Data" : "Select Range"}
              </button>
              {!showAllData && (
                <>
                  <div className="flex-1 min-w-[150px] max-w-xs">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) =>
                        setDateRange({ ...dateRange, startDate: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="text-gray-400 self-end mb-2">→</div>
                  <div className="flex-1 min-w-[150px] max-w-xs">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) =>
                        setDateRange({ ...dateRange, endDate: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}
              {showAllData && (
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm text-gray-600">
                    Showing all data (no date filter applied)
                  </p>
                </div>
              )}
              <div className="flex-1 min-w-[200px] max-w-xs relative store-dropdown-container">
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Store
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors"
                  >
                    <span className="text-sm text-gray-700">
                      {selectedStores.length === 0
                        ? "All Stores"
                        : selectedStores.length === 1
                        ? selectedStores[0]
                        : `${selectedStores.length} stores selected`}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${
                        storeDropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {storeDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {pickupWarehouses.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          Loading stores...
                        </div>
                      ) : (
                        <>
                          <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600">
                              Select stores
                            </span>
                            {selectedStores.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStores([]);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                          {pickupWarehouses.filter(wh => wh !== "all").map((store) => (
                            <label
                              key={store}
                              className="flex items-center px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedStores.includes(store)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStores([...selectedStores, store]);
                                  } else {
                                    setSelectedStores(
                                      selectedStores.filter((s) => s !== store)
                                    );
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="ml-3 text-sm text-gray-700 flex-1 truncate">
                                {store}
                              </span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={fetchMetrics}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {metrics && (
          <>
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Total Revenue"
                value={metrics.totalRevenue}
                change={metrics.revenueChange}
                icon={IndianRupee}
                color="bg-gradient-to-br from-green-500 to-green-600"
                prefix="₹"
              />
              <MetricCard
                title="Shipping Costs"
                value={metrics.totalShippingCosts}
                change={metrics.shippingChange}
                icon={Truck}
                color="bg-gradient-to-br from-orange-500 to-orange-600"
                prefix="₹"
              />
              <MetricCard
                title="Marketing Spend"
                value={metrics.totalMarketingSpend}
                change={metrics.marketingChange}
                icon={Target}
                color="bg-gradient-to-br from-purple-500 to-purple-600"
                prefix="₹"
              />
              <MetricCard
                title="Net Profit"
                value={metrics.netProfit}
                change={metrics.netProfitChange}
                icon={IndianRupee}
                color="bg-gradient-to-br from-blue-500 to-blue-600"
                prefix="₹"
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Revenue Trend */}
              <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Revenue & Profit Trend
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Performance overview
                    </p>
                  </div>
                </div>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient
                          id="colorRevenue"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient
                          id="colorProfit"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="month"
                        stroke="#6B7280"
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis stroke="#6B7280" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3B82F6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="#10B981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorProfit)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available for the selected date range
                  </div>
                )}
              </div>

              {/* Channel Distribution */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Sales by Channel
                </h2>
                <p className="text-sm text-gray-600 mb-6">Revenue distribution</p>
                {channelData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={channelData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {channelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {channelData.map((channel, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: channel.color }}
                            ></div>
                            <span className="text-sm font-medium text-gray-700">
                              {channel.name}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-gray-900">
                            ${channel.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm">
                    No channel data available
                  </div>
                )}
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Channel Breakdown Bar Chart */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Channel Performance
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Revenue by sales channel
                </p>
                {metrics.channelBreakdown && metrics.channelBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.channelBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="channel"
                        stroke="#6B7280"
                        style={{ fontSize: "11px" }}
                      />
                      <YAxis stroke="#6B7280" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="total_revenue"
                        fill="#3B82F6"
                        radius={[8, 8, 0, 0]}
                        name="Revenue"
                      />
                      <Bar
                        dataKey="order_count"
                        fill="#10B981"
                        radius={[8, 8, 0, 0]}
                        name="Orders"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No channel data available
                  </div>
                )}
              </div>

              {/* Summary Stats */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Performance Summary
                </h2>
                <p className="text-sm text-gray-600 mb-6">Key metrics at a glance</p>

                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Profit Margin
                      </span>
                      <span className="text-2xl font-bold text-green-600">
                        {metrics.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(metrics.profitMargin, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Total Orders
                      </span>
                      <span className="text-2xl font-bold text-blue-600">
                        {totalOrders}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Based on Channel Order Date
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Shipped Orders
                      </span>
                      <span className="text-2xl font-bold text-teal-600">
                        {shippedOrders}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Excluding cancelled orders
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        COD Orders
                      </span>
                      <div className="text-right">
                        <span className="block text-2xl font-bold text-amber-600">
                          {codOrders}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100">
                     <div className="flex items-center justify-between">
                       <span className="text-sm font-medium text-gray-700">
                         Cost Ratio
                       </span>
                       <span className="text-2xl font-bold text-orange-600">
                         {metrics.totalRevenue > 0
                           ? (
                               ((metrics.totalShippingCosts +
                                 metrics.totalMarketingSpend) /
                                 metrics.totalRevenue) *
                               100
                             ).toFixed(1)
                           : 0}
                         %
                       </span>
                     </div>
                     <p className="text-xs text-gray-600 mt-1">
                       Shipping + Marketing costs
                     </p>
                   </div>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
