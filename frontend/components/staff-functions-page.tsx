"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useDateContext } from "@/hooks/use-date-context"
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
} from "lucide-react"
import { UploadInvoicePage } from "@/components/upload-invoice-page"
import { RecordSalePage } from "@/components/record-sale-page"
import { TodaysStockPage } from "@/components/todays-stock-page"
import { TodaysSalesPage } from "@/components/todays-sales-page"
import { ReturnsPage } from "@/components/newreturns"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/apiClient"

type StaffPage = "dashboard" | "upload-invoice" | "record-sale" | "stock" | "sales-summary" | "returns"

export function StaffDashboard() {
  const { user, logout } = useAuth()
  const { selectedDate, isToday, endDay, isDayEnded, staffCanEndDay } = useDateContext()
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState<StaffPage>("dashboard")
  const [hasInvoice, setHasInvoice] = useState(false)

  useEffect(() => {
    const checkInvoice = async () => {
      try {
        const response = await apiClient(`/api/invoices?date=${selectedDate}`)
        setHasInvoice(!!response.length)
      } catch (err) {
        console.error("Error checking invoice:", err)
      }
    }
    if (isToday) checkInvoice()
  }, [selectedDate, isToday])

  const handleEndDay = () => {
    endDay()
    toast({
      title: "Day Ended Successfully",
      description: "The day has been ended and advanced to the next date. All data has been saved.",
    })
  }

  const dashboardItems = [
    {
      title: "Upload Invoice",
      description: "Add stock from van invoice",
      icon: Upload,
      page: "upload-invoice" as StaffPage,
      color: "bg-primary text-primary-foreground",
      disabled: !isToday || isDayEnded,
    },
    {
      title: "Record Sale",
      description: "Record customer purchases and special cakes",
      icon: ShoppingCart,
      page: "record-sale" as StaffPage,
      color: "bg-secondary text-secondary-foreground",
      disabled: !isToday || isDayEnded || !hasInvoice,
    },
    {
      title: "Today's Stock",
      description: "View available inventory",
      icon: Package,
      page: "stock" as StaffPage,
      color: "bg-accent text-accent-foreground",
      disabled: false,
    },
    {
      title: "Sales Timeline",
      description: "View sales by date",
      icon: BarChart3,
      page: "sales-summary" as StaffPage,
      color: "bg-muted text-muted-foreground",
      disabled: false,
    },
    {
      title: "Returns",
      description: "Process GRM and GVN returns",
      icon: RotateCcw,
      page: "returns" as StaffPage,
      color: "bg-orange-500 text-white",
      disabled: !isToday || isDayEnded || !hasInvoice,
    },
  ]

  const renderPage = () => {
    switch (currentPage) {
      case "upload-invoice":
        return <UploadInvoicePage onBack={() => setCurrentPage("dashboard")} />
      case "record-sale":
        return <RecordSalePage onBack={() => setCurrentPage("dashboard")} />
      case "stock":
        return <TodaysStockPage onBack={() => setCurrentPage("dashboard")} />
      case "sales-summary":
        return <TodaysSalesPage onBack={() => setCurrentPage("dashboard")} />
      case "returns":
        return <ReturnsPage onBack={() => setCurrentPage("dashboard")} />
      default:
        return (
          <main className="container mx-auto px-4 py-8">
            <div className="mb-6">
              <Card className={`${isToday ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className={`h-5 w-5 ${isToday ? "text-green-600" : "text-blue-600"}`} />
                      <div>
                        <p className={`font-semibold ${isToday ? "text-green-800" : "text-blue-800"}`}>
                          {isToday ? "Today's Operations" : "Viewing Historical Data"}
                        </p>
                        <p className={`text-sm ${isToday ? "text-green-600" : "text-blue-600"}`}>
                          {selectedDate} {isDayEnded && isToday && "- Day Ended"}
                        </p>
                      </div>
                    </div>
                    {!isToday && (
                      <div className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">Read Only</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboardItems.map((item) => {
                const Icon = item.icon
                return (
                  <Card
                    key={item.title}
                    className={`hover:shadow-lg transition-shadow ${item.disabled ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <CardHeader>
                      <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center mb-4`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full bg-transparent"
                        variant="outline"
                        onClick={() => setCurrentPage(item.page)}
                        disabled={item.disabled}
                      >
                        {item.disabled ? "Not Available" : `Open ${item.title}`}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
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
              <h1 className="text-2xl font-bold text-primary">Staff Dashboard</h1>
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