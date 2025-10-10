// File: components/admin-sales-page.jsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, DollarSign, TrendingUp, Package, TrendingDown, Calendar, Star } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useDateContext } from "@/hooks/use-date-context";
import { formatDisplayDate, formatTime } from "@/lib/dateUtils";
import { Alert, AlertDescription } from "./ui/alert";

interface SaleItem {
  id: string;
  time: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  paymentMethod: string;
}

interface SalesAnalytics {
  current: {
    month: string;
    totalTransactions: number;
    totalSales: number;
    totalItems: number;
  };
  previous: {
    month: string;
    totalTransactions: number;
    totalSales: number;
    totalItems: number;
  };
  lastMonth: {
    month: string;
    totalTransactions: number;
    totalSales: number;
    totalItems: number;
  };
  growth: {
    revenue: number;
    transactions: number;
    items: number;
  };
  lastMonthGrowth: {
    revenue: number;
    transactions: number;
    items: number;
  };
  mostSoldItems: {
    productName: string;
    itemCode: string;
    totalQuantity: number;
    totalRevenue: number;
    transactionCount: number;
  }[];
}

interface YTDMTDData {
  currentYear: number;
  previousYear: number;
  ytd: {
    current: {
      totalTransactions: number;
      totalSales: number;
      totalItems: number;
      totalCost: number;
    };
    previous: {
      totalTransactions: number;
      totalSales: number;
      totalItems: number;
      totalCost: number;
    };
    growth: {
      revenue: number;
      transactions: number;
      items: number;
    };
  };
  mtd: {
    current: {
      totalTransactions: number;
      totalSales: number;
      totalItems: number;
      totalCost: number;
    };
    previous: {
      totalTransactions: number;
      totalSales: number;
      totalItems: number;
      totalCost: number;
    };
    growth: {
      revenue: number;
      transactions: number;
      items: number;
    };
  };
}

interface AdminSalesPageProps {
  onBack: () => void;
}

