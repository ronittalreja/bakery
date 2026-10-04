"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDateContext } from "@/hooks/use-date-context";
import {
  Upload,
  ShoppingCart,
  Package,
  BarChart3,
  LogOut,
  ArrowLeft,
  RotateCcw,
  CreditCard,
  Shield,
  User,
  Settings,
  Sparkles,
  Edit3,
  Calendar,
  Layers,
} from "lucide-react";
import { UploadInvoicePage } from "@/components/upload-invoice-page";
import { RecordSalePage } from "@/components/record-sale-page";
import { TodaysStockPage } from "@/components/todays-stock-page"; // Ensure this file exists and has a default export
import { TodaysSalesPage } from "@/components/todays-sales-page";
import { ReturnsPage } from "@/components/newreturns";
import CreditNotesPage from "@/components/credit-notes-page";
import CreditNoteDetailsPage from "@/components/credit-note-details-page";
import { DateSelector } from "@/components/date-selector";
import { ManageProductsPage } from "@/components/manage-products-page";
import { ManageDecorationsPage } from "@/components/manage-decorations-page";
import { AdminStockManagementPage } from "@/components/admin-stock-management-page";
import { AddSalesPage } from "@/components/edit-sales-page";
import { MLGroupsPage } from "@/components/ml-groups-page";
import { ManageEventsPage } from "@/components/manage-events-page";

type StaffPage = "dashboard" | "upload-invoice" | "record-sale" | "stock" | "sales-summary" | "returns" | "credit-notes" | "credit-note-details" | "developer" | "manage-products" | "manage-decorations" | "manage-stock" | "edit-sales" | "ml-groups" | "manage-events";

interface DeveloperDashboardProps {
  onSwitchToUser?: () => void;
}

