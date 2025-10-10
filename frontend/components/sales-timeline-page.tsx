// File: src/pages/SalesTimelinePage.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock, Filter, User, Receipt, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useDateContext } from "@/hooks/use-date-context";
import { formatTime } from "@/lib/dateUtils";
import { useSaleContext } from "@/contexts/SaleContext";

interface SaleTransaction {
  id: string;
  time: string;
  date: string;
  staffMember: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    isDecoration?: boolean;
  }[];
  totalAmount: number;
  paymentMethod: string;
}

interface SalesTimelinePageProps {
  onBack: () => void;
}

export function SalesTimelinePage({ onBack }: SalesTimelinePageProps) {
  const { user } = useAuth();
  const { selectedDate, setSelectedDate } = useDateContext();
  const { setRefreshSales } = useSaleContext();
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [filterBy, setFilterBy] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("time-desc");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchSalesData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        throw new Error(`Invalid or missing selectedDate: ${selectedDate}`);
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Fetching sales data for date:", selectedDate, "with token:", token.slice(0, 10) + "...");

      let response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sales/${selectedDate}?t=${Date.now()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      console.log(
        "Sales API response status:",
        response.status,
        "ok:",
        response.ok,
        "headers:",
        [...response.headers]
      );

      if (response.status === 304) {
        console.warn("Received 304 Not Modified, retrying fetch...");
        const retryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sales/${selectedDate}?t=${Date.now()}&nocache=${Math.random()}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
        if (!retryResponse.ok) {
          throw new Error(`Retry failed with status ${retryResponse.status}`);
        }
        response = retryResponse;
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const salesData = await response.json();
      console.log("Sales API raw response:", JSON.stringify(salesData, null, 2));

      if (!salesData.success) {
        throw new Error(salesData.error || "API returned unsuccessful response");
      }

      const salesById: { [key: string]: SaleTransaction } = {};
      (salesData.data || []).forEach((sale: any) => {
        const saleId = sale.id || `temp-${Math.random()}`;
        if (!salesById[saleId]) {
          salesById[saleId] = {
            id: saleId,
            time: sale.sale_date
              ? formatTime(sale.sale_date)
              : "Unknown",
            date: sale.sale_date ? sale.sale_date.split("T")[0] : selectedDate,
            staffMember:
              sale.staff_id === Number(user?.id) ? user?.name || "Unknown" : `Staff ${sale.staff_id || "Unknown"}`,
            items: [],
            totalAmount: Number(sale.total_amount) || 0,
            paymentMethod: sale.payment_type || "cash",
          };
        }
        // Check if this is a decoration item
        const isDecoration = sale.is_decoration || (!sale.batch_id && sale.decoration_sku);
        const itemName = sale.name || "Unknown Item";
        const displayName = isDecoration ? `🎨 ${itemName}` : itemName;
        
        salesById[saleId].items.push({
          name: displayName,
          quantity: Number(sale.quantity) || 0,
          price: Number(sale.unit_price) || 0,
          isDecoration: isDecoration,
        });
      });

      const mappedTransactions = Object.values(salesById);
      console.log("Mapped transactions:", JSON.stringify(mappedTransactions, null, 2));
      setTransactions(mappedTransactions);
    } catch (err: any) {
      console.error("Error fetching sales data:", err.message, err.stack);
      setError(err.message || "Failed to fetch sales transactions");
      setTimeout(() => setError(""), 3000);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, user]);

  useEffect(() => {
    fetchSalesData();
    // Allow RecordSalePage to trigger refresh
    setRefreshSales(() => fetchSalesData);
  }, [fetchSalesData, setRefreshSales]);

  // Reset date to today when leaving this page (admin view convenience)
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    return () => {
      setSelectedDate(today);
    };
  }, [setSelectedDate]);

  const summary = transactions.reduce(
    (acc, transaction) => {
      const itemsCount = transaction.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return {
        totalTransactions: acc.totalTransactions + 1,
        totalItems: acc.totalItems + itemsCount,
      };
    },
    { totalTransactions: 0, totalItems: 0 }
  );
  console.log("Calculated summary:", JSON.stringify(summary, null, 2));

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

  const filteredTransactions = transactions.filter((transaction) => {
    const method = (transaction.paymentMethod || "").toLowerCase();
    if (filterBy === "all") return true;
    if (filterBy === "cash") return method === "cash";
    if (filterBy === "hdfc") return method === "hdfc" || method === "card" || method === "pos";
    if (filterBy === "gpay") return method === "gpay";
    if (filterBy === "zomato") return method === "zomato";
    if (filterBy === "swiggy") return method === "swiggy";
    return true;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortBy === "time-desc") {
      return new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime();
    }
    if (sortBy === "time-asc") {
      return new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime();
    }
    if (sortBy === "amount-desc") {
      return (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
    }
    if (sortBy === "amount-asc") {
      return (Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0);
    }
    return 0;
  });

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Sales Timeline - {selectedDate}
                </CardTitle>
                <CardDescription>Detailed chronological view of all sales transactions</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9 w-[160px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSalesData}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">Loading sales data...</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{summary.totalTransactions}</div>
                      <div className="text-sm text-muted-foreground">Transactions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{summary.totalItems}</div>
                      <div className="text-sm text-muted-foreground">Items Sold</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>
                  <Select value={filterBy} onValueChange={setFilterBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Transactions" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="hdfc">HDFC</SelectItem>
                    <SelectItem value="gpay">GPay</SelectItem>
                    <SelectItem value="zomato">Zomato</SelectItem>
                    <SelectItem value="swiggy">Swiggy</SelectItem>
                  </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Latest First" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time-desc">Latest First</SelectItem>
                      <SelectItem value="time-asc">Oldest First</SelectItem>
                      <SelectItem value="amount-desc">Highest Amount</SelectItem>
                      <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transaction History</CardTitle>
                <CardDescription>
                  Showing {sortedTransactions.length} transaction{sortedTransactions.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sortedTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found for the selected filters
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-mono text-muted-foreground min-w-[80px]">
                              {transaction.time}
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{transaction.staffMember}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              ₹{(Number(transaction.totalAmount) || 0).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            <Badge
                              className={`${getPaymentMethodColor(transaction.paymentMethod)} border-0`}
                              variant="secondary"
                            >
                              {transaction.paymentMethod}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted-foreground">Items:</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {transaction.items.map((item, index) => (
                              <div 
                                key={index} 
                                className={`flex justify-between items-center rounded p-2 ${
                                  item.isDecoration 
                                    ? 'bg-blue-50 border border-blue-200' 
                                    : 'bg-muted/20'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {item.isDecoration && (
                                    <span className="text-blue-600">🎨</span>
                                  )}
                                  <span className={`text-sm ${item.isDecoration ? 'font-medium' : ''}`}>
                                    {item.name}
                                  </span>
                                  {item.isDecoration && (
                                    <Badge variant="outline" className="text-xs">
                                      Decoration
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-sm font-medium">
                                  {item.quantity} ×{" "}
                                  ₹{(Number(item.price) || 0).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                          Transaction ID: {transaction.id}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}