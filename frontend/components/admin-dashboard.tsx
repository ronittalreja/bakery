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
  Edit3,
  Shield,
  User,
} from "lucide-react";
import { AdminSalesPage } from "@/components/admin-sales-page";
import { ManageProductsPage } from "@/components/manage-products-page";
import { InsightsPage } from "@/components/insights-page";
import { ReturnsSummaryPage } from "@/components/returns-summary-page";
import { ManageDecorationsPage } from "@/components/manage-decorations-page";
import { AdminStockManagementPage } from "@/components/admin-stock-management-page";
import { ExpensesTrackingPage } from "@/components/expenses-tracking-page";
import { PaymentsPage } from "@/components/payments-page";
import { AddSalesPage } from "@/components/edit-sales-page";
import { RecordSalePage } from "@/components/record-sale-page";
import { TodaysStockPage } from "@/components/todays-stock-page";
import { ReturnsPage } from "@/components/newreturns";
import { TodaysSalesPage } from "@/components/todays-sales-page";
import CreditNotesPage from "@/components/credit-notes-page";
import CreditNoteDetailsPage from "@/components/credit-note-details-page";
import TomorrowAIPage from "@/components/tomorrow-ai-page";

type AdminPage =
  | "dashboard"
  | "sales-summary"
  | "admin"
  | "manage-products"
  | "manage-decorations"
  | "manage-stock"
  | "edit-sales"
  | "record-sale"
  | "expenses"
  | "insights"
  | "returns-summary"
  | "payments"
  | "grm"
  | "todays-stock"
  | "sales"
  | "credit-notes"
  | "credit-note-details"
  | "tomorrow-ai";

interface AdminDashboardProps {
  onBackToStaff?: () => void;
}

export function AdminDashboard({ onBackToStaff }: AdminDashboardProps) {
  const { user, logout } = useAuth();
  const { adminMainDate, setAdminMainDate, isToday } = useDateContext();
  const [currentPage, setCurrentPage] = useState<AdminPage>("dashboard");
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<number | null>(null);
  const [selectedCreditNoteMonth, setSelectedCreditNoteMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const dashboardItems = [
    {
      title: "Sales",
      description: "View sales by date",
      icon: BarChart3,
      page: "sales" as AdminPage,
      color: "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-cyan-200",
    },
    {
      title: "Sales Summary",
      description: "View detailed sales with totals",
      icon: BarChart3,
      page: "sales-summary" as AdminPage,
      color: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-200",
    },
    {
      title: "Credit Notes",
      description: "View and manage credit notes",
      icon: CreditCard,
      page: "credit-notes" as AdminPage,
      color: "bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-teal-200",
    },
    {
      title: "Returns Summary",
      description: "View returns summary, total loss and trends",
      icon: FileText,
      page: "returns-summary" as AdminPage,
      color: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-200",
    },
    {
      title: "Expenses",
      description: "Track business expenses",
      icon: Receipt,
      page: "expenses" as AdminPage,
      color: "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200",
    },
    {
      title: "Business",
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
      title: "Tomorrow AI",
      description: "Demand forecasting system",
      icon: Sparkles,
      page: "tomorrow-ai" as AdminPage,
      color: "bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-white shadow-slate-300",
      isDark: true,
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto p-6">
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
              <div
                onClick={() => setCurrentPage("edit-sales")}
                className="group cursor-pointer"
              >
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200 flex items-center justify-center">
                      <Edit3 className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 leading-tight">
                      Add Sales
                    </h3>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setCurrentPage("record-sale")}
                className="group cursor-pointer"
              >
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-200 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 leading-tight">
                      Record Sale
                    </h3>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setCurrentPage("grm")}
                className="group cursor-pointer"
              >
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200 flex items-center justify-center">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 leading-tight">
                      Returns
                    </h3>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setCurrentPage("todays-stock")}
                className="group cursor-pointer"
              >
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 leading-tight">
                      Today's Stock
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
      case "edit-sales":
        return <AddSalesPage onBack={() => setCurrentPage("admin")} />;
      case "record-sale":
        return <RecordSalePage onBack={() => setCurrentPage("admin")} />;
      case "grm":
        return <ReturnsPage onBack={() => setCurrentPage("admin")} />;
      case "todays-stock":
        return <TodaysStockPage onBack={() => setCurrentPage("admin")} />;
      case "sales":
        return <TodaysSalesPage onBack={() => setCurrentPage("admin")} />;
      case "credit-notes":
        return (
          <CreditNotesPage 
            onBack={() => setCurrentPage("admin")} 
            onViewCreditNote={(id, month) => {
              setSelectedCreditNoteId(id);
              setSelectedCreditNoteMonth(month);
              setCurrentPage("credit-note-details");
            }}
          />
        );
      case "credit-note-details":
        return selectedCreditNoteId ? (
          <CreditNoteDetailsPage 
            creditNoteId={selectedCreditNoteId} 
            selectedMonth={selectedCreditNoteMonth}
            onBack={() => setCurrentPage("credit-notes")} 
          />
        ) : (
          <div className="h-full bg-white flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">No credit note selected</p>
              <Button onClick={() => setCurrentPage("credit-notes")} className="mt-4">
                Go Back
              </Button>
            </div>
          </div>
        );
      case "expenses":
        return <ExpensesTrackingPage onBack={() => setCurrentPage("dashboard")} />;
      case "insights":
        return <InsightsPage onBack={() => setCurrentPage("dashboard")} />;
      case "payments":
        return <PaymentsPage onBack={() => setCurrentPage("dashboard")} />;
      case "tomorrow-ai":
        return <TomorrowAIPage />;
      default:
        return (
          <div className="h-full bg-white flex items-center justify-center">
            {/* Dashboard Grid */}
            <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto p-6">
              {dashboardItems.map((item) => {
                const Icon = item.icon;
                const isDarkCard = item.isDark;
                return (
                  <div
                    key={item.title}
                    onClick={() => setCurrentPage(item.page)}
                    className="group cursor-pointer"
                  >
                    <div className={`${isDarkCard 
                      ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 border-slate-600 shadow-slate-300' 
                      : 'bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200 shadow-lg'
                    } rounded-lg border transition-all duration-200 p-6 h-full`}>
                      <div className="flex flex-col items-center text-center space-y-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        
                        {/* Title */}
                        <h3 className={`text-sm font-medium leading-tight ${isDarkCard ? 'text-white' : 'text-slate-900'}`}>
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
                <div className="flex items-center gap-2">
                  <User className="h-6 w-6 text-slate-900" />
                  <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Welcome back, R3309</h1>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none">
                <DateSelector selectedDate={adminMainDate} onDateChange={setAdminMainDate} />
              </div>
              {user?.isDemo && onBackToStaff && (
                <Button 
                  variant="outline" 
                  onClick={onBackToStaff}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-blue-600 transition-all duration-200 flex-shrink-0"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Staff</span>
                  <span className="sm:hidden">Staff</span>
                </Button>
              )}
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