export function DeveloperDashboard({ onSwitchToUser }: DeveloperDashboardProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { selectedDate, isToday, isDayEnded } = useDateContext();
  const [currentPage, setCurrentPage] = useState<StaffPage>("dashboard");
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<number | null>(null);
  const [selectedCreditNoteMonth, setSelectedCreditNoteMonth] = useState<string>(new Date().toISOString().slice(0, 7));


  const dashboardItems = [
    {
      title: "Developer",
      description: "Manage products, decorations, stock, and view inventory",
      icon: Settings,
      page: "developer" as StaffPage,
      color: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-200",
      disabled: false,
    },
  ];

  const renderPage = () => {
    try {
      switch (currentPage) {
        case "upload-invoice":
          if (!UploadInvoicePage) throw new Error("UploadInvoicePage is undefined");
          return <UploadInvoicePage onBack={() => setCurrentPage("developer")} />;
        case "record-sale":
          if (!RecordSalePage) throw new Error("RecordSalePage is undefined");
          return <RecordSalePage onBack={() => setCurrentPage("developer")} />;
        case "stock":
          if (!TodaysStockPage) throw new Error("TodaysStockPage is undefined");
          return <TodaysStockPage onBack={() => setCurrentPage("developer")} />;
        case "sales-summary":
          if (!TodaysSalesPage) throw new Error("TodaysSalesPage is undefined");
          return <TodaysSalesPage onBack={() => setCurrentPage("dashboard")} />;
        case "returns":
          if (!ReturnsPage) throw new Error("ReturnsPage is undefined");
          return <ReturnsPage onBack={() => setCurrentPage("developer")} />;
        case "credit-notes":
          return (
            <CreditNotesPage 
              onBack={() => setCurrentPage("dashboard")} 
              onViewCreditNote={(id, month) => {
                setSelectedCreditNoteId(id);
                setSelectedCreditNoteMonth(month);
                setCurrentPage("credit-note-details");
              }}
              initialMonth={selectedCreditNoteMonth}
            />
          );
        case "credit-note-details":
          if (!selectedCreditNoteId) {
            setCurrentPage("credit-notes");
            return null;
          }
          return (
            <CreditNoteDetailsPage 
              creditNoteId={selectedCreditNoteId}
              selectedMonth={selectedCreditNoteMonth}
              onBack={(month) => {
                setSelectedCreditNoteId(null);
                setSelectedCreditNoteMonth(month);
                setCurrentPage("credit-notes");
              }}
            />
          );
        case "developer":
          return (
            <div className="h-full bg-white flex items-center justify-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto p-6">
                <div
                  onClick={() => setCurrentPage("upload-invoice")}
                  className="group cursor-pointer"
                >
                  <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200 flex items-center justify-center">
                        <Upload className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-sm font-medium text-slate-900 leading-tight">
                        Upload
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
                        <ShoppingCart className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-sm font-medium text-slate-900 leading-tight">
                        Record Sale
                      </h3>
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => setCurrentPage("stock")}
                  className="group cursor-pointer"
                >
                  <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-200 flex items-center justify-center">
                        <Package className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-sm font-medium text-slate-900 leading-tight">
                        Today's Stock
                      </h3>
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => setCurrentPage("returns")}
                  className="group cursor-pointer"
                >
                  <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-200 flex items-center justify-center">
                        <RotateCcw className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-sm font-medium text-slate-900 leading-tight">
                        Returns
                      </h3>
                    </div>
                  </div>
                </div>
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
                        <Package className="h-6 w-6 text-white" />
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
                  onClick={() => setCurrentPage("ml-groups")}
                  className="group cursor-pointer"
                >
                  <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-cyan-200 flex items-center justify-center">
                        <Layers className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-sm font-medium text-slate-900 leading-tight">
                        ML Groups & Aliases
                      </h3>
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => setCurrentPage("manage-events")}
                  className="group cursor-pointer"
                >
                  <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-6 h-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-purple-200 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-sm font-medium text-slate-900 leading-tight">
                        Manage Events
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        case "manage-products":
          return <ManageProductsPage onBack={() => setCurrentPage("developer")} />;
        case "manage-decorations":
          return <ManageDecorationsPage onBack={() => setCurrentPage("developer")} />;
        case "manage-stock":
          return <AdminStockManagementPage onBack={() => setCurrentPage("developer")} />;
        case "edit-sales":
          return <AddSalesPage onBack={() => setCurrentPage("developer")} />;
        case "ml-groups":
          return <MLGroupsPage onBack={() => setCurrentPage("developer")} />;
        case "manage-events":
          return <ManageEventsPage onBack={() => setCurrentPage("developer")} />;
        default:
          return (
            <div className="h-full bg-white flex items-center justify-center">
              {/* Dashboard Grid */}
              <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto p-6">
                {dashboardItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      onClick={() => !item.disabled && setCurrentPage(item.page)}
                      className={`group ${item.disabled ? "opacity-50" : "cursor-pointer"}`}
                    >
                      <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg transition-all duration-200 p-4 sm:p-6 h-full">
                        <div className="flex flex-col items-center text-center space-y-4">
                          {/* Icon */}
                          <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          
                          {/* Title */}
                          <h3 className="text-sm font-medium text-slate-900 leading-tight">
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
    } catch (error) {
      return (
        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Error</h2>
            <p className="text-red-500 mb-4">Failed to load page: {String(error)}</p>
            <Button 
              onClick={() => setCurrentPage("dashboard")}
              className="bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
            >
              Return to Dashboard
            </Button>
          </div>
        </main>
      );
    }
  };

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
                  <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Staff Dashboard</h1>
                </div>
                <p className="text-sm sm:text-base text-slate-600 truncate">Welcome back, {user?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none">
                <DateSelector selectedDate={selectedDate} onDateChange={() => {}} disabled={true} />
              </div>
              {user?.isDemo && (
                <Button 
                  variant="outline" 
                  onClick={onSwitchToUser}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-purple-600 transition-all duration-200 flex-shrink-0"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                  <span className="sm:hidden">Admin</span>
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={logout} 
                className="flex items-center gap-2 bg-white hover:bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-black transition-all duration-200 flex-shrink-0"
              >
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