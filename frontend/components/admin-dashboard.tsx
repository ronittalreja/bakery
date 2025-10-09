// File: app/admin/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useDateContext } from "@/hooks/use-date-context";
import { DateSelector } from "@/components/date-selector";
import {
  Package,
  BarChart3,
  Settings,
  TrendingUp,
  LogOut,
  ArrowLeft,
  FileText,
  Sparkles,
  Database,
  Receipt,
  Calendar,
  Users,
  CreditCard,
} from "lucide-react";
import { AdminSalesPage } from "@/components/admin-sales-page";
import { ManageProductsPage } from "@/components/manage-products-page";
import { InsightsPage } from "@/components/insights-page";
import { ReturnsSummaryPage } from "@/components/returns-summary-page";
import { ManageDecorationsPage } from "@/components/manage-decorations-page";
import { AdminStockManagementPage } from "@/components/admin-stock-management-page";
import { ExpensesTrackingPage } from "@/components/expenses-tracking-page";
import { PaymentsPage } from "@/components/payments-page";

type AdminPage =
  | "dashboard"
  | "sales-summary"
  | "admin"
  | "manage-products"
  | "manage-decorations"
  | "manage-stock"
  | "expenses"
  | "insights"
  | "returns-summary"
  | "payments";

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { adminMainDate, setAdminMainDate, isToday } = useDateContext();
  const [currentPage, setCurrentPage] = useState<AdminPage>("dashboard");

  const dashboardItems = [
    {
      title: "Sales Summary",
      description: "View detailed sales with totals",
      icon: BarChart3,
      page: "sales-summary" as AdminPage,
      color: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-200",
    },
    {
      title: "Returns Summary",
      description: "View returns summary, total loss and trends",
      icon: FileText,
      page: "returns-summary" as AdminPage,
      color: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-200",
    },
    {
      title: "Expenses Tracking",
      description: "Track business expenses",
      icon: Receipt,
      page: "expenses" as AdminPage,
      color: "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200",
    },
    {
      title: "Insights",
      description: "Sales analytics and trends",
      icon: TrendingUp,
      page: "insights" as AdminPage,
      color: "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-cyan-200",
    },
    {
      title: "Payments",
      description: "Manage invoices and credit notes",
      icon: CreditCard,
      page: "payments" as AdminPage,
      color: "bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-teal-200",
    },
    {
      title: "Admin",
      description: "Manage products, decorations, stock, and view inventory",
      icon: Settings,
      page: "admin" as AdminPage,
      color: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-200",
    },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case "sales-summary":
        return <AdminSalesPage onBack={() => setCurrentPage("dashboard")} />;
      case "returns-summary":
        return <ReturnsSummaryPage onBack={() => setCurrentPage("dashboard")} />;
      case "admin":
        return (
          <div className="h-full bg-white flex items-center justify-center">
            <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto p-6">
              <div
                onClick={() => setCurrentPage("manage-products")}
                className="group cursor-pointer"
              >
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-200 flex items-center justify-center">
                      <Settings className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 leading-tight">
                      Manage Products
                    </h3>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setCurrentPage("manage-decorations")}
                className="group cursor-pointer"
              >
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-200 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 leading-tight">
                      Manage Decorations
                    </h3>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setCurrentPage("manage-stock")}
                className="group cursor-pointer"
              >
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-200 flex items-center justify-center">
                      <Database className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 leading-tight">
                      Stock Management
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "manage-products":
        return <ManageProductsPage onBack={() => setCurrentPage("admin")} />;
      case "manage-decorations":
        return <ManageDecorationsPage onBack={() => setCurrentPage("admin")} />;
      case "manage-stock":
        return <AdminStockManagementPage onBack={() => setCurrentPage("admin")} />;
      case "expenses":
        return <ExpensesTrackingPage onBack={() => setCurrentPage("dashboard")} />;
      case "insights":
        return <InsightsPage onBack={() => setCurrentPage("dashboard")} />;
      case "payments":
        return <PaymentsPage onBack={() => setCurrentPage("dashboard")} />;
      default:
        return (
          <div className="h-full bg-white flex items-center justify-center">
            {/* Dashboard Grid */}
            <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto p-6">
              {dashboardItems.map((item) => {
                const Icon = item.icon;
                const isAdminCard = item.title === "Admin";
                return (
                  <div
                    key={item.title}
                    onClick={() => setCurrentPage(item.page)}
                    className="group cursor-pointer"
                  >
                    <div className={`${isAdminCard 
                      ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 border-slate-600 shadow-slate-300' 
                      : 'bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200 shadow-lg'
                    } rounded-lg border transition-all duration-200 p-6 h-full`}>
                      <div className="flex flex-col items-center text-center space-y-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        
                        {/* Title */}
                        <h3 className={`text-sm font-medium leading-tight ${isAdminCard ? 'text-white' : 'text-slate-900'}`}>
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
    }
  };

  if (!user) return <div className="container mx-auto px-4 py-8 text-center text-red-600">Please log in</div>;

  return (
    <div className={`${currentPage === "dashboard" ? "h-screen overflow-hidden" : "min-h-screen"} bg-background ${currentPage === "dashboard" ? "flex flex-col" : ""}`}>
      <header className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border-b border-slate-200 shadow-lg flex-shrink-0">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              {currentPage !== "dashboard" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage("dashboard")}
                  className="flex items-center gap-2 bg-white hover:bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-black transition-all duration-200 flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Admin Dashboard</h1>
                <p className="text-sm sm:text-base text-slate-600 truncate">Welcome back, {user?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none">
                <DateSelector selectedDate={adminMainDate} onDateChange={setAdminMainDate} />
              </div>
              <Button variant="outline" onClick={logout} className="flex items-center gap-2 bg-white hover:bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-black transition-all duration-200 flex-shrink-0">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
                <span className="sm:hidden">Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      <div className={currentPage === "dashboard" ? "flex-1 overflow-hidden" : ""}>
        {renderPage()}
      </div>
    </div>
  );
}