"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Clock, Filter, User, Receipt, TrendingUp, Calendar, AlertCircle, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { useDateContext } from "@/hooks/use-date-context"
import { formatTime } from "@/lib/dateUtils"

interface SaleTransaction {
  id: string
  time: string
  date: string
  staffMember: string
  items: {
    name: string
    quantity: number
    price: number
    isDecoration?: boolean
  }[]
  totalAmount: number
  paymentMethod: string
  discount?: number
  customerType?: "walk-in" | "delivery"
}

interface SalesTimelinePageProps {
  onBack: () => void
}

export function TodaysSalesPage({ onBack }: SalesTimelinePageProps) {
  const { user } = useAuth()
  const { selectedDate, setSelectedDate, setAdminMainDate } = useDateContext()
  const [transactions, setTransactions] = useState<SaleTransaction[]>([])
  const [summary, setSummary] = useState<{ totalTransactions: number; totalItems: number; totalSales: number }>({
    totalTransactions: 0,
    totalItems: 0,
    totalSales: 0,
  })
  const [filterBy, setFilterBy] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("time-desc")
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          throw new Error("No authentication token found")
        }

        // Fetch transactions
        const salesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sales/${selectedDate}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        const salesData = await salesResponse.json()
        if (!salesResponse.ok || !salesData.success) {
          throw new Error(salesData.error || "Failed to fetch sales transactions")
        }

        // Map API -> UI model (backend returns { success, data: [{ id, sale_date, total_amount, payment_type, items: [...] }] })
        const apiSales = Array.isArray(salesData.data)
          ? salesData.data
          : Array.isArray(salesData.sales)
            ? salesData.sales
            : []

        const mappedTransactions = apiSales.map((sale: any) => {
          const saleId = sale.id || sale.sale_id
          const saleDate = sale.sale_date || sale.saleDate
          const payment = sale.payment_type || sale.paymentType || ""
          const total = sale.total_amount ?? sale.totalAmount ?? 0
          const items = Array.isArray(sale.items) ? sale.items : []

          return {
            id: String(saleId ?? ""),
            time: saleDate ? formatTime(saleDate) : "",
            date: saleDate || selectedDate,
            staffMember: String(sale.staff_id ?? sale.staffId ?? ""),
            items: items.map((item: any) => {
              const isDecoration = item.is_decoration || (!item.batch_id && item.decoration_sku);
              const itemName = item.name || "";
              const displayName = isDecoration ? `🎨 ${itemName}` : itemName;
              return {
                name: displayName,
                quantity: Number(item.quantity || 0),
                price: Number(item.unit_price ?? item.unitPrice ?? 0),
                isDecoration: isDecoration,
              };
            }),
            totalAmount: Number(total),
            paymentMethod: payment,
            customerType: sale.customerType || "walk-in",
            discount: sale.discount ? Number(sale.discount) : undefined,
          } as SaleTransaction
        })
        setTransactions(mappedTransactions)

        // Fetch summary
        const summaryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sales/summary/${selectedDate}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        const summaryData = await summaryResponse.json()
        if (!summaryResponse.ok || !summaryData.success) {
          throw new Error(summaryData.error || "Failed to fetch sales summary")
        }
        setSummary({
          totalTransactions: summaryData.summary.totalTransactions,
          totalItems: summaryData.summary.totalItems,
          totalSales: summaryData.summary.totalSales,
        })
      } catch (err: any) {
        setError(err.message)
        setTimeout(() => setError(""), 3000)
      }
    }
    fetchSalesData()
  }, [selectedDate])

  // Reset admin date back to today when leaving this page
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    return () => {
      setSelectedDate(today)
      setAdminMainDate(today)
    }
  }, [setSelectedDate, setAdminMainDate])

  const getPaymentMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case "cash":
        return "bg-green-100 text-green-800"
      case "hdfc":
        return "bg-blue-100 text-blue-800"
      case "gpay":
        return "bg-purple-100 text-purple-800"
      case "swiggy":
        return "bg-orange-100 text-orange-800"
      case "zomato":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCustomerTypeColor = (type: string) => {
    return type === "delivery" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
  }

  const filteredTransactions = transactions.filter((transaction) => {
    if (filterBy === "all") return true
    if (filterBy === "cash") return transaction.paymentMethod.toLowerCase() === "cash"
    if (filterBy === "digital") return !["cash"].includes(transaction.paymentMethod.toLowerCase())
    if (filterBy === "delivery") return transaction.customerType === "delivery"
    if (filterBy === "walk-in") return transaction.customerType === "walk-in"
    return true
  })

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortBy === "time-desc") {
      return new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime()
    }
    if (sortBy === "time-asc") {
      return new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime()
    }
    if (sortBy === "amount-desc") {
      return b.totalAmount - a.totalAmount
    }
    if (sortBy === "amount-asc") {
      return a.totalAmount - b.totalAmount
    }
    return 0
  })

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Page Header */}
      <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Sales Timeline - {selectedDate}
              </h1>
              <p className="text-slate-600 text-sm sm:text-base">Detailed chronological view of all sales transactions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setAdminMainDate(e.target.value); }}
              className="h-9 w-[160px] bg-white border-slate-300 focus:border-slate-500"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{summary.totalTransactions}</div>
                <div className="text-sm text-slate-600">Transactions</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{summary.totalItems}</div>
                <div className="text-sm text-slate-600">Items Sold</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">₹{summary.totalSales.toLocaleString()}</div>
                <div className="text-sm text-slate-600">Total Sales</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Filters:</span>
            </div>
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-40 bg-white border-slate-300 focus:border-slate-500">
                <SelectValue placeholder="All Transactions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="cash">Cash Only</SelectItem>
                <SelectItem value="digital">Digital Payments</SelectItem>
                <SelectItem value="delivery">Delivery Orders</SelectItem>
                <SelectItem value="walk-in">Walk-in Customers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 bg-white border-slate-300 focus:border-slate-500">
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
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Transaction History</h2>
            <p className="text-slate-600 mt-1 text-sm">
              Showing {sortedTransactions.length} transaction{sortedTransactions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-4 sm:p-6">
            {sortedTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No transactions found for the selected filters
              </div>
            ) : (
              <div className="space-y-4">
                {sortedTransactions.map((transaction) => (
                  <div key={transaction.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-mono text-muted-foreground min-w-[80px]">{transaction.time}</div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{transaction.staffMember}</span>
                        </div>
                        <Badge
                          className={`${getCustomerTypeColor(transaction.customerType || "walk-in")} border-0 text-xs`}
                          variant="secondary"
                        >
                          {transaction.customerType === "delivery" ? "Delivery" : "Walk-in"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">₹{transaction.totalAmount.toLocaleString()}</div>
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
                              {item.quantity} × ₹{item.price.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      {transaction.discount && (
                        <div className="flex justify-between items-center text-sm text-green-600 bg-green-50 rounded p-2">
                          <span>Discount Applied:</span>
                          <span className="font-medium">-₹{transaction.discount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                      Transaction ID: {transaction.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}