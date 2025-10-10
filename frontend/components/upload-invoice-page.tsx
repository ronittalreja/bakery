// File: src/pages/UploadInvoicePage.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Upload, AlertTriangle, Check, ArrowLeft, Eye, FileText, Receipt, CreditCard } from "lucide-react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";
import { useDateContext } from "@/hooks/use-date-context";
import { useSaleContext } from "@/contexts/SaleContext";
import { apiClient } from "@/lib/apiClient";
import { InvoiceDataSchema } from "@/lib/schemas";
import { useRouter } from "next/navigation";

interface InvoiceItem {
  slNo: number;
  itemCode: string;
  itemName: string;
  hsnCode: string;
  qty: number;
  uom: string;
  rate: number;
  total: number;
}

interface InvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  store: string;
  items: InvoiceItem[];
  totalQty: number;
  totalAmount: number;
  pageCount: number;
  validation: {
    isToday: boolean;
    isCorrectStore: boolean;
    isValid: boolean;
  };
}

interface CreditNoteItem {
  itemCode: string;
  description: string;
  hsnCode: string;
  quantity: number;
  rate: number;
  total: number;
  rtd: number;
  taxable: number;
  taxRate: number;
  amount: number;
  returnDate?: string;
}

interface CreditNoteData {
  creditNoteNumber: string;
  date: string;
  receiver: { name: string; gstin?: string };
  items: CreditNoteItem[];
  totals: { grossValue?: number; netValue?: number; totalQuantity?: number; grossTotal?: number; taxableTotal?: number; amountTotal?: number };
  reason: string;
  totalItems: number;
  index: number;
}

interface CreditPreviewData {
  success: boolean;
  creditNotes: CreditNoteData[];
  totalCreditNotes: number;
  debugInfo: { totalLines: number; firstLines: string[] };
  error?: string;
}

interface UploadInvoicePageProps {
  onBack: () => void;
}

type UploadTab = 'invoice' | 'ros-receipt' | 'credit-notes';