export function AdminSalesPage({ onBack }: AdminSalesPageProps) {
  const { selectedDate, setSelectedDate, setAdminMainDate } = useDateContext();
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [ytdMtdData, setYtdMtdData] = useState<YTDMTDData | null>(null);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [comparisonYear, setComparisonYear] = useState(new Date().getFullYear() - 1); // Previous year

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        console.log('Fetching sales for month:', selectedMonth);
        // Use month-wise sales endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sales/monthly/${selectedMonth}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        console.log('Sales API response:', data);
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch sales');
        }
        // data.data is array of sales with items[] each; flatten to item rows
        const rows: any[] = Array.isArray(data.data) ? data.data : [];
        console.log('Sales rows:', rows.length, 'items');
        const flattened: SaleItem[] = rows.flatMap((sale: any) => {
          const saleId = sale.id || sale.sale_id;
          const saleDate = sale.sale_date || selectedMonth;
          const timeStr = saleDate ? formatTime(saleDate) : '';
          const payment = sale.payment_type || sale.paymentType || '';
          const items = Array.isArray(sale.items) ? sale.items : [];
          return items.map((it: any, idx: number) => ({
            id: `${saleId}-${idx}`,
            time: timeStr,
            productName: it.name || '',
            quantity: Number(it.quantity || 0),
            price: Number(it.unit_price ?? it.unitPrice ?? 0),
            total: Number(it.total_price ?? it.totalPrice ?? 0),
            paymentMethod: payment,
          } as SaleItem));
        });
        console.log('Flattened sales:', flattened.length, 'items');
        setSales(flattened);
      } catch (err: any) {
        setError(err.message);
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        console.log('Fetching analytics for month:', selectedMonth, 'comparison year:', comparisonYear);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sales/analytics/monthly/${selectedMonth}/${comparisonYear}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        console.log('Analytics API response:', data);
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch analytics');
        }
        console.log('Analytics data:', data.data);
        console.log('Last month data:', data.data.lastMonth);
        setAnalytics(data.data);
      } catch (err: any) {
        console.error('Error fetching analytics:', err.message);
        // Don't show error for analytics as it's not critical
      }
    };

    const fetchYTDMTD = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        const currentYear = new Date().getFullYear();
        console.log('Fetching YTD MTD data for year:', currentYear);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sales/ytd-mtd/${currentYear}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        console.log('YTD MTD API response:', data);
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch YTD MTD data');
        }
        setYtdMtdData(data.data);
      } catch (err: any) {
        console.error('Error fetching YTD MTD data:', err.message);
        // Don't show error for YTD MTD as it's not critical
      }
    };

    fetchSales();
    fetchAnalytics();
    fetchYTDMTD();
  }, [selectedMonth, comparisonYear]);

  // Reset admin date back to today when leaving Admin Sales page
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    return () => {
      setSelectedDate(today);
      setAdminMainDate(today);
    };
  }, [setSelectedDate, setAdminMainDate]);

  const getPaymentMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case "cash":
        return "bg-green-100 text-green-800";
      case "hdfc":
        return "bg-blue-100 text-blue-800";
      case "gpay":
        return "bg-purple-100 text-purple-800";
      case "swiggy":
        return "bg-orange-100 text-orange-800";
      case "zomato":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalTransactions = sales.length;
  const totalItems = sales.reduce((sum, sale) => sum + sale.quantity, 0);
  const averageOrderValue = totalTransactions ? totalRevenue / totalTransactions : 0;
  
  console.log('Sales calculations:', {
    totalRevenue,
    totalTransactions,
    totalItems,
    averageOrderValue,
    salesLength: sales.length
  });

  const paymentMethodTotals = sales.reduce(
    (acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.total;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Sales Summary - Admin View
              </h1>
              <p className="text-slate-600 mt-1">
                Complete sales overview with financial totals and analytics for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Month:</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 w-[160px] bg-white border-slate-300 focus:border-slate-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <div className="text-sm font-medium text-slate-600">Total Revenue</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">₹{totalRevenue.toLocaleString()}</div>
            {analytics && analytics.lastMonth && (
              <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                <span>vs Last Month:</span>
                <span className="font-medium">₹{analytics.lastMonth.totalSales.toLocaleString()}</span>
                <div className={`flex items-center gap-1 ${
                  analytics.lastMonthGrowth.revenue > 0 ? 'text-green-600' : analytics.lastMonthGrowth.revenue < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {analytics.lastMonthGrowth.revenue > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : analytics.lastMonthGrowth.revenue < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3 opacity-50" />
                  )}
                  <span className="text-xs">{Math.abs(analytics.lastMonthGrowth.revenue)}%</span>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-green-600" />
              <div className="text-sm font-medium text-slate-600">Transactions</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalTransactions}</div>
            {analytics && analytics.lastMonth && (
              <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                <span>vs Last Month:</span>
                <span className="font-medium">{analytics.lastMonth.totalTransactions}</span>
                <div className={`flex items-center gap-1 ${
                  analytics.lastMonthGrowth.transactions > 0 ? 'text-green-600' : analytics.lastMonthGrowth.transactions < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {analytics.lastMonthGrowth.transactions > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : analytics.lastMonthGrowth.transactions < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3 opacity-50" />
                  )}
                  <span className="text-xs">{Math.abs(analytics.lastMonthGrowth.transactions)}%</span>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600" />
              <div className="text-sm font-medium text-slate-600">Items Sold</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalItems}</div>
            {analytics && analytics.lastMonth && (
              <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                <span>vs Last Month:</span>
                <span className="font-medium">{analytics.lastMonth.totalItems}</span>
                <div className={`flex items-center gap-1 ${
                  analytics.lastMonthGrowth.items > 0 ? 'text-green-600' : analytics.lastMonthGrowth.items < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {analytics.lastMonthGrowth.items > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : analytics.lastMonthGrowth.items < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3 opacity-50" />
                  )}
                  <span className="text-xs">{Math.abs(analytics.lastMonthGrowth.items)}%</span>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <div className="text-sm font-medium text-slate-600">Avg Order</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">
              ₹{Math.round(averageOrderValue)}
            </div>
            {analytics && analytics.lastMonth && (
              <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                <span>vs Last Month:</span>
                <span className="font-medium">₹{Math.round(analytics.lastMonth.totalSales / analytics.lastMonth.totalTransactions || 0)}</span>
                <div className={`flex items-center gap-1 ${
                  analytics.lastMonthGrowth.revenue > 0 ? 'text-green-600' : analytics.lastMonthGrowth.revenue < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {analytics.lastMonthGrowth.revenue > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : analytics.lastMonthGrowth.revenue < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3 opacity-50" />
                  )}
                  <span className="text-xs">{Math.abs(analytics.lastMonthGrowth.revenue)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Most Sold Items - Month View */}
        {analytics && analytics.mostSoldItems.length > 0 && (
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Star className="h-5 w-5" />
                Most Sold Items
              </h2>
              <p className="text-slate-600 mt-1">
                Top performing products for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {analytics.mostSoldItems.map((item, index) => (
                  <div
                    key={item.itemCode}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200 gap-3"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold text-blue-600 min-w-[30px]">
                        #{index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 truncate">{item.productName}</div>
                        <div className="text-sm text-slate-600">
                          {item.itemCode} • {item.transactionCount} transactions
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-slate-900">
                        {item.totalQuantity} units
                      </div>
                      <div className="text-sm text-slate-600">
                        ₹{item.totalRevenue.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Payment Method Breakdown</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(paymentMethodTotals).map(([method, total]) => ({
                        name: method,
                        amount: total,
                        count: sales.filter(sale => sale.paymentMethod === method).length
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {Object.entries(paymentMethodTotals).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Amount']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {Object.entries(paymentMethodTotals).map(([method, total], index) => (
                  <div key={method} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                      />
                      <span className="font-medium text-slate-900">{method}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">₹{total.toLocaleString()}</div>
                      <div className="text-sm text-slate-600">
                        {sales.filter(sale => sale.paymentMethod === method).length} transactions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* YTD and MTD Comparison */}
        {ytdMtdData && (
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                YTD & MTD Sales Comparison
              </h2>
              <p className="text-slate-600 mt-1">
                Comparing {ytdMtdData.currentYear} with {ytdMtdData.previousYear} performance
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* YTD Comparison */}
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Year-to-Date (YTD)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* YTD Revenue */}
                    <div className="text-center p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
                      <div className="text-sm text-slate-600 mb-2">Revenue</div>
                      <div className="text-xl font-bold text-slate-900 mb-1">
                        ₹{ytdMtdData.ytd.current.totalSales.toLocaleString()}
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        vs ₹{ytdMtdData.ytd.previous.totalSales.toLocaleString()}
                      </div>
                      <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                        ytdMtdData.ytd.growth.revenue > 0 ? 'text-green-600' : ytdMtdData.ytd.growth.revenue < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {ytdMtdData.ytd.growth.revenue > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : ytdMtdData.ytd.growth.revenue < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <span className="h-4 w-4">—</span>
                        )}
                        {Math.abs(ytdMtdData.ytd.growth.revenue)}%
                      </div>
                    </div>

                    {/* YTD Transactions */}
                    <div className="text-center p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
                      <div className="text-sm text-slate-600 mb-2">Transactions</div>
                      <div className="text-xl font-bold text-slate-900 mb-1">
                        {ytdMtdData.ytd.current.totalTransactions}
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        vs {ytdMtdData.ytd.previous.totalTransactions}
                      </div>
                      <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                        ytdMtdData.ytd.growth.transactions > 0 ? 'text-green-600' : ytdMtdData.ytd.growth.transactions < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {ytdMtdData.ytd.growth.transactions > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : ytdMtdData.ytd.growth.transactions < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <span className="h-4 w-4">—</span>
                        )}
                        {Math.abs(ytdMtdData.ytd.growth.transactions)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* MTD Comparison */}
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    Month-to-Date (MTD)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* MTD Revenue */}
                    <div className="text-center p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
                      <div className="text-sm text-slate-600 mb-2">Revenue</div>
                      <div className="text-xl font-bold text-slate-900 mb-1">
                        ₹{ytdMtdData.mtd.current.totalSales.toLocaleString()}
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        vs ₹{ytdMtdData.mtd.previous.totalSales.toLocaleString()}
                      </div>
                      <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                        ytdMtdData.mtd.growth.revenue > 0 ? 'text-green-600' : ytdMtdData.mtd.growth.revenue < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {ytdMtdData.mtd.growth.revenue > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : ytdMtdData.mtd.growth.revenue < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <span className="h-4 w-4">—</span>
                        )}
                        {Math.abs(ytdMtdData.mtd.growth.revenue)}%
                      </div>
                    </div>

                    {/* MTD Transactions */}
                    <div className="text-center p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
                      <div className="text-sm text-slate-600 mb-2">Transactions</div>
                      <div className="text-xl font-bold text-slate-900 mb-1">
                        {ytdMtdData.mtd.current.totalTransactions}
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        vs {ytdMtdData.mtd.previous.totalTransactions}
                      </div>
                      <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                        ytdMtdData.mtd.growth.transactions > 0 ? 'text-green-600' : ytdMtdData.mtd.growth.transactions < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {ytdMtdData.mtd.growth.transactions > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : ytdMtdData.mtd.growth.transactions < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <span className="h-4 w-4">—</span>
                        )}
                        {Math.abs(ytdMtdData.mtd.growth.transactions)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Year-over-Year Comparison */}
        {analytics && (
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
            <div className="p-6 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Year-over-Year Comparison
                  </h2>
                  <p className="text-slate-600 mt-1">
                    Comparing {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} with {new Date(analytics.previous.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Compare Year:</label>
                  <select
                    value={comparisonYear}
                    onChange={(e) => setComparisonYear(Number(e.target.value))}
                    className="h-9 px-3 py-1 border border-slate-300 bg-white rounded-md text-sm focus:border-slate-500"
                  >
                    {Array.from({ length: 3 }, (_, i) => {
                      const year = new Date().getFullYear() - 1 - i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Revenue Comparison */}
                <div className="text-center p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
                  <div className="text-sm text-slate-600 mb-2">Revenue</div>
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    ₹{analytics.current.totalSales.toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    vs ₹{analytics.previous.totalSales.toLocaleString()}
                  </div>
                  <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                    analytics.growth.revenue > 0 ? 'text-green-600' : analytics.growth.revenue < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {analytics.growth.revenue > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : analytics.growth.revenue < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <span className="h-4 w-4">—</span>
                    )}
                    {Math.abs(analytics.growth.revenue)}%
                  </div>
                </div>

                {/* Transactions Comparison */}
                <div className="text-center p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
                  <div className="text-sm text-slate-600 mb-2">Transactions</div>
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {analytics.current.totalTransactions}
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    vs {analytics.previous.totalTransactions}
                  </div>
                  <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                    analytics.growth.transactions > 0 ? 'text-green-600' : analytics.growth.transactions < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {analytics.growth.transactions > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : analytics.growth.transactions < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <span className="h-4 w-4">—</span>
                    )}
                    {Math.abs(analytics.growth.transactions)}%
                  </div>
                </div>

                {/* Items Comparison */}
                <div className="text-center p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
                  <div className="text-sm text-slate-600 mb-2">Items Sold</div>
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {analytics.current.totalItems}
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    vs {analytics.previous.totalItems}
                  </div>
                  <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                    analytics.growth.items > 0 ? 'text-green-600' : analytics.growth.items < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {analytics.growth.items > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : analytics.growth.items < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <span className="h-4 w-4">—</span>
                    )}
                    {Math.abs(analytics.growth.items)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}