// File: components/credit-notes-page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Calendar, Search, Eye, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";

interface CreditNote {
  id: number;
  creditNoteNumber: string;
  date: string;
  returnDate?: string;
  receiverName: string;
  receiverGstin: string;
  reason: string;
  totalItems: number;
  grossValue: number;
  netValue: number;
  fileName: string;
  originalName: string;
  createdAt: string;
}

interface CreditNotesPageProps {
  onBack: () => void;
  onViewCreditNote: (creditNoteId: number, selectedMonth: string) => void;
  initialMonth?: string;
}

export default function CreditNotesPage({ onBack, onViewCreditNote, initialMonth }: CreditNotesPageProps) {
  const { user, loading } = useAuth();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [filteredCreditNotes, setFilteredCreditNotes] = useState<CreditNote[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || ""); // Empty string means show all months
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchCreditNotes = async () => {
    setIsLoading(true);
    setError("");

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const url = selectedMonth 
        ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credit-notes?month=${selectedMonth}`
        : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credit-notes`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch credit notes");
      }

      const data = await response.json();
      if (data.success) {
        setCreditNotes(data.creditNotes);
        setFilteredCreditNotes(data.creditNotes);
      } else {
        throw new Error(data.error || "Failed to fetch credit notes");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch credit notes");
      setCreditNotes([]);
      setFilteredCreditNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, [selectedMonth]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredCreditNotes(creditNotes);
    } else {
      const filtered = creditNotes.filter(
        (creditNote) =>
          creditNote.creditNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          creditNote.receiverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          creditNote.reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCreditNotes(filtered);
    }
  }, [searchTerm, creditNotes]);

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

  const totalCreditNotes = filteredCreditNotes.length;
  const totalValue = filteredCreditNotes.reduce((sum, cn) => {
    const value = typeof cn.netValue === 'string' ? parseFloat(cn.netValue) : cn.netValue || 0;
    return sum + value;
  }, 0);
  const totalItems = filteredCreditNotes.reduce((sum, cn) => {
    const items = typeof cn.totalItems === 'string' ? parseInt(cn.totalItems) : cn.totalItems || 0;
    return sum + items;
  }, 0);

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
                <CreditCard className="h-5 w-5" />
                Credit Notes
              </h1>
              <p className="text-slate-600 text-sm sm:text-base">
                {selectedMonth 
                  ? `Manage and view all credit notes for ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                  : 'Manage and view all credit notes'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 w-[160px] bg-white border-slate-300 focus:border-slate-500"
              max={new Date().toISOString().slice(0, 7)}
              placeholder="All Months"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">

        {/* Search */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 h-4 w-4" />
              <Input
                placeholder="Search by credit note number, receiver, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-slate-300 focus:border-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalCreditNotes}</div>
                <div className="text-sm text-slate-600">Credit Notes</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</div>
                <div className="text-sm text-slate-600">Total Value</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalItems}</div>
                <div className="text-sm text-slate-600">Total Items</div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-red-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Credit Notes Table */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Credit Notes List</h2>
            <p className="text-slate-600 mt-1 text-sm">
              {isLoading ? "Loading credit notes..." : `${totalCreditNotes} credit note(s) found`}
            </p>
          </div>
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading credit notes...
              </div>
            ) : filteredCreditNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No credit notes found matching your search" : "No credit notes found for this month"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Credit Note #</TableHead>
                      <TableHead>Return Date</TableHead>
                      <TableHead>Receiver</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCreditNotes.map((creditNote) => (
                      <TableRow key={creditNote.id}>
                        <TableCell className="font-mono font-medium">
                          {creditNote.creditNoteNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatDate(creditNote.returnDate || creditNote.date)}</div>
                            <div className="text-xs text-muted-foreground">
                              Credit Note: {formatDate(creditNote.date)}
                            </div>
                          </div>
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
                        <TableCell className="font-medium">{formatCurrency(creditNote.netValue || 0)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewCreditNote(creditNote.id, selectedMonth)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
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
    </main>
  );
}
