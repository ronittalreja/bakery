"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3, 
  PieChart,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Package,
  Sparkles,
  Calculator
} from "lucide-react";

interface InsightsData {
  month: string;
  totalSales: number;
  productMRPTotal?: number;
  decorationMRPTotal?: number;
  productCostTotal?: number;
  decorationCostTotal?: number;
  totalCost?: number;
  productProfit?: number;
  decorationProfit?: number;
  totalProfit?: number;
  productMargin?: number;
  decorationMargin?: number;
  totalMargin?: number;
  totalLoss: number;
  totalExpenses: number;
}

interface InsightsPageProps {
  onBack: () => void;
}

export function InsightsPage({ onBack }: InsightsPageProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      setError("");
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        console.log('Fetching insights for month:', selectedMonth);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/insights/monthly/${selectedMonth}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        console.log('Insights API response:', data);
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch insights');
        }
        
        setInsights(data.data);
      } catch (err: any) {
        console.error('Error fetching insights:', err.message);
        setError(err.message || 'Failed to load insights');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [selectedMonth]);

  const formatCurrency = (amount: number | undefined) => `₹${(amount || 0).toLocaleString()}`;
  const formatPercentage = (value: number | undefined) => `${(value || 0).toFixed(1)}%`;

  const getProfitColor = (profit: number) => {
    if (profit > 0) return "text-green-600";
    if (profit < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getProfitIcon = (profit: number) => {
    if (profit > 0) return <TrendingUp className="h-4 w-4" />;
    if (profit < 0) return <TrendingDown className="h-4 w-4" />;
    return <BarChart3 className="h-4 w-4" />;
  };

  const getProfitBadgeVariant = (profit: number) => {
    if (profit > 0) return "default";
    if (profit < 0) return "destructive";
    return "secondary";
  };

  return (
    <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Target className="h-5 w-5 sm:h-6 sm:w-6" />
                Business Insights
              </h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">
                Comprehensive financial analysis and performance metrics for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-sm font-medium text-slate-700">Month:</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 w-full sm:w-[160px] bg-white border-slate-300 focus:border-slate-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500 mx-auto"></div>
            <p className="mt-2 text-slate-600">Loading insights...</p>
          </div>
        ) : insights ? (
          <>
            {/* Overall Summary - Moved to Top */}
            <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Calculator className="h-5 w-5 text-green-600" />
                  Overall Business Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <div className="text-sm font-medium text-slate-600">Total MRP</div>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatCurrency(insights.totalSales)}
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <div className="text-sm font-medium text-slate-600">Total Cost</div>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatCurrency(insights.totalCost)}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <div className="text-sm font-medium text-slate-600">Total Loss</div>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatCurrency(insights.totalLoss)}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-orange-600" />
                      <div className="text-sm font-medium text-slate-600">Total Expenses</div>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatCurrency(insights.totalExpenses)}
                    </div>
                  </div>
                </div>

                {/* Net Profit */}
                <div className="mt-6 bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-700 mb-1">Net Profit</div>
                      <div className="text-3xl font-bold text-green-900">
                        {formatCurrency(insights.totalProfit)}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="default" className="bg-green-600 text-white text-lg px-4 py-2">
                        {formatPercentage(insights.totalMargin)} margin
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Tracking Overview - Moved Below */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Products Section */}
              <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Package className="h-5 w-5 text-blue-600" />
                    Products Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="text-sm font-medium text-slate-600 mb-1">MRP Total</div>
                      <div className="text-xl font-bold text-slate-900">
                        {formatCurrency(insights.productMRPTotal)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="text-sm font-medium text-slate-600 mb-1">Cost Total</div>
                      <div className="text-xl font-bold text-slate-900">
                        {formatCurrency(insights.productCostTotal)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-blue-700 mb-1">Product Profit</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {formatCurrency(insights.productProfit)}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default" className="bg-blue-600 text-white">
                          {formatPercentage(insights.productMargin)} margin
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Decorations Section */}
              <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Decorations Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="text-sm font-medium text-slate-600 mb-1">MRP Total</div>
                      <div className="text-xl font-bold text-slate-900">
                        {formatCurrency(insights.decorationMRPTotal)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="text-sm font-medium text-slate-600 mb-1">Cost Total</div>
                      <div className="text-xl font-bold text-slate-900">
                        {formatCurrency(insights.decorationCostTotal)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-purple-700 mb-1">Decoration Profit</div>
                        <div className="text-2xl font-bold text-purple-900">
                          {formatCurrency(insights.decorationProfit)}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default" className="bg-purple-600 text-white">
                          {formatPercentage(insights.decorationMargin)} margin
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>



          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No insights data available for the selected month.</p>
          </div>
        )}
      </div>
    </main>
  );
}