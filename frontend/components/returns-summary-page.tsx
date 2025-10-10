// File: components/returns-summary-page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, TrendingDown, ArrowLeft, BarChart3, TrendingUp, Activity, AlertTriangle, DollarSign } from "lucide-react";
import { useDateContext } from "@/hooks/use-date-context";
import { formatDisplayDate, formatDate } from "@/lib/dateUtils";

interface ReturnItem {
  id: string;
  date: string;
  productName: string;
  quantity: number;
  reason: string;
  loss: number;
  itemCode?: string;
  category?: string;
  imageUrl?: string;
  invoiceReference?: string;
  invoiceDate?: string;
}

interface ReturnsSummaryPageProps {
  onBack: () => void;
}

export function ReturnsSummaryPage({ onBack }: ReturnsSummaryPageProps) {
  const formatDDMMYYYY = (date: any) => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const { selectedDate } = useDateContext();
  // Main tab state
  const [mainTab, setMainTab] = useState<'summary' | 'insider'>('summary');
  
  // Summary tab states (existing)
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [summary, setSummary] = useState({
    grm: { totalReturns: 0, totalQuantity: 0, totalLoss: 0 },
    gvn: { totalDamages: 0, totalQuantity: 0 }
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [customMonth, setCustomMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  // Insider tab states
  const [insiderDate, setInsiderDate] = useState(new Date().toISOString().split('T')[0]);
  const [grmAvailableItems, setGrmAvailableItems] = useState<any[]>([]);
  const [grmProcessedItems, setGrmProcessedItems] = useState<any[]>([]);
  const [insiderLoading, setInsiderLoading] = useState(false);
  const [insiderError, setInsiderError] = useState("");

  const fetchReturns = async (month: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("authToken");
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      // For monthly data, we'll fetch data for each day of the month and aggregate
      const [year, monthNum] = month.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      
      let allReturns: any[] = [];
      let monthlySummary = {
        grm: { totalReturns: 0, totalQuantity: 0, totalLoss: 0 },
        gvn: { totalDamages: 0, totalQuantity: 0 }
      };

      // Fetch data for each day of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${monthNum.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        try {
      const detailsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/details/${dateStr}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
          if (detailsResponse.ok) {
      const detailsData = await detailsResponse.json();
      
            if (detailsData.success) {
              // Add GRM data
              const grmItems = (detailsData.grm || []).map((item: any) => ({
                id: `${item.id}-${dateStr}`,
          date: item.date,
          productName: item.productName,
          quantity: item.quantity,
          reason: item.reason || 'GRM Return',
          loss: item.lossAmount,
          itemCode: item.itemCode,
          category: item.category,
          imageUrl: item.imageUrl,
          invoiceReference: item.invoiceReference,
          invoiceDate: item.invoiceDate
              }));

              // Add GVN data
              const gvnItems = (detailsData.gvn || []).map((item: any) => ({
                id: `${item.id}-${dateStr}`,
          date: item.date,
          productName: item.productName,
          quantity: item.quantity,
          reason: item.reason || 'GVN Damage',
          loss: item.lossAmount,
          itemCode: item.itemCode,
          category: item.category,
          imageUrl: item.imageUrl,
          invoiceReference: item.invoiceReference,
          invoiceDate: item.invoiceDate
              }));
      
              allReturns.push(...grmItems, ...gvnItems);
            }
          }
      
          // Fetch summary for the day
      const summaryResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/summary/${dateStr}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
            if (summaryData.grm) {
              monthlySummary.grm.totalReturns += summaryData.grm.totalReturns || 0;
              monthlySummary.grm.totalQuantity += summaryData.grm.totalQuantity || 0;
              monthlySummary.grm.totalLoss += summaryData.grm.totalLoss || 0;
            }
            if (summaryData.gvn) {
              monthlySummary.gvn.totalDamages += summaryData.gvn.totalDamages || 0;
              monthlySummary.gvn.totalQuantity += summaryData.gvn.totalQuantity || 0;
            }
          }
        } catch (dayError) {
          // Skip failed days and continue
          console.warn(`Failed to fetch data for ${dateStr}:`, dayError);
        }
      }

      // Group all monthly returns by product name to remove duplicates
      const monthlyGrouped = Object.values(
        allReturns.reduce((acc: any, item: any) => {
          const key = item.productName;
          
          if (acc[key]) {
            // Item already exists, add quantities and loss amounts
            acc[key].quantity += item.quantity;
            acc[key].loss += item.loss;
          } else {
            // New item
            acc[key] = { ...item };
          }
          
          return acc;
        }, {})
      );
      
      setReturns(monthlyGrouped);
      setSummary(monthlySummary);
      
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInsiderAnalysis = useCallback(async () => {
    setInsiderLoading(true);
    setInsiderError("");
    
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("authToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Fetch all items that expire on this date (available items)
      const availableResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/items-by-expiry/${insiderDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // Fetch processed GRM items that had expiry date = insiderDate (regardless of when processed)
      const processedResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/processed-by-expiry/${insiderDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!availableResponse.ok || !processedResponse.ok) {
        throw new Error(`Failed to fetch data: Available: ${availableResponse.status}, Processed: ${processedResponse.status}`);
      }

      const availableData = await availableResponse.json();
      const processedData = await processedResponse.json();
      console.log('Available items by expiry:', availableData);
      console.log('Processed GRM items by expiry:', processedData);

      // Process both available and processed items together
      let availableGrouped: any[] = [];
      let processedGrouped: any[] = [];

      // Process available items (items that expire on this date)
      if (availableData.success) {
        const availableItems = availableData.items || [];
        
        // Group available items by product name and sum quantities
        availableGrouped = Object.values(
          availableItems.reduce((acc: any, item: any) => {
            const key = item.productName;
            
            if (acc[key]) {
              // Item already exists, add quantities
              acc[key].availableQuantity += item.availableQuantity;
              acc[key].batchQuantity += item.batchQuantity;
            } else {
              // New item
              acc[key] = { ...item };
            }
            
            return acc;
          }, {})
        );
      }

      // Process processed items (items that were actually processed)
      if (processedData.success) {
        const processedItems = processedData.grm || [];
        
        // Group processed items by product name and sum quantities to remove duplicates
        processedGrouped = Object.values(
          processedItems.reduce((acc: any, item: any) => {
            const key = item.productName;
            
            if (acc[key]) {
              // Item already exists, add quantities and loss amounts
              acc[key].quantity += item.quantity;
              acc[key].lossAmount += item.lossAmount;
            } else {
              // New item
              acc[key] = { ...item };
            }
            
            return acc;
          }, {})
        );
      }

      // Calculate remaining quantity to process for each processed item
      const processedWithRemaining = processedGrouped.map((processedItem: any) => {
        // Find matching available item
        const availableItem = availableGrouped.find((avail: any) => avail.productName === processedItem.productName);
        const availableQty = availableItem ? availableItem.availableQuantity : 0;
        const processedQty = processedItem.quantity;
        const remainingQty = Math.max(0, availableQty - processedQty);
        
        return {
          ...processedItem,
          remainingQuantity: remainingQty
        };
      });
      
      // Set the state
      setGrmAvailableItems(availableGrouped);
      setGrmProcessedItems(processedWithRemaining);

    } catch (err: any) {
      console.error("Error fetching insider analysis:", err.message);
      setInsiderError(err.message || "Failed to load insider analysis");
      setGrmAvailableItems([]);
      setGrmProcessedItems([]);
    } finally {
      setInsiderLoading(false);
    }
  }, [insiderDate]);

  // Initialize with current month, then drive via customMonth
  useEffect(() => {
    if (mainTab === 'summary') {
      fetchReturns(customMonth);
    }
  }, [customMonth, mainTab]);

  // Auto-trigger insider analysis when date changes
  useEffect(() => {
    if (mainTab === 'insider') {
      fetchInsiderAnalysis();
    }
  }, [insiderDate, mainTab, fetchInsiderAnalysis]);

  // Reset month to current when leaving Returns Summary page
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return () => {
      setCustomMonth(currentMonth);
    };
  }, []);

  // Auto refresh happens on date change

  const totalReturns = returns.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate outliers and analytics
  const getOutliers = () => {
    const grmReturns = returns.filter(item => item.reason === 'GRM Return');
    return grmReturns
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5); // Top 5 most returned items
  };

  const getTopLossItems = () => {
    return returns
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 5); // Top 5 items with highest loss
  };

  const getReturnTrends = () => {
    const grmCount = returns.filter(item => item.reason === 'GRM Return').length;
    const gvnCount = returns.filter(item => item.reason === 'GVN Damage').length;
    const totalCount = grmCount + gvnCount;
    
    return {
      grmPercentage: totalCount > 0 ? ((grmCount / totalCount) * 100).toFixed(1) : 0,
      gvnPercentage: totalCount > 0 ? ((gvnCount / totalCount) * 100).toFixed(1) : 0,
      totalItems: totalCount
    };
  };

  const getProcessingEfficiency = () => {
    const availableCount = grmAvailableItems.length;
    const processedCount = grmProcessedItems.length;
    if (availableCount === 0) return 0;
    return Math.round((processedCount / availableCount) * 100);
  };

  const getQuantityEfficiency = () => {
    const availableQty = grmAvailableItems.reduce((sum: number, item: any) => sum + (item.availableQuantity || 0), 0);
    const processedQty = grmProcessedItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
    if (availableQty === 0) return 0;
    return Math.round((processedQty / availableQty) * 100);
  };

  const renderInsiderTab = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Selector */}
      <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Expiry Date Analysis
          </h2>
          <p className="text-slate-600 mt-1 text-sm">Select an expiry date to compare available vs processed items</p>
        </div>
        <div className="p-4 sm:p-6">
          <Input
            type="date"
            value={insiderDate}
            onChange={(e) => setInsiderDate(e.target.value)}
            className="w-full sm:w-fit bg-white border-slate-300 focus:border-slate-500"
          />
        </div>
      </div>

      {insiderError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{insiderError}</AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      {!insiderLoading && (grmAvailableItems.length > 0 || grmProcessedItems.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Processing Efficiency</h3>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{getProcessingEfficiency()}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {grmProcessedItems.length} of {grmAvailableItems.length} items processed
            </p>
          </div>

          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Quantity Efficiency</h3>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{getQuantityEfficiency()}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {grmProcessedItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)} of {grmAvailableItems.reduce((sum: number, item: any) => sum + (item.availableQuantity || 0), 0)} qty processed
            </p>
          </div>

          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Total Loss Value</h3>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">
              ₹{grmProcessedItems.reduce((sum: number, item: any) => sum + (item.lossAmount || 0), 0).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total processed loss amount
            </p>
          </div>
        </div>
      )}

      {insiderLoading ? (
        <div className="text-center py-8">
          <p className="text-slate-600">Loading analysis...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Available Items */}
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Available for Return ({grmAvailableItems.length})</h2>
              <p className="text-slate-600 mt-1 text-sm">Items expiring on {formatDisplayDate(insiderDate)} that were available for return</p>
            </div>
            <div className="p-4 sm:p-6">
              {grmAvailableItems.length === 0 ? (
                <p className="text-slate-600 text-center py-4">No items available for return on this date</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {grmAvailableItems.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-slate-900">{item.productName}</h4>
                        <p className="text-xs text-slate-600">Available: {item.availableQuantity}</p>
                        <p className="text-xs text-slate-600">Total Qty: {item.batchQuantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">₹{item.invoicePrice}</p>
                        <p className="text-xs text-slate-600">Unit Price</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Processed Items */}
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Actually Processed ({grmProcessedItems.length})</h2>
              <p className="text-slate-600 mt-1 text-sm">Items with expiry date {formatDisplayDate(insiderDate)} that were processed for GRM return</p>
            </div>
            <div className="p-4 sm:p-6">
              {grmProcessedItems.length === 0 ? (
                <p className="text-slate-600 text-center py-4">No items with this expiry date were processed</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {grmProcessedItems.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-slate-900">{item.productName}</h4>
                        <p className="text-xs text-slate-600">Processed Qty: {item.quantity}</p>
                        <p className="text-xs text-slate-600">Remaining to Process: {item.remainingQuantity || 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">₹{(item.lossAmount || 0).toFixed(2)}</p>
                        <p className="text-xs text-slate-600">Loss Amount</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Comparison Summary */}
      {!insiderLoading && (grmAvailableItems.length > 0 || grmProcessedItems.length > 0) && (
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Expiry Date Analysis for {formatDisplayDate(insiderDate)}</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Available Items</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="font-medium">{grmAvailableItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Available Quantity:</span>
                    <span className="font-medium">{grmAvailableItems.reduce((sum: number, item: any) => sum + (item.availableQuantity || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Potential Loss Value:</span>
                    <span className="font-medium">₹{grmAvailableItems.reduce((sum: number, item: any) => sum + ((item.invoicePrice || 0) * (item.availableQuantity || 0)), 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Processed Items</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="font-medium">{grmProcessedItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Processed Quantity:</span>
                    <span className="font-medium">{grmProcessedItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actual Loss Value:</span>
                    <span className="font-medium">₹{grmProcessedItems.reduce((sum: number, item: any) => sum + (item.lossAmount || 0), 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {grmAvailableItems.length > 0 && (
              <div className="mt-6 p-4 bg-slate-100 rounded-lg">
                <h5 className="font-semibold mb-2 text-slate-900">Efficiency Insights</h5>
                <div className="text-sm text-slate-600 space-y-1">
                  <p>• Processing Rate: {getProcessingEfficiency()}% of available items were processed</p>
                  <p>• Quantity Utilization: {getQuantityEfficiency()}% of available quantity was processed</p>
                  <p>• {grmAvailableItems.length - grmProcessedItems.length} items remained unprocessed</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                Returns Summary
              </h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">
                Returns overview for {new Date(customMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="h-9 w-full sm:w-[160px] bg-white border-slate-300 focus:border-slate-500"
                max={new Date().toISOString().slice(0, 7)}
              />
            </div>
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
          <Button
            variant={mainTab === 'summary' ? 'default' : 'ghost'}
            onClick={() => setMainTab('summary')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <FileText className="h-4 w-4" />
            Summary
          </Button>
          <Button
            variant={mainTab === 'insider' ? 'default' : 'ghost'}
            onClick={() => setMainTab('insider')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <BarChart3 className="h-4 w-4" />
            Insider
          </Button>
        </div>

        {/* Tab Content */}
        {mainTab === 'summary' ? (
          <div className="space-y-4 sm:space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <div className="text-sm font-medium text-slate-600">Total Loss</div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">₹{summary.grm.totalLoss.toLocaleString()}</div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <div className="text-sm font-medium text-slate-600">GRM Returns</div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{summary.grm.totalReturns}</div>
                <div className="text-sm text-slate-600">{summary.grm.totalQuantity} items</div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <div className="text-sm font-medium text-slate-600">GVN Damages</div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{summary.gvn.totalDamages}</div>
                <div className="text-sm text-slate-600">{summary.gvn.totalQuantity} items</div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  <div className="text-sm font-medium text-slate-600">Total Items</div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalReturns}</div>
                <div className="text-sm text-slate-600">All returns</div>
              </div>
            </div>

            {/* Outliers and Analytics Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* GRM Outliers Section */}
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
                <div className="p-4 sm:p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    GRM Outliers - Most Returned Items
                  </h2>
                  <p className="text-slate-600 mt-1 text-sm">
                    Items with highest return quantities in GRM this month
                  </p>
                </div>
                <div className="p-4 sm:p-6">
              {getOutliers().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No GRM returns recorded this month
                </div>
              ) : (
                <div className="space-y-3">
                  {getOutliers().map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.productName}</h4>
                          <p className="text-xs text-muted-foreground">Code: {item.itemCode || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">{item.quantity}</div>
                        <div className="text-xs text-muted-foreground">Returns</div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
                </div>
              </div>

              {/* Top Loss Items Section */}
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
                <div className="p-4 sm:p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-orange-500" />
                    Highest Loss Items
                  </h2>
                  <p className="text-slate-600 mt-1 text-sm">
                    Items with highest financial impact this month
                  </p>
                </div>
                <div className="p-4 sm:p-6">
              {getTopLossItems().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No loss data available this month
                </div>
              ) : (
                <div className="space-y-3">
                  {getTopLossItems().map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.productName}</h4>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity} | {item.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-orange-600">₹{item.loss.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Loss</div>
                    </div>
                  </div>
                ))}
                </div>
              )}
                </div>
              </div>
            </div>

            {/* Return Trends Section */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Return Pattern Analysis
                </h2>
                <p className="text-slate-600 mt-1 text-sm">
                  Breakdown of return types and patterns for this month
                </p>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">{getReturnTrends().grmPercentage}%</div>
                    <div className="text-sm text-slate-600 mt-1">GRM Returns</div>
                    <div className="text-xs text-slate-500">Expiry-based returns</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-purple-600">{getReturnTrends().gvnPercentage}%</div>
                    <div className="text-sm text-slate-600 mt-1">GVN Damages</div>
                    <div className="text-xs text-slate-500">Quality issues</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-gray-600">{getReturnTrends().totalItems}</div>
                    <div className="text-sm text-slate-600 mt-1">Total Items</div>
                    <div className="text-xs text-slate-500">Processed this month</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          renderInsiderTab()
        )}
      </div>
    </main>
  );
}