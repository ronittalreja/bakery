// File: components/credit-note-details-page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Calendar, FileText, Building, AlertTriangle } from "lucide-react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";

interface CreditNoteItem {
  itemCode: string;
  description: string;
  hsnCode: string;
  quantity: number;
  rate: number;
  total: number;
  rtd: number;
}

interface CreditNoteDetails {
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
  items: CreditNoteItem[];
  createdAt: string;
}

interface CreditNoteDetailsPageProps {
  creditNoteId: number;
  selectedMonth: string;
  onBack: (selectedMonth: string) => void;
}

export default function CreditNoteDetailsPage({ creditNoteId, selectedMonth, onBack }: CreditNoteDetailsPageProps) {
  const { user, loading } = useAuth();
  const [creditNote, setCreditNote] = useState<CreditNoteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchCreditNoteDetails = async () => {
    setIsLoading(true);
    setError("");

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credit-notes/${creditNoteId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch credit note details");
      }

      const data = await response.json();
      if (data.success) {
        setCreditNote(data.creditNote);
      } else {
        throw new Error(data.error || "Failed to fetch credit note details");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch credit note details");
      setCreditNote(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNoteDetails();
  }, [creditNoteId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  const getRtdColor = (rtd: number) => {
    return rtd === 15.00 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
  };

  const getRtdLabel = (rtd: number) => {
    return rtd === 15.00 ? 'GRM' : 'GVN';
  };

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-lg font-semibold mb-2">Loading credit note details...</div>
          <div className="text-muted-foreground">Please wait while we fetch the information</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!creditNote) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-lg font-semibold mb-2">Credit note not found</div>
          <div className="text-muted-foreground">The requested credit note could not be found</div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => onBack(selectedMonth)} className="flex items-center gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Credit Notes
        </Button>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Credit Note Details
                </CardTitle>
                <CardDescription>
                  Credit Note #{creditNote.creditNoteNumber} - Return Date: {formatDate(creditNote.returnDate || creditNote.date)}
                </CardDescription>
              </div>
              <Badge className={`${getReasonColor(creditNote.reason)} border-0`} variant="secondary">
                {creditNote.reason}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Credit Note Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Credit Note Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Credit Note Number</div>
                  <div className="font-mono font-semibold">{creditNote.creditNoteNumber}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Return Date</div>
                  <div className="font-semibold">{formatDate(creditNote.returnDate)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Credit Note Date</div>
                  <div className="font-semibold">{formatDate(creditNote.date)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Items</div>
                  <div className="font-semibold">{creditNote.totalItems}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Net Value</div>
                  <div className="font-semibold">{formatCurrency(creditNote.netValue)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Receiver Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Receiver Name</div>
                <div className="font-semibold">{creditNote.receiverName}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">GSTIN</div>
                <div className="font-mono text-sm">{creditNote.receiverGstin}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">File Name</div>
                <div className="text-sm text-muted-foreground">{creditNote.originalName}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Credit Note Items
            </CardTitle>
            <CardDescription>
              {creditNote.items.length} item(s) in this credit note
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>HSN Code</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>RTD</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNote.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="font-mono text-sm">{item.hsnCode}</TableCell>
                      <TableCell className="font-medium">{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(item.total)}</TableCell>
                      <TableCell>
                        <Badge className={`${getRtdColor(item.rtd)} border-0`} variant="secondary">
                          {item.rtd}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getRtdColor(item.rtd)} border-0`} variant="secondary">
                          {getRtdLabel(item.rtd)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{creditNote.totalItems}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Items</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(creditNote.grossValue)}</div>
                <div className="text-sm text-muted-foreground mt-1">Gross Value</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(creditNote.netValue)}</div>
                <div className="text-sm text-muted-foreground mt-1">Net Value</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
