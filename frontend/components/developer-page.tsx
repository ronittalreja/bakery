"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useDateContext } from "@/hooks/use-date-context"
import { usePersistedState } from "@/hooks/use-persisted-state"
import {
  Upload,
  ShoppingCart,
  Package,
  BarChart3,
  LogOut,
  ArrowLeft,
  RotateCcw,
  Calendar,
  CheckCircle,
  Settings,
  Sparkles,
  Layers,
  Store,
  Plus,
  TrendingUp,
} from "lucide-react"
import { UploadInvoicePage } from "@/components/upload-invoice-page"
import { RecordSalePage } from "@/components/record-sale-page"
import { TodaysStockPage } from "@/components/todays-stock-page"
import { TodaysSalesPage } from "@/components/todays-sales-page"
import { ReturnsPage } from "@/components/newreturns"
import { ManageProductsPage } from "@/components/manage-products-page"
import { ManageDecorationsPage } from "@/components/manage-decorations-page"
import { AdminStockManagementPage } from "@/components/admin-stock-management-page"
import { AddSalesPage } from "@/components/edit-sales-page"
import { MLGroupsPage } from "@/components/ml-groups-page"
import { ManageEventsPage } from "@/components/manage-events-page"
import { ManageStoresPage } from "@/components/manage-stores-page"
import { OverallAnalyticsPage } from "@/components/overall-analytics-page"
import { MasterProductsPage } from "@/components/master-products-page"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/apiClient"

type StaffPage = "dashboard" | "upload-invoice" | "record-sale" | "stock" | "sales-summary" | "returns" | "manage-products" | "manage-decorations" | "manage-stock" | "edit-sales" | "ml-groups" | "manage-events" | "manage-stores" | "overall-analytics" | "master-products" | "store-view"

interface Store {
  id: number
  store_code: string
  store_name: string
  status: string
}

interface StaffDashboardProps {
  onSwitchToUser?: () => void;
}

