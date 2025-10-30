"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CreditCard, FileText, Calendar, Search, Filter, Eye, CheckCircle, Clock, X } from "lucide-react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";
import { formatDisplayDate } from "@/lib/dateUtils";

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  store: string;
  total_amount: number;
  file_reference: string;
  uploaded_at: string;
  status?: 'pending' | 'cleared';
  items?: InvoiceItem[];
}

interface InvoiceItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CreditNote {
  id: number;
  creditNoteNumber: string;
  date: string;
  returnDate: string;
  receiverName: string;
  receiverGstin: string;
  reason: string;
  totalItems: number;
  grossValue: number;
  netValue: number;
  fileName: string;
  originalName: string;
  items: any[];
  createdAt: string;
  status?: 'pending' | 'cleared';
}

interface RosReceipt {
  id: number;
  receiptNumber: string;
  receiptDate: string;
  receivedFrom: string;
  totalAmount: number;
  paymentMethod: string;
  bills: Array<{
    doc_type: string;
    bill_date: string;
    bill_number: string;
    amount: number;
    dr_cr: string;
  }>;
  fileName: string;
  originalName: string;
  createdAt: string;
}

interface PaymentsPageProps {
  onBack: () => void;
}

export function PaymentsPage({ onBack }: PaymentsPageProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'invoices' | 'credit-notes' | 'ros-receipts'>('invoices');
  const [invoicesSubTab, setInvoicesSubTab] = useState<'invoices' | 'others'>('invoices');
  const [creditNotesSubTab, setCreditNotesSubTab] = useState<'credit-notes' | 'others'>('credit-notes');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [rosReceipts, setRosReceipts] = useState<RosReceipt[]>([]);
  const [invoicesFromRos, setInvoicesFromRos] = useState<Invoice[]>([]);
  const [creditNotesFromRos, setCreditNotesFromRos] = useState<CreditNote[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Get current month and year for dropdown options
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Generate month options (current year only)
  const monthOptions = Array.from({ length: currentMonth }, (_, i) => {
    const monthNumber = i + 1;
    const monthName = new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'long' });
    return { value: monthNumber, label: monthName };
  });

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchCreditNotes();
      fetchRosReceipts();
      fetchInvoicesFromRos();
      fetchCreditNotesFromRos();
    }
  }, [user, selectedMonth, selectedYear]);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/invoices?month=${selectedMonth}&year=${selectedYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.status}`);
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCreditNotes = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      const token = getAuthToken();
      if (!token) {
        setError("Authentication token not found");
        return;
      }

      // Use the same API endpoint as staff dashboard
      const monthStr = selectedMonth.toString().padStart(2, '0');
      const yearStr = selectedYear.toString();
      const monthYear = `${yearStr}-${monthStr}`;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credit-notes?month=${monthYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Credit notes API response:", data);
      
      if (data.success) {
        // Use the same data structure as staff dashboard
        const creditNotes = data.creditNotes || [];
        console.log("Credit notes data:", creditNotes);
        console.log("First credit note items:", creditNotes[0]?.items);
        setCreditNotes(creditNotes);
      } else {
        setError(data.error || "Failed to fetch credit notes");
        setCreditNotes([]);
      }
    } catch (err: any) {
      console.error("Error fetching credit notes:", err);
      setError(err.message || "Failed to fetch credit notes");
      setCreditNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRosReceipts = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      const token = getAuthToken();
      if (!token) {
        setError("Authentication token not found");
        return;
      }

      const monthStr = selectedMonth.toString().padStart(2, '0');
      const yearStr = selectedYear.toString();
      const monthYear = `${yearStr}-${monthStr}`;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/ros-receipts?month=${monthYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("ROS receipts API response:", data);
      
      if (data.success) {
        setRosReceipts(data.rosReceipts || []);
      } else {
        setError(data.error || "Failed to fetch ROS receipts");
        setRosReceipts([]);
      }
    } catch (err: any) {
      console.error("Error fetching ROS receipts:", err);
      setError(err.message || "Failed to fetch ROS receipts");
      setRosReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvoicesFromRos = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/invoices/from-ros-receipts?month=${selectedMonth}&year=${selectedYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices from ROS receipts: ${response.status}`);
      }

      const data = await response.json();
      setInvoicesFromRos(data.invoices || []);
    } catch (err: any) {
      console.error("Error fetching invoices from ROS receipts:", err);
      setInvoicesFromRos([]);
    }
  };

  const fetchCreditNotesFromRos = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credit-notes/from-ros-receipts?month=${selectedMonth}&year=${selectedYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch credit notes from ROS receipts: ${response.status}`);
      }

      const data = await response.json();
      setCreditNotesFromRos(data.creditNotes || []);
    } catch (err: any) {
      console.error("Error fetching credit notes from ROS receipts:", err);
      setCreditNotesFromRos([]);
    }
  };

  const updateInvoiceStatus = async (invoiceId: number, status: 'pending' | 'cleared') => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/invoices/${invoiceId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Update local state
        setInvoices(prev => prev.map(inv => 
          inv.id === invoiceId ? { ...inv, status } : inv
        ));
        if (selectedInvoice?.id === invoiceId) {
          setSelectedInvoice(prev => prev ? { ...prev, status } : null);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);

  const viewCreditNote = (creditNote: CreditNote) => {
    setSelectedCreditNote(creditNote);
    setShowCreditNoteModal(true);
  };

  const [selectedRosReceipt, setSelectedRosReceipt] = useState<RosReceipt | null>(null);
  const [showRosReceiptModal, setShowRosReceiptModal] = useState(false);

  const viewRosReceipt = (receipt: RosReceipt) => {
    setSelectedRosReceipt(receipt);
    setShowRosReceiptModal(true);
  };

  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const viewInvoiceDetails = async (invoice: Invoice) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/invoices/${invoice.id}/items`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedInvoiceDetails({ ...invoice, items: data.items || [] });
        setShowInvoiceModal(true);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'cleared' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  };

  const getStatusIcon = (status: string) => {
    return status === 'cleared' ? CheckCircle : Clock;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getReasonColor = (reason: string) => {
    if (reason.toLowerCase().includes('expired')) {
      return 'bg-red-100 text-red-800';
    } else if (reason.toLowerCase().includes('damaged')) {
      return 'bg-orange-100 text-orange-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };


  return (
    <>
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
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Payments</h1>
              <p className="text-slate-600 text-sm sm:text-base">Manage invoices and credit notes</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="w-40 bg-white border-slate-300 focus:border-slate-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-24 bg-white border-slate-300 focus:border-slate-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-4 sm:mb-6 bg-slate-100 p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === 'invoices' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('invoices')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <FileText className="h-4 w-4" />
            Invoices
          </Button>
          <Button
            variant={activeTab === 'credit-notes' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('credit-notes')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <CreditCard className="h-4 w-4" />
            Credit Notes
          </Button>
          <Button
            variant={activeTab === 'ros-receipts' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('ros-receipts')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <FileText className="h-4 w-4" />
            ROS Receipts
          </Button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'invoices' ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {invoicesSubTab === 'invoices' ? 'Invoices' : 'Invoices from ROS Receipts'} for {monthOptions[selectedMonth - 1]?.label} {selectedYear}
                </h2>
                <Badge variant="outline" className="bg-white border-slate-300 text-slate-700">
                  {invoicesSubTab === 'invoices' ? invoices.length : invoicesFromRos.length} invoices
                </Badge>
              </div>
            </div>

            {/* Sub-tab Navigation for Invoices */}
            <div className="flex space-x-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
              <Button
                variant={invoicesSubTab === 'invoices' ? 'default' : 'ghost'}
                onClick={() => setInvoicesSubTab('invoices')}
                className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <FileText className="h-4 w-4" />
                Invoices
              </Button>
              <Button
                variant={invoicesSubTab === 'others' ? 'default' : 'ghost'}
                onClick={() => setInvoicesSubTab('others')}
                className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <FileText className="h-4 w-4" />
                Others
              </Button>
            </div>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500 mx-auto"></div>
                <p className="mt-2 text-slate-600">Loading invoices...</p>
              </div>
            ) : (invoicesSubTab === 'invoices' ? invoices.length === 0 : invoicesFromRos.length === 0) ? (
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-8 text-center">
                <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">
                  {invoicesSubTab === 'invoices' ? 'No invoices found for this month' : 'No invoices from ROS receipts found for this month'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {(invoicesSubTab === 'invoices' ? invoices : invoicesFromRos).map((invoice) => {
                  const StatusIcon = getStatusIcon(invoice.status || 'pending');
                  return (
                    <div key={invoice.id} className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg hover:shadow-xl transition-shadow p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-slate-900">#{invoice.invoice_number}</h3>
                        <Badge className={getStatusColor(invoice.status || 'pending')}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {invoice.status || 'pending'}
                        </Badge>
                      </div>
                      <p className="text-slate-600 mb-4">{invoice.store}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">Amount:</span>
                          <span className="font-semibold text-slate-900">₹{invoice.total_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">Invoice Date:</span>
                          <span className="text-sm text-slate-900">{formatDisplayDate(invoice.invoice_date)}</span>
                        </div>
                        {invoicesSubTab === 'others' && (
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-600">Source:</span>
                            <span className="text-sm text-blue-600 font-medium">ROS Receipt</span>
                          </div>
                        )}
                        <div className="pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewInvoiceDetails(invoice)}
                            className="w-full bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'credit-notes' ? (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <div className="relative max-w-2xl mx-auto">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-500" />
                </div>
                <Input
                  type="text"
                  placeholder="Search by credit note number, date, receiver, or reason..."
                  className="pl-12 pr-4 py-3 text-lg border-2 border-slate-300 rounded-xl bg-white focus:ring-4 focus:ring-slate-500/20 focus:border-slate-500 transition-all duration-200"
                />
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {creditNotesSubTab === 'credit-notes' ? creditNotes.length : creditNotesFromRos.length}
                    </div>
                    <div className="text-sm text-slate-600">
                      {creditNotesSubTab === 'credit-notes' ? 'Credit Notes' : 'Credit Notes from ROS'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {(() => {
                        const dataSource = creditNotesSubTab === 'credit-notes' ? creditNotes : creditNotesFromRos;
                        const totalGross = dataSource.reduce((sum, cn) => {
                          // Calculate gross value from items if not available
                          let grossValue = 0;
                          if (cn.grossValue && !isNaN(cn.grossValue)) {
                            grossValue = cn.grossValue;
                          } else if (cn.items && Array.isArray(cn.items)) {
                            grossValue = cn.items.reduce((total, item) => {
                              const itemTotal = item.total || 0;
                              return total + (isNaN(itemTotal) ? 0 : itemTotal);
                            }, 0);
                          }
                          return sum + (isNaN(grossValue) ? 0 : grossValue);
                        }, 0);
                        return formatCurrency(isNaN(totalGross) ? 0 : totalGross);
                      })()}
                    </div>
                    <div className="text-sm text-slate-600">Total Gross</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-red-600">
                      {formatCurrency((creditNotesSubTab === 'credit-notes' ? creditNotes : creditNotesFromRos).reduce((sum, cn) => {
                        const totalLoss = cn.items?.reduce((loss, item) => {
                          const rtdPercentage = item.rtd || 0;
                          return loss + ((item.total * rtdPercentage) / 100);
                        }, 0) || 0;
                        return sum + totalLoss;
                      }, 0))}
                    </div>
                    <div className="text-sm text-slate-600">Total Loss</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-green-600">
                      {formatCurrency((creditNotesSubTab === 'credit-notes' ? creditNotes : creditNotesFromRos).reduce((sum, cn) => {
                        // Calculate gross value from items if not available
                        let grossValue = 0;
                        if (cn.grossValue && !isNaN(cn.grossValue)) {
                          grossValue = cn.grossValue;
                        } else if (cn.items && Array.isArray(cn.items)) {
                          grossValue = cn.items.reduce((total, item) => {
                            const itemTotal = item.total || 0;
                            return total + (isNaN(itemTotal) ? 0 : itemTotal);
                          }, 0);
                        }
                        
                        const totalLoss = cn.items?.reduce((loss, item) => {
                          const rtdPercentage = item.rtd || 0;
                          const itemTotal = item.total || 0;
                          return loss + ((itemTotal * rtdPercentage) / 100);
                        }, 0) || 0;
                        
                        const receivable = (isNaN(grossValue) ? 0 : grossValue) - (isNaN(totalLoss) ? 0 : totalLoss);
                        return sum + (isNaN(receivable) ? 0 : receivable);
                      }, 0))}
                    </div>
                    <div className="text-sm text-slate-600">Total Receivable</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="text-red-600 font-medium">Error:</div>
                  <div className="text-red-700">{error}</div>
                </div>
              </div>
            )}

            {/* Sub-tab Navigation for Credit Notes */}
            <div className="flex space-x-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
              <Button
                variant={creditNotesSubTab === 'credit-notes' ? 'default' : 'ghost'}
                onClick={() => setCreditNotesSubTab('credit-notes')}
                className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <CreditCard className="h-4 w-4" />
                Credit Notes
              </Button>
              <Button
                variant={creditNotesSubTab === 'others' ? 'default' : 'ghost'}
                onClick={() => setCreditNotesSubTab('others')}
                className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <CreditCard className="h-4 w-4" />
                Others
              </Button>
            </div>

            {/* Credit Notes Table */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">
                  {creditNotesSubTab === 'credit-notes' ? 'Credit Notes List' : 'Credit Notes from ROS Receipts'}
                </h2>
                <p className="text-slate-600 mt-1 text-sm">
                  {isLoading ? "Loading credit notes..." : `${creditNotesSubTab === 'credit-notes' ? creditNotes.length : creditNotesFromRos.length} credit note(s) found`}
                </p>
              </div>
              <div className="p-4 sm:p-6">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading credit notes...
                  </div>
                ) : (creditNotesSubTab === 'credit-notes' ? creditNotes.length === 0 : creditNotesFromRos.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {creditNotesSubTab === 'credit-notes' ? 'No credit notes found for this month' : 'No credit notes from ROS receipts found for this month'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Credit Note #</TableHead>
                          <TableHead>Credit Note Date</TableHead>
                          <TableHead>Receiver</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Loss</TableHead>
                          <TableHead>Receivable</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(creditNotesSubTab === 'credit-notes' ? creditNotes : creditNotesFromRos).map((creditNote) => {
                          const StatusIcon = getStatusIcon(creditNote.status || 'pending');
                          
                          // Calculate total loss from items
                          const totalLoss = creditNote.items?.reduce((loss, item) => {
                            const rtdPercentage = item.rtd || 0;
                            return loss + ((item.total * rtdPercentage) / 100);
                          }, 0) || 0;
                          
                          // Calculate gross value from items if not available
                          let grossValue = 0;
                          if (creditNote.grossValue && !isNaN(creditNote.grossValue)) {
                            grossValue = creditNote.grossValue;
                          } else if (creditNote.items && Array.isArray(creditNote.items)) {
                            grossValue = creditNote.items.reduce((total, item) => {
                              const itemTotal = item.total || 0;
                              return total + (isNaN(itemTotal) ? 0 : itemTotal);
                            }, 0);
                          }
                          // Calculate receivable (gross - loss)
                          const receivable = (isNaN(grossValue) ? 0 : grossValue) - (isNaN(totalLoss) ? 0 : totalLoss);
                          
                          return (
                            <TableRow key={creditNote.id}>
                              <TableCell className="font-mono font-medium">
                                {creditNote.creditNoteNumber}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{formatDate(creditNote.date)}</div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{creditNote.receiverName}</div>
                                  <div className="text-xs text-muted-foreground">{creditNote.receiverGstin}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${getReasonColor(creditNote.reason)} border-0`} variant="secondary">
                                  {creditNote.reason}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{creditNote.totalItems || 0}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(isNaN(grossValue) ? 0 : grossValue)}</TableCell>
                              <TableCell className="font-medium text-red-600">{formatCurrency(totalLoss)}</TableCell>
                              <TableCell className="font-medium text-green-600">{formatCurrency(receivable)}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(creditNote.status || 'pending')}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {creditNote.status || 'pending'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => viewCreditNote(creditNote)}
                                  className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'ros-receipts' ? (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <div className="relative max-w-2xl mx-auto">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-500" />
                </div>
                <Input
                  type="text"
                  placeholder="Search by receipt number, received from, or amount..."
                  className="pl-12 pr-4 py-3 text-lg border-2 border-slate-300 rounded-xl bg-white focus:ring-4 focus:ring-slate-500/20 focus:border-slate-500 transition-all duration-200"
                />
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">{rosReceipts.length}</div>
                    <div className="text-sm text-slate-600">ROS Receipts</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                   <div className="text-xl sm:text-2xl font-bold text-slate-900">
                     {formatCurrency(rosReceipts.reduce((sum, receipt) => sum + (receipt.totalAmount || 0), 0))}
                   </div>
                    <div className="text-sm text-slate-600">Total Amount</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {rosReceipts.reduce((sum, receipt) => sum + (receipt.bills?.length || 0), 0)}
                    </div>
                    <div className="text-sm text-slate-600">Total Bills</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                     {rosReceipts.filter(receipt => {
                       const receiptDate = new Date(receipt.receiptDate);
                       const today = new Date();
                       return receiptDate.toDateString() === today.toDateString();
                     }).length}
                    </div>
                    <div className="text-sm text-slate-600">Today's Receipts</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROS Receipts Table */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">ROS Receipts List</h2>
                <p className="text-slate-600 mt-1 text-sm">
                  {isLoading ? "Loading ROS receipts..." : `${rosReceipts.length} receipt(s) found`}
                </p>
              </div>
              <div className="p-4 sm:p-6">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading ROS receipts...
                  </div>
                ) : rosReceipts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No ROS receipts found for this month
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Bills</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead>View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rosReceipts.map((receipt) => (
                         <TableRow key={receipt.id}>
                           <TableCell className="font-mono font-medium">
                             {receipt.receiptNumber}
                           </TableCell>
                           <TableCell>
                             <div className="font-medium">{formatDate(receipt.receiptDate)}</div>
                           </TableCell>
                           <TableCell className="font-medium text-green-600">
                             {formatCurrency(receipt.totalAmount)}
                           </TableCell>
                           <TableCell className="font-medium">
                             {receipt.bills?.length || 0}
                           </TableCell>
                           <TableCell>
                             <Badge className="bg-blue-100 text-blue-800 border-0" variant="secondary">
                               {receipt.paymentMethod}
                             </Badge>
                           </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => viewRosReceipt(receipt)}
                                className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
    </main>

    {/* Invoice Details Modal */}
    <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Invoice Details
          </DialogTitle>
        </DialogHeader>
        
        {selectedInvoiceDetails && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Invoice Header */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Invoice Information</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Invoice #:</span>
                      <span className="font-mono font-medium">{selectedInvoiceDetails.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Store:</span>
                      <span className="font-medium">{selectedInvoiceDetails.store}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Date:</span>
                      <span className="font-medium">{formatDisplayDate(selectedInvoiceDetails.invoice_date)}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Financial Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Amount:</span>
                      <span className="text-xl font-bold text-green-600">{formatCurrency(selectedInvoiceDetails.total_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Status:</span>
                      <Badge className={getStatusColor(selectedInvoiceDetails.status || 'pending')}>
                        {selectedInvoiceDetails.status === 'cleared' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                        {selectedInvoiceDetails.status || 'pending'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Uploaded:</span>
                      <span className="text-sm">{formatDisplayDate(selectedInvoiceDetails.uploaded_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Invoice Items ({selectedInvoiceDetails.items?.length || 0})</h3>
              </div>
              <div className="p-4 sm:p-6">
                {selectedInvoiceDetails.items && selectedInvoiceDetails.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">Product</TableHead>
                          <TableHead className="text-xs sm:text-sm">Qty</TableHead>
                          <TableHead className="text-xs sm:text-sm">Unit Price</TableHead>
                          <TableHead className="text-xs sm:text-sm">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoiceDetails.items.map((item, index) => (
                          <TableRow key={item.id || index}>
                            <TableCell className="text-xs sm:text-sm">
                              <div className="font-medium">{item.product_name || 'Unknown Product'}</div>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{item.quantity || 0}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{formatCurrency(item.unit_price || 0)}</TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm">{formatCurrency(item.total_price || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-slate-600 text-center py-4">No items found</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => updateInvoiceStatus(
                    selectedInvoiceDetails.id, 
                    (selectedInvoiceDetails.status || 'pending') === 'pending' ? 'cleared' : 'pending'
                  )}
                  className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                >
                  {(selectedInvoiceDetails.status || 'pending') === 'pending' ? 'Mark as Cleared' : 'Mark as Pending'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInvoiceModal(false)}
                  className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
        
    {/* Credit Note Details Modal */}
    <Dialog open={showCreditNoteModal} onOpenChange={setShowCreditNoteModal}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Credit Note Details
          </DialogTitle>
        </DialogHeader>
        
        {selectedCreditNote && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Credit Note Header */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Credit Note Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Credit Note #:</span>
                    <span className="font-mono font-medium">{selectedCreditNote.creditNoteNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date:</span>
                    <span className="font-medium">{formatDate(selectedCreditNote.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Status:</span>
                    <Badge className={getStatusColor(selectedCreditNote.status || 'pending')}>
                      {selectedCreditNote.status === 'cleared' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                      {selectedCreditNote.status || 'pending'}
                    </Badge>
                  </div>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Reason:</span>
                    <Badge className={`${getReasonColor(selectedCreditNote.reason)} border-0`} variant="secondary">
                      {selectedCreditNote.reason}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Items ({selectedCreditNote.totalItems})</h3>
              </div>
              <div className="p-4 sm:p-6">
                {selectedCreditNote.items && selectedCreditNote.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">Description</TableHead>
                          <TableHead className="text-xs sm:text-sm">Qty</TableHead>
                          <TableHead className="text-xs sm:text-sm">Rate</TableHead>
                          <TableHead className="text-xs sm:text-sm">Total</TableHead>
                          <TableHead className="text-xs sm:text-sm">RTD %</TableHead>
                          <TableHead className="text-xs sm:text-sm">Loss</TableHead>
                          <TableHead className="text-xs sm:text-sm">Receivable</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCreditNote.items.map((item, index) => {
                          const rtdPercentage = item.rtd || 0;
                          const lossAmount = (item.total * rtdPercentage) / 100;
                          const receivable = item.total - lossAmount;
                          return (
                            <TableRow key={index}>
                              <TableCell className="text-xs sm:text-sm">
                                <div className="font-medium">{item.description}</div>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm">{item.quantity}</TableCell>
                              <TableCell className="text-xs sm:text-sm">{formatCurrency(item.rate)}</TableCell>
                              <TableCell className="font-medium text-xs sm:text-sm">{formatCurrency(item.total)}</TableCell>
                              <TableCell className="text-xs sm:text-sm text-red-600">{rtdPercentage}%</TableCell>
                              <TableCell className="font-medium text-xs sm:text-sm text-red-600">{formatCurrency(lossAmount)}</TableCell>
                              <TableCell className="font-medium text-xs sm:text-sm text-green-600">{formatCurrency(receivable)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-slate-600 text-center py-4">No items found</p>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 sm:mb-4">Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-slate-900">{selectedCreditNote.totalItems}</div>
                  <div className="text-sm text-slate-600">Items</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-600">
                    {formatCurrency(
                      selectedCreditNote.items?.reduce((totalGross, item) => {
                        return totalGross + (item.total || 0);
                      }, 0) || 0
                    )}
                  </div>
                  <div className="text-sm text-slate-600">Total Gross</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-red-600">
                    {formatCurrency(
                      selectedCreditNote.items?.reduce((totalLoss, item) => {
                        const rtdPercentage = item.rtd || 0;
                        return totalLoss + ((item.total * rtdPercentage) / 100);
                      }, 0) || 0
                    )}
                  </div>
                  <div className="text-sm text-slate-600">Total Loss</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-green-600">
                    {formatCurrency(
                      selectedCreditNote.items?.reduce((totalReceivable, item) => {
                        const rtdPercentage = item.rtd || 0;
                        const lossAmount = (item.total * rtdPercentage) / 100;
                        const receivable = item.total - lossAmount;
                        return totalReceivable + receivable;
                      }, 0) || 0
                    )}
                  </div>
                  <div className="text-sm text-slate-600">Receivable</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* ROS Receipt Details Modal */}
    <Dialog open={showRosReceiptModal} onOpenChange={setShowRosReceiptModal}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            ROS Receipt Details
          </DialogTitle>
        </DialogHeader>
        
        {selectedRosReceipt && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Receipt Header */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Receipt Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="flex justify-between">
                       <span className="text-slate-600">Receipt #:</span>
                       <span className="font-mono font-medium">{selectedRosReceipt.receiptNumber}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-slate-600">Date:</span>
                       <span className="font-medium">{formatDate(selectedRosReceipt.receiptDate)}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-slate-600">Payment Method:</span>
                       <Badge className="bg-blue-100 text-blue-800 border-0" variant="secondary">
                         {selectedRosReceipt.paymentMethod}
                       </Badge>
                     </div>
                   </div>
                   <div className="pt-2">
                     <div className="flex justify-between items-center">
                       <span className="text-slate-600">Total Amount:</span>
                       <span className="text-xl font-bold text-green-600">{formatCurrency(selectedRosReceipt.totalAmount)}</span>
                     </div>
                   </div>
              </div>
            </div>

            {/* Bills Table */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Bills ({selectedRosReceipt.bills?.length || 0})</h3>
              </div>
              <div className="p-4 sm:p-6">
                {selectedRosReceipt.bills && selectedRosReceipt.bills.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">Doc Type</TableHead>
                          <TableHead className="text-xs sm:text-sm">Bill Date</TableHead>
                          <TableHead className="text-xs sm:text-sm">Bill Number</TableHead>
                          <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                          <TableHead className="text-xs sm:text-sm">Dr/Cr</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRosReceipt.bills.map((bill, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-xs sm:text-sm">
                              <Badge className={`${bill.doc_type === 'CN' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'} border-0`} variant="secondary">
                                {bill.doc_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{formatDate(bill.bill_date)}</TableCell>
                            <TableCell className="font-mono text-xs sm:text-sm">{bill.bill_number}</TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm">{formatCurrency(bill.amount)}</TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              <Badge className={`${bill.dr_cr === 'Cr' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'} border-0`} variant="secondary">
                                {bill.dr_cr}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-slate-600 text-center py-4">No bills found</p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

