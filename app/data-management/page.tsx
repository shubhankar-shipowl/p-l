"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Database, 
  Package, 
  TrendingUp, 
  Calendar, 
  Upload, 
  Trash2, 
  Download, 
  RefreshCw, 
  BarChart3,
  Truck,
  Tag,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type DataStats = {
  orders: {
    count: number;
    latestUpload: string | null;
    oldestOrder: string | null;
    newestOrder: string | null;
  };
  shippingCosts: {
    count: number;
    latestUpload: string | null;
  };
  marketingSpend: {
    count: number;
    latestUpload: string | null;
    totalAmount: number;
  };
  priceEntries: {
    count: number;
    latestUpload: string | null;
    suppliers: number;
  };
};

type ConfirmState = {
  isOpen: boolean;
  dataType: string;
  title: string;
  message: string;
};

export default function DataManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    dataType: "",
    title: "",
    message: "",
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/data-stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDelete = async (dataType: string, displayName: string, count: number) => {
    setConfirmState({
      isOpen: true,
      dataType,
      title: "Delete Confirmation",
      message: `Are you sure you want to delete all ${count.toLocaleString()} ${displayName} records? This action cannot be undone and will permanently remove all data.`,
    });
  };

  const confirmDelete = async () => {
    const { dataType } = confirmState;
    setDeleting(dataType);
    try {
      const endpoints: Record<string, string> = {
        orders: "/api/orders/delete-all",
        shippingCosts: "/api/shipping-costs/delete-all",
        marketingSpend: "/api/marketing-spend/delete-all",
        priceEntries: "/api/price-entries/delete-all",
      };

      const response = await fetch(endpoints[dataType], {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message || `Data deleted successfully`,
        });
        fetchStats(); // Refresh stats
      } else {
        throw new Error(result.error || "Failed to delete data");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete data",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const calculateDaysDiff = (start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getTotalRecords = () => {
    if (!stats) return 0;
    return stats.orders.count + stats.shippingCosts.count + stats.marketingSpend.count + stats.priceEntries.count;
  };

  const getLatestUpload = () => {
    if (!stats) return null;
    const dates = [
      stats.orders.latestUpload,
      stats.shippingCosts.latestUpload,
      stats.marketingSpend.latestUpload,
      stats.priceEntries.latestUpload
    ].filter(d => d !== null);
    
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map(d => new Date(d!).getTime())));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading data statistics...</p>
        </div>
      </div>
    );
  }

  const latestUpload = getLatestUpload();
  const daysDiff = calculateDaysDiff(stats?.orders.oldestOrder || null, stats?.orders.newestOrder || null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmDelete}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Database className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Data Management</h1>
                <p className="text-slate-500 mt-1">View upload history and manage your data</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-sm text-slate-500 mb-1">Total Records</div>
            <div className="text-3xl font-bold text-slate-800">{getTotalRecords().toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-2">Across all data types</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-purple-600" />
              </div>
              <Calendar className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-sm text-slate-500 mb-1">Latest Upload</div>
            <div className="text-lg font-semibold text-slate-800">
              {latestUpload ? formatDate(latestUpload.toISOString()) : "N/A"}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {latestUpload ? formatDateTime(latestUpload.toISOString()) : ""}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
              <BarChart3 className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-sm text-slate-500 mb-1">Date Range</div>
            <div className="text-sm font-semibold text-slate-800">{formatDate(stats?.orders.oldestOrder || null)}</div>
            <div className="text-sm font-semibold text-slate-800">{formatDate(stats?.orders.newestOrder || null)}</div>
          </div>
        </div>

        {/* Orders Data Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Orders Data</h2>
                  <p className="text-blue-100 text-sm">Manage your order records</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={fetchStats}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="text-sm font-medium text-slate-600 mb-2">Total Records</div>
                <div className="text-4xl font-bold text-slate-800">{stats?.orders.count.toLocaleString()}</div>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                <div className="text-sm font-medium text-slate-600 mb-2">Latest Upload</div>
                <div className="text-2xl font-bold text-slate-800">{formatDate(stats?.orders.latestUpload || null)}</div>
                <div className="text-sm text-slate-500 mt-1">{formatDateTime(stats?.orders.latestUpload || null)}</div>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                <div className="text-sm font-medium text-slate-600 mb-2">Date Range</div>
                <div className="text-sm font-semibold text-slate-800">
                  {formatDate(stats?.orders.oldestOrder || null)} - {formatDate(stats?.orders.newestOrder || null)}
                </div>
                <div className="text-sm text-slate-500 mt-1">{daysDiff} days</div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => handleDelete("orders", "orders", stats?.orders.count || 0)}
                disabled={deleting === "orders" || stats?.orders.count === 0}
                className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {deleting === "orders" ? "Deleting..." : "Delete All Orders"}
              </button>
            </div>
          </div>
        </div>

        {/* Shipping Costs Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Shipping Costs</h2>
                  <p className="text-purple-100 text-sm">Manage shipping cost data</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={fetchStats}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="p-8">
            {stats?.shippingCosts.count === 0 ? (
              <div className="text-center text-slate-500 py-12">
                <Truck className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>No shipping costs data available</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <div className="text-sm font-medium text-slate-600 mb-2">Total Records</div>
                    <div className="text-4xl font-bold text-slate-800">{stats?.shippingCosts.count.toLocaleString()}</div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="text-sm font-medium text-slate-600 mb-2">Latest Upload</div>
                    <div className="text-2xl font-bold text-slate-800">{formatDate(stats?.shippingCosts.latestUpload || null)}</div>
                    <div className="text-sm text-slate-500 mt-1">{formatDateTime(stats?.shippingCosts.latestUpload || null)}</div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => handleDelete("shippingCosts", "shipping costs", stats?.shippingCosts.count || 0)}
                    disabled={deleting === "shippingCosts" || stats?.shippingCosts.count === 0}
                    className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {deleting === "shippingCosts" ? "Deleting..." : "Delete All Shipping Costs"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Marketing Spend Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Marketing Spend</h2>
                  <p className="text-green-100 text-sm">Track your marketing investments</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={fetchStats}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="p-8">
            {stats?.marketingSpend.count === 0 ? (
              <div className="text-center text-slate-500 py-12">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>No marketing spend data available</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                    <div className="text-sm font-medium text-slate-600 mb-2">Total Records</div>
                    <div className="text-4xl font-bold text-slate-800">{stats?.marketingSpend.count.toLocaleString()}</div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="text-sm font-medium text-slate-600 mb-2">Total Amount</div>
                    <div className="text-3xl font-bold text-slate-800">₹{stats?.marketingSpend.totalAmount.toLocaleString()}</div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <div className="text-sm font-medium text-slate-600 mb-2">Latest Upload</div>
                    <div className="text-2xl font-bold text-slate-800">{formatDate(stats?.marketingSpend.latestUpload || null)}</div>
                    <div className="text-sm text-slate-500 mt-1">{formatDateTime(stats?.marketingSpend.latestUpload || null)}</div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => handleDelete("marketingSpend", "marketing spend", stats?.marketingSpend.count || 0)}
                    disabled={deleting === "marketingSpend" || stats?.marketingSpend.count === 0}
                    className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {deleting === "marketingSpend" ? "Deleting..." : "Delete All Marketing Spend"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Price & HSN Entries Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Tag className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Price & HSN Entries</h2>
                  <p className="text-orange-100 text-sm">Manage product pricing data</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={fetchStats}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="p-8">
            {stats?.priceEntries.count === 0 ? (
              <div className="text-center text-slate-500 py-12">
                <Tag className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>No price entries available</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-100">
                    <div className="text-sm font-medium text-slate-600 mb-2">Total Entries</div>
                    <div className="text-4xl font-bold text-slate-800">{stats?.priceEntries.count.toLocaleString()}</div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="text-sm font-medium text-slate-600 mb-2">Suppliers</div>
                    <div className="text-4xl font-bold text-slate-800">{stats?.priceEntries.suppliers.toLocaleString()}</div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <div className="text-sm font-medium text-slate-600 mb-2">Latest Upload</div>
                    <div className="text-2xl font-bold text-slate-800">{formatDate(stats?.priceEntries.latestUpload || null)}</div>
                    <div className="text-sm text-slate-500 mt-1">{formatDateTime(stats?.priceEntries.latestUpload || null)}</div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => handleDelete("priceEntries", "price entries", stats?.priceEntries.count || 0)}
                    disabled={deleting === "priceEntries" || stats?.priceEntries.count === 0}
                    className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {deleting === "priceEntries" ? "Deleting..." : "Delete All Price Entries"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