export function UploadInvoicePage({ onBack }: UploadInvoicePageProps) {
  const { user, loading } = useAuth();
  const { selectedDate } = useDateContext();
  const { refreshSales } = useSaleContext();
  const router = useRouter();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<UploadTab>('invoice');
  
  // Invoice upload states (existing functionality)
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [previewData, setPreviewData] = useState<InvoiceData | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  // ROS Receipt states
  const [rosFile, setRosFile] = useState<File | null>(null);
  const [rosError, setRosError] = useState("");
  const [rosUploading, setRosUploading] = useState(false);
  const [rosSuccess, setRosSuccess] = useState(false);
  const [rosPreviewData, setRosPreviewData] = useState<any>(null);
  const [rosPreviewLoading, setRosPreviewLoading] = useState(false);
  
  // Credit Notes states
  const [creditFile, setCreditFile] = useState<File | null>(null);
  const [creditError, setCreditError] = useState("");
  const [creditUploading, setCreditUploading] = useState(false);
  const [creditSuccess, setCreditSuccess] = useState(false);
  const [creditPreviewData, setCreditPreviewData] = useState<CreditPreviewData | null>(null);
  const [creditPreviewLoading, setCreditPreviewLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setError("");
      setPreviewData(null);
    } else {
      setError("Please select a valid PDF file");
      setFile(null);
      setPreviewData(null);
    }
  };

  const handleRosFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setRosFile(selectedFile);
      setRosError("");
      setRosPreviewData(null);
    } else {
      setRosError("Please select a valid PDF file");
      setRosFile(null);
      setRosPreviewData(null);
    }
  };

  const handleRosPreview = async () => {
    if (!rosFile) {
      setRosError("No file selected");
      return;
    }

    if (!user) {
      setRosError("You must be logged in to preview ROS receipts");
      router.push("/");
      return;
    }

    setRosPreviewLoading(true);
    setRosError("");

    try {
      const formData = new FormData();
      formData.append("rosReceipt", rosFile);

      const token = getAuthToken();
      if (!token) {
        setRosError("Session expired. Please log in again.");
        router.push("/");
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const response = await fetch(`${baseUrl}/api/ros-receipts/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to preview ROS receipt");
      }

      const data = await response.json();
      
      if (data.success) {
        setRosPreviewData(data.data);
      } else {
        setRosError(data.error || "Failed to preview ROS receipt");
      }
    } catch (err: any) {
      setRosError(err.message || "Failed to preview ROS receipt. Please try again.");
    } finally {
      setRosPreviewLoading(false);
    }
  };

  const handleRosUpload = async () => {
    if (!rosFile) {
      setRosError("No file selected");
      return;
    }

    if (!user) {
      setRosError("You must be logged in to upload ROS receipts");
      router.push("/");
      return;
    }

    setRosUploading(true);
    setRosError("");

    try {
      const formData = new FormData();
      formData.append("rosReceipt", rosFile);

      const token = getAuthToken();
      if (!token) {
        setRosError("Session expired. Please log in again.");
        router.push("/");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/ros-receipts/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload ROS receipt");
      }

      const data = await response.json();
      
      if (data.success) {
        setRosSuccess(true);
        // Clear preview data and file after successful upload
        setRosPreviewData(null);
        setRosFile(null);
        setTimeout(() => {
          setRosSuccess(false);
        }, 3000);
      } else {
        setRosError(data.error || "Failed to upload ROS receipt");
      }
    } catch (err: any) {
      setRosError(err.message || "Failed to upload ROS receipt. Please try again.");
    } finally {
      setRosUploading(false);
    }
  };

  const handleCreditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setCreditFile(selectedFile);
      setCreditError("");
    } else {
      setCreditError("Please select a valid PDF file");
      setCreditFile(null);
    }
  };

  const handleCreditNoteUpload = async () => {
    if (!creditFile) {
      setCreditError("No file selected");
      return;
    }

    if (!user) {
      setCreditError("You must be logged in to upload credit notes");
      router.push("/");
      return;
    }

    setCreditUploading(true);
    setCreditError("");

    try {
      const formData = new FormData();
      formData.append("file", creditFile);
      formData.append("date", selectedDate);

      const token = getAuthToken();
      if (!token) {
        setCreditError("Session expired. Please log in again.");
        router.push("/");
        return;
      }

      // TODO: Replace with actual credit notes API endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credit-notes/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload credit note");
      }

      const data = await response.json();
      
      if (data.success) {
        // Clear preview data after successful upload
        setCreditPreviewData(null);
        
        // Show success message with comparison results
        if (data.failedUploads > 0) {
          setCreditError("Credit note already exists");
        } else {
          setCreditSuccess(true);
          
          // Show comparison results if available
          if (data.comparisonResults && data.comparisonResults.length > 0) {
            const totalReceived = data.comparisonResults.reduce((sum: number, r: any) => sum + (r.perfectMatches || 0), 0);
            const totalAlerts = data.comparisonResults.reduce((sum: number, r: any) => sum + (r.alerts || 0), 0);
            
            if (totalReceived > 0 || totalAlerts > 0) {
              console.log(`Auto-comparison results: ${totalReceived} items marked as received, ${totalAlerts} items marked as alert`);
            }
          }
        }
        
        setTimeout(() => {
          setCreditFile(null);
          setCreditSuccess(false);
          setCreditError("");
        }, 5000);
      } else {
        throw new Error(data.error || "Failed to upload credit note");
      }
    } catch (err: any) {
      setCreditError(err.message || "Failed to upload credit note. Please try again.");
    } finally {
      setCreditUploading(false);
    }
  };

  const handleCreditNotePreview = async () => {
    if (!creditFile) {
      setCreditError("No file selected");
      return;
    }

    setCreditPreviewLoading(true);
    setCreditError("");
    setCreditPreviewData(null); // Reset preview data on new preview attempt

    try {
      const formData = new FormData();
      formData.append("file", creditFile); // Use 'file' to match Multer configuration

      const token = getAuthToken();
      if (!token) {
        setCreditError("Session expired. Please log in again.");
        router.push("/");
        return;
      }

      console.log("🔍 Starting credit note preview...", { fileName: creditFile.name, size: creditFile.size });

      // Parse the file directly
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const parseResponse = await fetch(`${baseUrl}/api/credit-notes/parse`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log("📡 Parse response status:", parseResponse.status, parseResponse.statusText);

      const parseData = await parseResponse.json() as CreditPreviewData;
      
      console.log("📄 Parse response data:", parseData);
      
      if (!parseResponse.ok) {
        throw new Error(parseData.error || "Parsing failed");
      }

      if (parseData.success) {
        console.log("✅ Credit note preview successful:", parseData);
        setCreditPreviewData(parseData);
      } else {
        console.log("❌ Credit note preview failed:", parseData.error);
        setCreditError(parseData.error || "Parsing failed");
      }
    } catch (error: any) {
      setCreditError(error.message || "Preview failed. Please check the file format or server connection.");
    } finally {
      setCreditPreviewLoading(false);
    }
  };

  const previewInvoice = async () => {
    if (!file) {
      setError("No file selected");
      return;
    }

    if (loading) {
      setError("Authenticating, please wait...");
      return;
    }

    if (!user) {
      setError("You must be logged in to preview invoices");
      router.push("/");
      return;
    }

    setIsPreviewing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("invoiceDate", selectedDate);

      const token = getAuthToken();
      if (!token) {
        setError("Session expired. Please log in again.");
        router.push("/");
        return;
      }

      const response = await apiClient<{ success: boolean; message: string; data: InvoiceData }>(
        "/api/invoices/check",
        {
          method: "POST",
          body: formData,
        },
        token
      );

      if (!response.success) {
        throw new Error(response.message || "Failed to preview invoice");
      }

      const validatedData = InvoiceDataSchema.parse(response.data);
      setPreviewData(validatedData);
    } catch (err: any) {
      console.error("Preview error:", err.message, err.stack);
      if (err.message.includes("Unauthorized")) {
        setError("Session expired. Please log in again.");
        router.push("/");
      } else if (err.message.includes("Unable to connect")) {
        setError("Cannot connect to the server. Please ensure the backend is running.");
      } else {
        setError(err.message || "Failed to preview invoice. Please try again.");
      }
      setPreviewData(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("No file selected");
      return;
    }

    if (!previewData) {
      setError("Please preview the invoice before uploading");
      return;
    }

    if (loading) {
      setError("Authenticating, please wait...");
      return;
    }

    if (!user) {
      setError("You must be logged in to upload invoices");
      router.push("/");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("invoiceDate", selectedDate);

      const token = getAuthToken();
      if (!token) {
        setError("Session expired. Please log in again.");
        router.push("/");
        return;
      }

      console.log("Uploading with token:", token);
      const response = await apiClient<{ success: boolean; message: string; data: InvoiceData }>(
        "/api/invoices/upload",
        {
          method: "POST",
          body: formData,
        },
        token
      );

      console.log("Upload response:", response);

      if (!response.success) {
        throw new Error(response.message || "Failed to upload invoice");
      }

      const validatedData = InvoiceDataSchema.parse(response.data);
      setUploadSuccess(true);
      setTimeout(() => {
        setFile(null);
        setUploadSuccess(false);
        setPreviewData(null);
        refreshSales();
      }, 3000);
    } catch (err: any) {
      console.error("Upload error:", err.message, err.stack);
      if (err.message.includes("Unauthorized")) {
        setError("Session expired. Please log in again.");
        router.push("/");
      } else if (err.message.includes("Unable to connect")) {
        setError("Cannot connect to the server. Please ensure the backend is running.");
      } else {
        setError(err.message || "Failed to upload invoice. Please try again.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return <div>Loading authentication...</div>;
  }

  // Success states
  if (uploadSuccess) {
    return (
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription className="text-lg">
                Invoice uploaded successfully! Stock has been updated.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    );
  }

  if (rosSuccess) {
    return (
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription className="text-lg">
                ROS Receipt uploaded successfully!
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    );
  }

  if (rosSuccess) {
    return (
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription className="text-lg">
                ROS Receipt uploaded successfully! Invoices and credit notes have been automatically cleared.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    );
  }

  if (creditSuccess) {
    return (
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription className="text-lg">
                Credit Note uploaded successfully!
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    );
  }

  const renderUploadInvoiceTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
            <Upload className="h-5 w-5" />
            Upload Invoice
          </h2>
          <p className="text-slate-600">Upload a PDF invoice to update stock for {selectedDate}</p>
        </div>
        <div>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <Input type="file" accept="application/pdf" onChange={handleFileChange} />
            <div className="flex gap-2">
              <Button
                onClick={previewInvoice}
                disabled={isPreviewing || !file || loading}
                variant="outline"
                className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <Eye className="h-4 w-4" />
                {isPreviewing ? "Previewing..." : "Preview Invoice"}
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={isUploading || !file || !previewData || loading}
                className="bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                {isUploading ? "Uploading..." : "Upload Invoice"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {previewData && (
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Invoice Preview</h2>
            <p className="text-slate-600">
              Invoice {previewData.invoiceNo} for {previewData.invoiceDate}
            </p>
          </div>
          <div>
            <div className="space-y-4">
              <div>
                <p><strong>Store:</strong> {previewData.store}</p>
                <p><strong>Total Quantity:</strong> {previewData.totalQty}</p>
                <p><strong>Total Amount:</strong> ₹{previewData.totalAmount.toFixed(2)}</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sl No</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>HSN Code</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.items.map((item, index) => (
                      <TableRow key={`${item.slNo}-${item.itemCode}-${index}`}>
                        <TableCell>{item.slNo}</TableCell>
                        <TableCell>{item.itemCode}</TableCell>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell>{item.hsnCode}</TableCell>
                        <TableCell>{item.qty}</TableCell>
                        <TableCell>₹{item.rate.toFixed(2)}</TableCell>
                        <TableCell>₹{item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderRosReceiptTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
            <Receipt className="h-5 w-5" />
            Upload ROS Receipt
          </h2>
          <p className="text-slate-600">Upload a PDF ROS receipt for {selectedDate}</p>
        </div>
        <div>
          {rosError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{rosError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <Input type="file" accept="application/pdf" onChange={handleRosFileChange} />
            <div className="flex gap-2">
              <Button 
                onClick={handleRosPreview} 
                disabled={rosPreviewLoading || !rosFile || loading}
                variant="outline"
                className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <Eye className="h-4 w-4 mr-2" />
                {rosPreviewLoading ? "Previewing..." : "Preview"}
              </Button>
              <Button 
                onClick={handleRosUpload} 
                disabled={rosUploading || !rosFile || loading}
                className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                {rosUploading ? "Uploading..." : "Upload ROS Receipt"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {rosPreviewData && (
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">ROS Receipt Preview</h2>
            <p className="text-slate-600">
              Receipt {rosPreviewData.receipt_number} for {rosPreviewData.receipt_date}
            </p>
          </div>
          <div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p><strong>Receipt Number:</strong> {rosPreviewData.receipt_number}</p>
                  <p><strong>Date:</strong> {rosPreviewData.receipt_date}</p>
                  <p><strong>Payment Method:</strong> {rosPreviewData.payment_method}</p>
                </div>
                <div>
                  <p><strong>Total Amount:</strong> ₹{rosPreviewData.total_amount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Total Bills:</strong> {rosPreviewData.bills?.length || 0}</p>
                </div>
              </div>
              
              {rosPreviewData.bills && rosPreviewData.bills.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Doc Type</TableHead>
                        <TableHead>Bill Date</TableHead>
                        <TableHead>Bill Number</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Dr/Cr</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rosPreviewData.bills.map((bill: any, index: number) => (
                        <TableRow key={`${rosPreviewData.receipt_number}-${bill.bill_number}-${index}`}>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              bill.doc_type === 'CN' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {bill.doc_type}
                            </span>
                          </TableCell>
                          <TableCell>{bill.bill_date}</TableCell>
                          <TableCell className="font-mono">{bill.bill_number}</TableCell>
                          <TableCell>₹{bill.amount?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              bill.dr_cr === 'Cr' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {bill.dr_cr}
                            </span>
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
      )}
    </div>
  );

  const renderCreditNotesTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5" />
            Upload Credit Note
          </h2>
          <p className="text-slate-600">Upload a PDF credit note for {selectedDate}</p>
        </div>
        <div>
          {creditError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{creditError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <Input type="file" accept="application/pdf" onChange={handleCreditFileChange} />
            <div className="flex gap-2">
              <Button 
                onClick={handleCreditNotePreview} 
                disabled={creditPreviewLoading || !creditFile || loading}
                variant="outline"
                className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <Eye className="h-4 w-4 mr-2" />
                {creditPreviewLoading ? "Previewing..." : "Preview"}
              </Button>
              <Button 
                onClick={handleCreditNoteUpload} 
                disabled={creditUploading || !creditFile || loading}
                className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                {creditUploading ? "Uploading..." : "Upload Credit Note"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {creditPreviewData && creditPreviewData.success && (
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Credit Note Preview</h2>
            <p className="text-slate-600">
              Found {creditPreviewData.totalCreditNotes || creditPreviewData.creditNotes?.length || 0} credit note(s)
            </p>
          </div>
          <div>
            <div className="space-y-6">
              {creditPreviewData.creditNotes?.map((creditNote: CreditNoteData, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold">Credit Note #{creditNote.creditNoteNumber}</h3>
                    <p className="text-sm text-muted-foreground">Date: {creditNote.date || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">Receiver: {creditNote.receiver?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">Reason: {creditNote.reason}</p>
                    <p className="text-sm text-muted-foreground">Total Items: {creditNote.totalItems}</p>
                    <p className="text-sm text-muted-foreground">Net Value: ₹{creditNote.totals?.netValue?.toFixed(2) || '0.00'}</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>HSN</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>RTD</TableHead>
                          <TableHead>Return Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creditNote.items?.map((item: CreditNoteItem, itemIndex: number) => (
                          <TableRow key={`${creditNote.creditNoteNumber}-${item.itemCode}-${itemIndex}`}>
                            <TableCell className="font-mono">{item.itemCode}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.hsnCode}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>₹{item.rate?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell>₹{item.total?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                item.rtd === 15.00 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {item.rtd}% {item.rtd === 15.00 ? 'GRM' : 'GVN'}
                              </span>
                            </TableCell>
                            <TableCell>{item.returnDate || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

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
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Upload</h1>
              <p className="text-slate-600 text-sm sm:text-base">Upload invoices, ROS receipts, and credit notes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-4 sm:mb-6 bg-slate-100 p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === 'invoice' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('invoice')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <FileText className="h-4 w-4" />
            Upload Invoice
          </Button>
          <Button
            variant={activeTab === 'ros-receipt' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('ros-receipt')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <Receipt className="h-4 w-4" />
            ROS Receipt
          </Button>
          <Button
            variant={activeTab === 'credit-notes' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('credit-notes')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <CreditCard className="h-4 w-4" />
            Credit Notes
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'invoice' && renderUploadInvoiceTab()}
        {activeTab === 'ros-receipt' && renderRosReceiptTab()}
        {activeTab === 'credit-notes' && renderCreditNotesTab()}
      </div>
    </main>
  );
}