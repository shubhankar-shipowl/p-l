"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Plus,
  Filter,
  Calendar,
  DollarSign,
  TrendingUp,
  Edit2,
  Trash2,
  X as XIcon,
  Target,
  ShoppingBag,
  Megaphone,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface MarketingSpend {
  id: number;
  spend_date: string;
  amount: number;
  channel: string | null;
  notes: string | null;
}

const channelColors: Record<string, string> = {
  "Google Ads": "#4285F4",
  Facebook: "#1877F2",
  Instagram: "#E4405F",
  "Email Marketing": "#34A853",
  LinkedIn: "#0A66C2",
  Twitter: "#1DA1F2",
  TikTok: "#000000",
  Other: "#6B7280",
};

export default function MarketingPage() {
  const { toast } = useToast();
  const [spends, setSpends] = useState<MarketingSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    channel: "",
  });
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    amount: "",
    channel: "",
    notes: "",
  });

  const fetchSpends = async () => {
    setLoading(true);
    try {
      let url = "/api/marketing-spend";
      const params = new URLSearchParams();
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch marketing spend");
      const data = await response.json();
      setSpends(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load marketing spend",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/marketing-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spend_date: formData.startDate, // store from-date as spend_date
          amount: parseFloat(formData.amount),
          channel: formData.channel || null,
          notes:
            formData.endDate
              ? `Period: ${formData.startDate || "-"} to ${formData.endDate || "-"}${
                  formData.notes ? ` | ${formData.notes}` : ""
                }`
              : formData.notes || null,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to add marketing spend");
      }
      toast({ title: "Success", description: "Marketing spend added successfully" });
      setFormData({ startDate: "", endDate: "", amount: "", channel: "", notes: "" });
      setShowModal(false);
      fetchSpends();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add marketing spend",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      const response = await fetch(`/api/marketing-spend/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete marketing spend");
      toast({ title: "Success", description: "Marketing spend deleted successfully" });
      fetchSpends();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete marketing spend",
        variant: "destructive",
      });
    }
  };

  // Derived data
  const totalSpend = useMemo(
    () => spends.reduce((sum, item) => sum + (item.amount || 0), 0),
    [spends]
  );
  const avgSpend = spends.length ? totalSpend / spends.length : 0;
  const channelCounts = useMemo(() => {
    const map: Record<string, number> = {};
    spends.forEach((s) => {
      const key = s.channel || "Other";
      map[key] = (map[key] || 0) + s.amount;
    });
    return map;
  }, [spends]);

  const channelData = Object.keys(channelCounts).map((key) => ({
    name: key,
    value: channelCounts[key],
    color: channelColors[key] || "#6B7280",
  }));

  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    spends.forEach((s) => {
      if (!s.spend_date) return;
      const d = new Date(s.spend_date);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      map.set(label, (map.get(label) || 0) + s.amount);
    });
    return Array.from(map.entries()).map(([month, spend]) => ({ month, spend }));
  }, [spends]);

  const filteredChannels = useMemo(() => {
    const set = new Set<string>();
    spends.forEach((s) => {
      if (s.channel) set.add(s.channel);
    });
    return Array.from(set);
  }, [spends]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50 pb-12">
      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        {/* Header */}
        <div className="sticky top-0 z-40 -mx-6 px-6 pb-4 bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Marketing Spend Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Track and manage your marketing expenses
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              Add Spend
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "Total Spend",
              value: totalSpend,
              subtitle: "+12.5% from last month",
              icon: DollarSign,
              color: "from-purple-500 to-purple-600",
              trend: "up",
            },
            {
              title: "Average Spend",
              value: avgSpend,
              subtitle: "Per campaign",
              icon: Target,
              color: "from-blue-500 to-blue-600",
            },
            {
              title: "Active Channels",
              value: filteredChannels.length || channelData.length,
              subtitle: "Marketing platforms",
              icon: Megaphone,
              color: "from-pink-500 to-pink-600",
            },
          ].map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <h3 className="text-3xl font-bold text-gray-900">
                    {card.title === "Active Channels"
                      ? card.value
                      : `₹${Math.round(card.value).toLocaleString()}`}
                  </h3>
                  <p className="text-xs text-gray-500">{card.subtitle}</p>
                  {card.trend && (
                    <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <TrendingUp className="w-4 h-4" /> 12.5% increase
                    </div>
                  )}
                </div>
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow`}
                >
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donut Chart */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Spend by Channel</h2>
                <p className="text-sm text-gray-600">Distribution across platforms</p>
              </div>
            </div>
            {channelData.length ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {channelData.map((channel, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: channel.color }}
                        />
                        <span className="text-sm font-medium text-gray-800">
                          {channel.name}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        ₹{channel.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>

          {/* Line Chart */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Spending Trend</h2>
                <p className="text-sm text-gray-600">Monthly marketing expenses</p>
              </div>
            </div>
            {trendData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                  <Line
                    type="monotone"
                    dataKey="spend"
                    stroke="#A855F7"
                    strokeWidth={3}
                    dot={{ fill: "#A855F7", r: 5 }}
                    activeDot={{ r: 7 }}
                    fillOpacity={1}
                    fill="url(#colorSpend)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-gray-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-gray-800">
            <Filter className="w-5 h-5 text-purple-600" />
            <span className="font-semibold">Filter Expenses</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                End Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Channel
              </label>
              <select
                value={filters.channel}
                onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              >
                <option value="">All Channels</option>
                {["Google Ads", "Facebook", "Instagram", "LinkedIn", "Twitter", "Email Marketing", "TikTok", "Other", ...filteredChannels]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ startDate: "", endDate: "", channel: "" })}
                className="w-full px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Marketing Spend History</h2>
              <p className="text-sm text-gray-600">Recent expenses</p>
            </div>
            <div className="text-sm text-gray-500">
              Total: <span className="font-semibold text-gray-900">₹{totalSpend.toLocaleString()}</span>
            </div>
          </div>
          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading...</div>
          ) : spends.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="text-sm">No marketing spend entries found</p>
              <button
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                onClick={() => setShowModal(true)}
              >
                Add your first entry →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Channel</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Notes</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {spends.map((spend) => (
                    <tr
                      key={spend.id}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2 text-gray-800">
                          <Calendar className="w-4 h-4 text-purple-500" />
                          {formatDate(spend.spend_date)}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">
                          {spend.channel || "Other"}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-gray-900">
                        {formatCurrency(spend.amount)}
                      </td>
                      <td className="py-3 text-gray-700">
                        {spend.notes || "-"}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"
                            aria-label="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 rounded-md hover:bg-red-50 text-red-600 transition-colors"
                            aria-label="Delete"
                            onClick={() => handleDelete(spend.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Add Marketing Spend</h3>
                <p className="text-sm text-white/80">Record a new marketing expense</p>
              </div>
              <button
                className="text-white/80 hover:text-white"
                onClick={() => setShowModal(false)}
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    From Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    To Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Channel</label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  <option value="">Select a channel</option>
                  {filteredChannels
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Campaign details, objectives, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add Spend"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