export function StaffDashboard({ onSwitchToUser }: StaffDashboardProps) {
  const { user, logout } = useAuth()
  const { selectedDate, isToday, endDay, isDayEnded, staffCanEndDay } = useDateContext()
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = usePersistedState<StaffPage>('staff_current_page', "dashboard")
  const [hasInvoice, setHasInvoice] = useState(false)
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [showManageStores, setShowManageStores] = useState(false)
  const [storeHasInvoice, setStoreHasInvoice] = useState(false)

  useEffect(() => {
    const checkInvoice = async () => {
      try {
        const response = await apiClient(`/api/invoices?date=${selectedDate}`) as any[]
        setHasInvoice(!!response.length)
      } catch (err) {
      }
    }
    if (isToday) checkInvoice()
  }, [selectedDate, isToday])

  useEffect(() => {
    const checkStoreInvoice = async () => {
      if (!selectedStore) {
        setStoreHasInvoice(false)
        return
      }
      try {
        const response = await apiClient(`/api/invoices?date=${selectedDate}&store_id=${selectedStore.id}`) as any[]
        setStoreHasInvoice(!!response.length)
      } catch (err) {
        setStoreHasInvoice(false)
      }
    }
    if (isToday) checkStoreInvoice()
  }, [selectedDate, isToday, selectedStore])

  const handleEndDay = () => {
    endDay()
    toast({
      title: "Day Ended Successfully",
      description: "The day has been ended and advanced to the next date. All data has been saved.",
    })
  }

  useEffect(() => {
    fetchStores()
  }, [])

  const fetchStores = async () => {
    try {
      const response = await apiClient("/api/stores") as Store[]
      setStores(response.filter((s) => s.status === "active"))
    } catch (err) {
      console.error("Failed to fetch stores", err)
    }
  }

  const renderStoreView = () => {
    if (!selectedStore) return null

    return (
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedStore(null)
              setCurrentPage("dashboard")
            }}
            className="flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">{selectedStore.store_name}</h1>
          <p className="text-muted-foreground">Store Code: {selectedStore.store_code}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto p-6">
          {storeFunctionItems.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                onClick={() => !item.disabled && setCurrentPage(item.page)}
                className={`group cursor-pointer ${item.disabled ? "opacity-50" : ""}`}
              >
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 leading-tight">
                      {item.title}
                    </h3>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    )
  }

  const mainDashboardItems = [
    {
      title: "Master Products",
      description: "Master table of all products from all stores",
      icon: Settings,
      page: "master-products" as StaffPage,
      color: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200",
      disabled: false,
    },
    {
      title: "Manage Events",
      description: "Manage events across all stores",
      icon: Sparkles,
      page: "manage-events" as StaffPage,
      color: "bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-purple-200",
      disabled: false,
    },
    {
      title: "ML Groups",
      description: "Manage ML groups and aliases (common across all stores)",
      icon: Layers,
      page: "ml-groups" as StaffPage,
      color: "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-cyan-200",
      disabled: false,
    },
    {
      title: "Overall Analytics",
      description: "Analytics across all stores",
      icon: TrendingUp,
      page: "overall-analytics" as StaffPage,
      color: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-200",
      disabled: false,
    },
  ]

  const storeFunctionItems = [
    {
      title: "Upload",
      description: "Add stock from van invoice",
      icon: Upload,
      page: "upload-invoice" as StaffPage,
      color: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200",
      disabled: !isToday || isDayEnded,
    },
    {
      title: "Record Sale",
      description: "Record customer purchases",
      icon: ShoppingCart,
      page: "record-sale" as StaffPage,
      color: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-200",
      disabled: !isToday || isDayEnded || !storeHasInvoice,
    },
    {
      title: "Today's Stock",
      description: "View available inventory",
      icon: Package,
      page: "stock" as StaffPage,
      color: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-200",
      disabled: false,
    },
    {
      title: "Returns",
      description: "Process GRM and GVN returns",
      icon: RotateCcw,
      page: "returns" as StaffPage,
      color: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-200",
      disabled: !isToday || isDayEnded || !storeHasInvoice,
    },
    {
      title: "Manage Products",
      description: "Manage store products",
      icon: Settings,
      page: "manage-products" as StaffPage,
      color: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-200",
      disabled: false,
    },
    {
      title: "Manage Decorations",
      description: "Manage store decorations",
      icon: Sparkles,
      page: "manage-decorations" as StaffPage,
      color: "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-200",
      disabled: false,
    },
    {
      title: "Stock Management",
      description: "Manage stock batches",
      icon: Package,
      page: "manage-stock" as StaffPage,
      color: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-200",
      disabled: false,
    },
    {
      title: "Add Sales",
      description: "Add sales entries",
      icon: BarChart3,
      page: "edit-sales" as StaffPage,
      color: "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200",
      disabled: false,
    },
  ]

  const renderPage = () => {
    const storeId = selectedStore?.id
    switch (currentPage) {
      case "upload-invoice":
        return <UploadInvoicePage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "record-sale":
        return <RecordSalePage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "stock":
        return <TodaysStockPage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "sales-summary":
        return <TodaysSalesPage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "returns":
        return <ReturnsPage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "manage-products":
        return <ManageProductsPage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "manage-decorations":
        return <ManageDecorationsPage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "manage-stock":
        return <AdminStockManagementPage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "edit-sales":
        return <AddSalesPage onBack={() => setCurrentPage(selectedStore ? "store-view" : "dashboard")} storeId={storeId} />
      case "ml-groups":
        return <MLGroupsPage onBack={() => setCurrentPage("dashboard")} />
      case "manage-events":
        return <ManageEventsPage onBack={() => setCurrentPage("dashboard")} />
      case "manage-stores":
        return <ManageStoresPage onBack={() => setCurrentPage("dashboard")} />
      case "overall-analytics":
        return <OverallAnalyticsPage onBack={() => setCurrentPage("dashboard")} />
      case "master-products":
        return <MasterProductsPage onBack={() => setCurrentPage("dashboard")} />
      case "store-view":
        return renderStoreView()
      default:
        return (
          <main className="container mx-auto px-4 py-8">
            <div className="space-y-8">
              {/* 4 Main Cards */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto p-6">
                  {mainDashboardItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.title}
                        onClick={() => !item.disabled && setCurrentPage(item.page)}
                        className={`group cursor-pointer ${item.disabled ? "opacity-50" : ""}`}
                      >
                        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                          <div className="flex flex-col items-center text-center space-y-4">
                            <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="text-sm font-medium text-slate-900 leading-tight">
                              {item.title}
                            </h3>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Manage Stores Section */}
              <div>
                <div className="flex items-center justify-between mb-4 max-w-4xl mx-auto">
                  <h2 className="text-2xl font-bold">Manage Stores ({stores.length})</h2>
                  <Button
                    onClick={() => setShowManageStores(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Store
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
                  {stores.map((store) => (
                    <Card
                      key={store.id}
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => {
                        setSelectedStore(store)
                        setCurrentPage("store-view")
                      }}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center">
                            <Store className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{store.store_name}</CardTitle>
                            <CardDescription>{store.store_code}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            </div>

            {showManageStores && (
              <ManageStoresPage onBack={() => setShowManageStores(false)} />
            )}
          </main>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {currentPage !== "dashboard" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage("dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <div>
              <p className="text-muted-foreground">Welcome back, {user?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {staffCanEndDay && (
              <Button variant="outline" onClick={handleEndDay} className="flex items-center gap-2 bg-transparent">
                <CheckCircle className="h-4 w-4" />
                End Day
              </Button>
            )}
            <Button variant="outline" onClick={logout} className="flex items-center gap-2 bg-transparent">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {renderPage()}
    </div>
  )
}

// Backward-compatible export for AdminDashboard import
export const StaffFunctionsPage = StaffDashboard;