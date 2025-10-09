"use client";

import { useState } from "react";
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
} from "lucide-react";
import { UploadInvoicePage } from "@/components/upload-invoice-page";
import { RecordSalePage } from "@/components/record-sale-page";
import { TodaysStockPage } from "@/components/todays-stock-page"; // Ensure this file exists and has a default export
import { TodaysSalesPage } from "@/components/todays-sales-page";
import { ReturnsPage } from "@/components/newreturns";
import CreditNotesPage from "@/components/credit-notes-page";
import CreditNoteDetailsPage from "@/components/credit-note-details-page";

type StaffPage = "dashboard" | "upload-invoice" | "record-sale" | "stock" | "sales-summary" | "returns" | "credit-notes" | "credit-note-details";

export function StaffDashboard() {
  const { user, logout } = useAuth();
  const { selectedDate, isToday, isDayEnded } = useDateContext();
  const [currentPage, setCurrentPage] = useState<StaffPage>("dashboard");
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<number | null>(null);
  const [selectedCreditNoteMonth, setSelectedCreditNoteMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Debug imports
  console.log({
    UploadInvoicePage,
    RecordSalePage,
    TodaysStockPage,
    TodaysSalesPage,
    ReturnsPage,
  });

  const dashboardItems = [
    {
      title: "Upload",
      description: "Add stock from van invoice",
      icon: Upload,
      page: "upload-invoice" as StaffPage,
      color: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200",
      disabled: !isToday || isDayEnded,
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
      title: "Record Sale",
      description: "Record customer purchases and special cakes",
      icon: ShoppingCart,
      page: "record-sale" as StaffPage,
      color: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-200",
      disabled: !isToday || isDayEnded,
    },
    {
      title: "Sales Timeline",
      description: "View sales by date",
      icon: BarChart3,
      page: "sales-summary" as StaffPage,
      color: "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-cyan-200",
      disabled: false,
    },
    {
      title: "Returns",
      description: "Process GRM and GVN returns",
      icon: RotateCcw,
      page: "returns" as StaffPage,
      color: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-200",
      disabled: !isToday || isDayEnded,
    },
    {
      title: "Credit Notes",
      description: "View and manage credit notes",
      icon: CreditCard,
      page: "credit-notes" as StaffPage,
      color: "bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-teal-200",
      disabled: false,
    },
  ];

  const renderPage = () => {
    try {
      switch (currentPage) {
        case "upload-invoice":
          if (!UploadInvoicePage) throw new Error("UploadInvoicePage is undefined");
          return <UploadInvoicePage onBack={() => setCurrentPage("dashboard")} />;
        case "record-sale":
          if (!RecordSalePage) throw new Error("RecordSalePage is undefined");
          return <RecordSalePage onBack={() => setCurrentPage("dashboard")} />;
        case "stock":
          if (!TodaysStockPage) throw new Error("TodaysStockPage is undefined");
          return <TodaysStockPage onBack={() => setCurrentPage("dashboard")} />;
        case "sales-summary":
          if (!TodaysSalesPage) throw new Error("TodaysSalesPage is undefined");
          return <TodaysSalesPage onBack={() => setCurrentPage("dashboard")} />;
        case "returns":
          if (!ReturnsPage) throw new Error("ReturnsPage is undefined");
          return <ReturnsPage onBack={() => setCurrentPage("dashboard")} />;
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
      console.error("Error rendering page:", error);
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
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Staff Dashboard</h1>
                <p className="text-sm sm:text-base text-slate-600 truncate">Welcome back, {user?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
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