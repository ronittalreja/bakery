"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, DollarSign, Package, Store, Calendar } from "lucide-react"
import { useAuth, getAuthToken } from "@/hooks/use-auth"
import { useDateContext } from "@/hooks/use-date-context"
import { apiClient } from "@/lib/apiClient"

interface StoreAnalytics {
  store_id: number
  store_name: string
  total_sales: number
  total_orders: number
  total_products: number
}

interface OverallAnalytics {
  total_sales: number
  total_orders: number
  total_products: number
  total_stores: number
  store_analytics: StoreAnalytics[]
}

interface OverallAnalyticsPageProps {
  onBack: () => void
}

export function OverallAnalyticsPage({ onBack }: OverallAnalyticsPageProps) {
  const { user } = useAuth()
  const { selectedDate } = useDateContext()
  const [analytics, setAnalytics] = useState<OverallAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchAnalytics()
  }, [selectedDate])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setError("")

    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await apiClient(`/api/analytics/overall?date=${selectedDate}`) as OverallAnalytics
      setAnalytics(response)
    } catch (err) {
      setError("Failed to fetch analytics")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
            <Button onClick={fetchAnalytics} className="mt-4">Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Overall Analytics</h1>
        <p className="text-muted-foreground">Analytics across all stores for {selectedDate}</p>
      </div>

      {analytics && (
        <>
          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{analytics.total_sales.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Across all stores</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.total_orders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.total_products.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Items in inventory</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.total_stores}</div>
                <p className="text-xs text-muted-foreground">Stores in system</p>
              </CardContent>
            </Card>
          </div>

          {/* Store-wise Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Store-wise Analytics</CardTitle>
              <CardDescription>Performance breakdown by store</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.store_analytics.map((store) => (
                  <div
                    key={store.store_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{store.store_name}</h3>
                        <p className="text-sm text-muted-foreground">Store ID: {store.store_id}</p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-right">
                      <div>
                        <p className="text-sm font-medium">₹{store.total_sales.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Sales</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{store.total_orders}</p>
                        <p className="text-xs text-muted-foreground">Orders</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{store.total_products}</p>
                        <p className="text-xs text-muted-foreground">Products</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
