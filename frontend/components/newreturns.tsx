"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RotateCcw, AlertTriangle, Check, ArrowLeft, FileText, Eye, Calendar, Clock, Plus, Minus } from "lucide-react";
import { useDateContext } from "@/hooks/use-date-context";
import { formatDisplayDate, formatDate } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/use-auth";

interface StockItem {
  id: string;
  name: string;
  image: string;
  product_id: string;
  availableQuantity: number;
  category?: string;
  invoicePrice: number;
  grmLoss: number;
  shelfLifeDays?: number | null;
  invoiceDate?: string;
  expiryDate?: string;
}

interface ReturnItem {
  item: StockItem;
  returnQuantity: number;
}

interface ApiResponse {
  success?: boolean;
  data?: any[];
  error?: string;
}

interface ReturnsPageProps {
  onBack: () => void;
}

type ReturnsTab = 'returns' | 'view' | 'pending';
type MobileView = 'products' | 'cart';

export function ReturnsPage({ onBack }: ReturnsPageProps) {
  const formatDDMMYYYY = (date?: string) => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };
  const { user } = useAuth();
  const { selectedDate, setSelectedDate } = useDateContext();
  
  // Main tab state (returns vs view)
  const [mainTab, setMainTab] = useState<ReturnsTab>('returns');
  
  // Mobile view state
  const [mobileView, setMobileView] = useState<MobileView>('products');
  
  // Returns functionality states (existing)
  const [activeTab, setActiveTab] = useState("grm");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [grmReturns, setGrmReturns] = useState<ReturnItem[]>([]);
  const [gvnReturns, setGvnReturns] = useState<ReturnItem[]>([]);
  const [processedGrm, setProcessedGrm] = useState<any[]>([]);
  const [processedGvn, setProcessedGvn] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [returnCompleted, setReturnCompleted] = useState(false);
  
  // View tab states
  const [viewProcessedGrm, setViewProcessedGrm] = useState<any[]>([]);
  const [viewProcessedGvn, setViewProcessedGvn] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewDate, setViewDate] = useState(selectedDate); // Separate date for view tab
  
  // Pending tab states
  const [pendingGrm, setPendingGrm] = useState<any[]>([]);
  const [pendingGvn, setPendingGvn] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingMonth, setPendingMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  const fetchStock = useCallback(async () => {
    // fetchStock implementation will be added here
  }, []);

  const fetchItems = useCallback(async () => {
    setError("");
    try {
      if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        throw new Error(`Invalid or missing selectedDate: ${selectedDate}`);
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Fetching items for tab:", activeTab, "with token:", token.slice(0, 10) + "...", "and date:", selectedDate);
      const url = activeTab === "grm" 
        ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/grm?date=${selectedDate}&t=${Date.now()}`
        : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/gvn?date=${selectedDate}&t=${Date.now()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      console.log(`${activeTab.toUpperCase()} API response status:`, response.status, "ok:", response.ok, "headers:", [...response.headers]);

      const rawData = await response.json();
      console.log(`${activeTab.toUpperCase()} API raw response:`, JSON.stringify(rawData, null, 2));

      let items: any[] = activeTab === "grm" 
        ? (Array.isArray(rawData.grmItems) ? rawData.grmItems : [])
        : (Array.isArray(rawData.gvnItems) ? rawData.gvnItems : []);

      // Store processed lists for the selected date
      if (activeTab === "grm") {
        setProcessedGrm(Array.isArray(rawData.processed) ? rawData.processed : []);
      } else {
        setProcessedGvn(Array.isArray(rawData.processed) ? rawData.processed : []);
      }

      console.log(`${activeTab.toUpperCase()} items before mapping:`, JSON.stringify(items, null, 2));

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${rawData.error || response.statusText}`);
      }
      if ("success" in rawData && !rawData.success) {
        throw new Error(rawData.error || "API returned unsuccessful response");
      }
      if (!items.length) {
        console.warn(`No items returned for ${activeTab} on date:`, selectedDate);
        setStock([]);
        return;
      }

      const mappedStock = items
        .filter((item: any) => Number(item.quantity || 0) > 0) // Filter out zero-quantity items
        .map((item: any) => {
          console.log(`Mapping item:`, JSON.stringify(item, null, 2)); // Debug each item
          return {
            id: String(item.id || item.product_id || "unknown"),
            product_id: String(item.product_id || "unknown"), // Ensure product_id is mapped
            name: String(item.name || item.item_name || "Unknown Item"),
            image: item.image_url || "/placeholder.svg",
            availableQuantity: Number(item.quantity || 0),
            category: item.category || undefined,
            shelfLifeDays: item.shelf_life_days != null ? Number(item.shelf_life_days) : null,
            invoicePrice: Number(item.invoice_price || item.rate || 0),
            grmLoss: Number(item.grm_value || 0),
            invoiceDate: item.invoice_date || undefined,
            expiryDate: item.expiry_date || undefined,
          };
        });

      console.log(`Mapped ${activeTab} items:`, JSON.stringify(mappedStock, null, 2));
      setStock(mappedStock);
    } catch (err: any) {
      console.error(`Error fetching ${activeTab} items:`, err.message, err.stack);
      setError(err.message || `Failed to load ${activeTab.toUpperCase()} items`);
      setTimeout(() => setError(""), 5000);
      setStock([]);
    }
  }, [selectedDate, activeTab]);

  const fetchProcessedReturns = useCallback(async () => {
    setViewLoading(true);
    setViewError("");
    
    try {
      if (!viewDate || !/^\d{4}-\d{2}-\d{2}$/.test(viewDate)) {
        throw new Error(`Invalid or missing viewDate: ${viewDate}`);
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Get processed returns with proper filtering logic
      console.log(`Fetching processed returns for date: ${viewDate}`);

      // Use the new backend endpoint that filters by expiry date
      const processedByExpiryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/processed-by-expiry/${viewDate}?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      });
      
      if (processedByExpiryResponse.ok) {
        const processedData = await processedByExpiryResponse.json();
        console.log('Processed returns by expiry response:', processedData);
        
        if (processedData.success) {
          // Map GRM data with correct structure and group by product + expiry date
          const grmMapped = (processedData.grm || []).map((item: any) => ({
            ...item,
            product_name: item.productName,
            loss_amount: item.lossAmount || 0,
            total_loss: item.lossAmount || 0,
            invoice_date: item.invoiceDate,
            expiry_date: item.expiryDate,
            return_date: item.date,
            credit_status: item.credit_status || 'pending'
          }));
          
          // Group items by product name and expiry date, sum quantities and losses
          const grmGrouped = Object.values(
            grmMapped.reduce((acc: any, item: any) => {
              const key = `${item.product_name}_${item.expiry_date}`;
              
              if (acc[key]) {
                // Item already exists, add quantities and total losses
                acc[key].quantity += item.quantity;
                acc[key].total_loss += item.loss_amount; // Sum up total loss
                // Calculate unit loss amount (total loss / total quantity)
                acc[key].loss_amount = acc[key].total_loss / acc[key].quantity;
              } else {
                // New item - set initial values
                acc[key] = { 
                  ...item,
                  total_loss: item.loss_amount // Initial total loss equals loss amount
                };
              }
              
              return acc;
            }, {})
          );
          
          setViewProcessedGrm(grmGrouped);
          
          // Map GVN data with correct structure and group by product + damage date
          const gvnMapped = (processedData.gvn || []).map((item: any) => ({
            ...item,
            product_name: item.productName,
            rate: item.rate || 0,
            total_rate: item.rate || 0,
            invoice_date: item.invoiceDate,
            damage_date: item.date,
            return_date: item.date,
            credit_status: item.credit_status || 'pending'
          }));
          
          // Group items by product name and damage date, sum quantities and rates
          const gvnGrouped = Object.values(
            gvnMapped.reduce((acc: any, item: any) => {
              const key = `${item.product_name}_${item.damage_date}`;
              
              if (acc[key]) {
                // Item already exists, add quantities and total rates
                acc[key].quantity += item.quantity;
                acc[key].total_rate += item.rate; // Sum up total rate
                // Calculate unit rate (total rate / total quantity)
                acc[key].rate = acc[key].total_rate / acc[key].quantity;
              } else {
                // New item - set initial values
                acc[key] = { 
                  ...item,
                  total_rate: item.rate // Initial total rate equals rate amount
                };
              }
              
              return acc;
            }, {})
          );
          
          setViewProcessedGvn(gvnGrouped);
        } else {
          setViewProcessedGrm([]);
          setViewProcessedGvn([]);
        }
      } else {
        console.warn("Failed to fetch processed returns by expiry");
        setViewProcessedGrm([]);
        setViewProcessedGvn([]);
      }


    } catch (err: any) {
      console.error("Error fetching processed returns:", err.message);
      setViewError(err.message || "Failed to load processed returns");
      setViewProcessedGrm([]);
      setViewProcessedGvn([]);
    } finally {
      setViewLoading(false);
    }
  }, [viewDate]);

  const fetchPendingReturns = useCallback(async () => {
    setPendingLoading(true);
    setPendingError("");
    
    try {
      if (!pendingMonth || !/^\d{4}-\d{2}$/.test(pendingMonth)) {
        throw new Error(`Invalid or missing pendingMonth: ${pendingMonth}`);
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log(`Fetching pending returns for month: ${pendingMonth}`);
      console.log(`API URL: http://localhost:5000/api/returns/pending?month=${pendingMonth}&t=${Date.now()}`);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/pending?month=${pendingMonth}&t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pending returns response:', data);
        
        if (data.success) {
          setPendingGrm(data.data.grm || []);
          setPendingGvn(data.data.gvn || []);
        } else {
          setPendingGrm([]);
          setPendingGvn([]);
        }
      } else {
        console.warn("Failed to fetch pending returns");
        setPendingGrm([]);
        setPendingGvn([]);
      }

    } catch (err: any) {
      console.error("Error fetching pending returns:", err.message);
      setPendingError(err.message || "Failed to load pending returns");
      setPendingGrm([]);
      setPendingGvn([]);
    } finally {
      setPendingLoading(false);
    }
  }, [pendingMonth]);

  useEffect(() => {
    if (mainTab === 'returns') {
    fetchItems();
    } else if (mainTab === 'view') {
      fetchProcessedReturns();
    } else if (mainTab === 'pending') {
      fetchPendingReturns();
    }
  }, [fetchItems, mainTab, fetchProcessedReturns, fetchPendingReturns]);

  // Auto-refresh every 5 seconds when on view tab
  useEffect(() => {
    if (mainTab === 'view' && viewDate) {
      const interval = setInterval(() => {
        fetchProcessedReturns();
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [mainTab, viewDate, fetchProcessedReturns]);

  // Auto-refresh every 5 seconds when on pending tab
  useEffect(() => {
    if (mainTab === 'pending' && pendingMonth) {
      const interval = setInterval(() => {
        fetchPendingReturns();
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [mainTab, pendingMonth, fetchPendingReturns]);

  // Fetch pending returns when month changes
  useEffect(() => {
    if (mainTab === 'pending' && pendingMonth) {
      fetchPendingReturns();
    }
  }, [pendingMonth, mainTab, fetchPendingReturns]);

  const getCurrentReturns = () => (activeTab === "grm" ? grmReturns : gvnReturns);
  const setCurrentReturns = (returns: ReturnItem[]) => {
    if (activeTab === "grm") {
      setGrmReturns(returns);
    } else {
      setGvnReturns(returns);
    }
  };

  const addToReturns = (item: StockItem, quantity: number) => {
    if (quantity <= 0 || quantity > item.availableQuantity) {
      setError(`Invalid quantity. Available: ${item.availableQuantity}`);
      setTimeout(() => setError(""), 5000);
      return;
    }

    const currentReturns = getCurrentReturns();
    const existing = currentReturns.find((returnItem) => returnItem.item.id === item.id);

    if (existing) {
      const newQuantity = existing.returnQuantity + quantity;
      if (newQuantity > item.availableQuantity) {
        setError(`Total return quantity cannot exceed available stock (${item.availableQuantity})`);
        setTimeout(() => setError(""), 5000);
        return;
      }
      setCurrentReturns(
        currentReturns.map((returnItem) =>
          returnItem.item.id === item.id ? { ...returnItem, returnQuantity: newQuantity } : returnItem
        )
      );
    } else {
      setCurrentReturns([...currentReturns, { item, returnQuantity: quantity }]);
    }
    setError("");
  };

  const removeFromReturns = (itemId: string) => {
    const currentReturns = getCurrentReturns();
    setCurrentReturns(currentReturns.filter((returnItem) => returnItem.item.id !== itemId));
  };

  const updateReturnQuantity = (itemId: string, quantity: number) => {
    const currentReturns = getCurrentReturns();
    const item = stock.find((stockItem) => stockItem.id === itemId);

    if (!item) return;

    if (quantity <= 0) {
      removeFromReturns(itemId);
      return;
    }

    if (quantity > item.availableQuantity) {
      setError(`Quantity cannot exceed available stock (${item.availableQuantity})`);
      setTimeout(() => setError(""), 5000);
      return;
    }

    setCurrentReturns(
      currentReturns.map((returnItem) =>
        returnItem.item.id === itemId ? { ...returnItem, returnQuantity: quantity } : returnItem
      )
    );
    setError("");
  };

  const processReturns = async () => {
    const currentReturns = getCurrentReturns();
    if (currentReturns.length === 0) {
      setError("No items selected for return");
      setTimeout(() => setError(""), 5000);
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const token = localStorage.getItem("token") || "";
      if (!token) {
        throw new Error("No authentication token found");
      }

      const items = currentReturns.map((returnItem) => ({
        productId: Number(returnItem.item.product_id),
        batchId: Number(returnItem.item.id),
        quantity: returnItem.returnQuantity,
        invoicePrice: returnItem.item.invoicePrice,
      }));

      console.log(`Processing ${activeTab} returns with body:`, JSON.stringify({
        [activeTab === "grm" ? "returnDate" : "damageDate"]: selectedDate,
        items,
      }, null, 2));

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/returns/${activeTab}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Expires: "0",
        },
        body: JSON.stringify({
          [activeTab === "grm" ? "returnDate" : "damageDate"]: selectedDate,
          items,
        }),
      });

      const data = await response.json();
      console.log(`${activeTab.toUpperCase()} returns response:`, JSON.stringify(data, null, 2));

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to process ${activeTab.toUpperCase()} returns`);
      }

      setReturnCompleted(true);
      setTimeout(() => {
        setCurrentReturns([]);
        setReturnCompleted(false);
        // Refetch items to update the stock state with the latest quantities from the backend
        fetchItems();
      }, 300);
    } catch (err: any) {
      console.error(`Error processing ${activeTab} returns:`, err.message, err.stack);
      setError(err.message || `An error occurred while processing ${activeTab.toUpperCase()} returns`);
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const getTotalValue = () => {
    const currentReturns = getCurrentReturns();
    return currentReturns.reduce((total, returnItem) => {
      const pricePerItem = activeTab === "grm" ? returnItem.item.grmLoss : returnItem.item.invoicePrice;
      return total + pricePerItem * returnItem.returnQuantity;
    }, 0).toFixed(2);
  };

  if (returnCompleted) {
    return (
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Check className="h-6 w-6 text-green-600" />
              <span className="text-lg font-semibold text-slate-900">{activeTab.toUpperCase()} returns processed successfully!</span>
            </div>
            <p className="text-slate-600">Stock has been updated and return record saved.</p>
          </div>
        </div>
      </main>
    );
  }

  // Mobile Products View
  const renderMobileProductsView = () => (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {activeTab === 'grm' ? 'GRM Returns' : 'GVN Damages'}
          </h2>
          <Button
            onClick={() => setMobileView('cart')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            Cart ({getCurrentReturns().length})
          </Button>
        </div>
      </div>

      {/* Tab Selection */}
      <div className="lg:hidden mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="grm" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              GRM Returns
            </TabsTrigger>
            <TabsTrigger value="gvn" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              GVN Damages
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Products List */}
      <Card className="lg:hidden bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold mb-4">
            {activeTab === 'grm' ? 'Items Expiring Today' : 'Items Received Today'}
          </h3>
          {stock.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600">
                {activeTab === 'grm' 
                  ? 'No items expiring today available for return' 
                  : 'No items received today available for damage'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {stock.map((item) => (
                <Card key={item.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200 bg-white rounded-lg overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative">
                      <div className="w-full h-24 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-16 w-16 object-cover rounded-lg shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      </div>
                      <div className="absolute top-1 right-1">
                        <Badge 
                          variant="outline" 
                          className="px-1 py-0 text-xs font-medium bg-green-50 text-green-700 border-green-200"
                        >
                          {item.availableQuantity}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-xs mb-1 text-slate-800 line-clamp-2">{item.name}</h3>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-900">
                          ₹{activeTab === 'grm' ? item.grmLoss.toFixed(2) : item.invoicePrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFromReturns(item.id)}
                          disabled={!getCurrentReturns().find((r) => r.item.id === item.id)}
                          className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-300 rounded-md"
                        >
                          -
                        </Button>
                        <span className="w-8 text-center text-sm font-bold bg-white rounded-md px-1 py-1">
                          {getCurrentReturns().find((r) => r.item.id === item.id)?.returnQuantity || 0}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addToReturns(item, 1)}
                          disabled={item.availableQuantity === 0}
                          className="h-6 w-6 p-0 hover:bg-green-50 hover:border-green-300 rounded-md"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  // Mobile Cart View
  const renderMobileCartView = () => (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <Button
            onClick={() => setMobileView('products')}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            ← Back to Products
          </Button>
          <h2 className="text-lg font-bold text-slate-900">Cart</h2>
        </div>
      </div>

      {/* Cart Items */}
      <Card className="lg:hidden bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
        <CardContent className="p-4">
          {getCurrentReturns().length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 mb-4">No items in cart</p>
              <Button
                onClick={() => setMobileView('products')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Browse Products
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Selected Items</h3>
              {getCurrentReturns().map((returnItem) => (
                <div key={returnItem.item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-slate-900">{returnItem.item.name}</h4>
                    <p className="text-xs text-slate-600">
                      ₹{activeTab === 'grm' ? returnItem.item.grmLoss.toFixed(2) : returnItem.item.invoicePrice.toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const next = Math.max(1, (returnItem.returnQuantity || 1) - 1);
                        updateReturnQuantity(returnItem.item.id, next);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      -
                    </Button>
                    <span className="w-8 text-center text-sm font-bold">{returnItem.returnQuantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const next = Math.min(returnItem.item.availableQuantity, (returnItem.returnQuantity || 1) + 1);
                        updateReturnQuantity(returnItem.item.id, next);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      +
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeFromReturns(returnItem.item.id)}
                      className="h-8 px-3"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Total and Process Button */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold">Total Value:</span>
                  <span className="font-bold text-lg">₹{getTotalValue()}</span>
                </div>
                <Button
                  onClick={processReturns}
                  disabled={isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {isProcessing ? "Processing..." : `Process ${activeTab.toUpperCase()} Returns`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  const renderReturnsTab = () => (
    <>
      {/* Mobile/iPad Layout */}
      <div className="lg:hidden">
        {mobileView === 'products' ? renderMobileProductsView() : renderMobileCartView()}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Returns Management
            </h2>
            <p className="text-slate-600 mt-1 text-sm">
              Process GRM returns for items expiring today and GVN damages for {formatDisplayDate(selectedDate)}
            </p>
          </div>
          <div className="p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="grm" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  GRM Returns
                </TabsTrigger>
                <TabsTrigger value="gvn" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  GVN Damages
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grm" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Items Expiring Today</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {stock.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No items expiring today available for return</p>
                      ) : (
                        stock.map((item) => (
                          <Card key={item.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200 bg-white rounded-lg overflow-hidden">
                            <CardContent className="p-0">
                              <div className="relative">
                                <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="h-20 w-20 object-cover rounded-lg shadow-sm"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                                    }}
                                  />
                                </div>
                                <div className="absolute top-2 right-2">
                                  <Badge 
                                    variant="outline" 
                                    className={`px-2 py-1 text-xs font-medium ${
                                      item.availableQuantity === 0 
                                        ? 'bg-red-50 text-red-700 border-red-200' 
                                        : item.availableQuantity <= 5 
                                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                        : 'bg-green-50 text-green-700 border-green-200'
                                    }`}
                                  >
                                    {item.availableQuantity}
                                  </Badge>
                                </div>
                              </div>
                              <div className="p-4">
                                <h3 className="font-semibold text-sm mb-2 text-slate-800 line-clamp-2 group-hover:text-green-600 transition-colors">{item.name}</h3>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex flex-col">
                                    <span className="text-2xl font-bold text-slate-900">₹{item.grmLoss.toFixed(2)}</span>
                                    <span className="text-xs text-slate-500">Loss per item</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-slate-500 mb-1">Invoice Date</div>
                                    <div className="text-sm font-medium text-slate-700">
                                      {item.invoiceDate 
                                        ? new Date(item.invoiceDate as string).toLocaleDateString('en-GB')
                                        : 'N/A'
                                      }
                                    </div>
                                  </div>
                                </div>
                                <div className="mb-3">
                                  <div className="text-xs text-slate-500 mb-1">Invoice Date</div>
                                  <div className="text-sm font-medium text-slate-700">
                                    {item.invoiceDate 
                                      ? new Date(item.invoiceDate as string).toLocaleDateString('en-GB')
                                      : 'N/A'
                                    }
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeFromReturns(item.id)}
                                    disabled={!grmReturns.find((returnItem) => returnItem.item.id === item.id)}
                                    className="h-9 w-9 p-0 hover:bg-red-50 hover:border-red-300 rounded-lg"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-12 text-center text-lg font-bold bg-white rounded-lg px-3 py-2 shadow-sm">
                                    {grmReturns.find((returnItem) => returnItem.item.id === item.id)?.returnQuantity || 0}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addToReturns(item, 1)}
                                    disabled={
                                      item.availableQuantity === 0 ||
                                      (grmReturns.find((returnItem) => returnItem.item.id === item.id)?.returnQuantity || 0) >= item.availableQuantity
                                    }
                                    className="h-9 w-9 p-0 hover:bg-green-50 hover:border-green-300 rounded-lg"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="md:fixed md:bottom-0 md:left-0 md:right-0 md:z-50 md:bg-white md:shadow-2xl md:border-t md:pt-4 lg:static lg:bg-transparent lg:shadow-none lg:border-0 lg:pt-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Selected for Return</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto md:max-h-[30vh] lg:max-h-none">
                      {getCurrentReturns().length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 text-xs">No items selected</p>
                      ) : (
                        getCurrentReturns().map((returnItem) => (
                          <div key={returnItem.item.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded border bg-white shadow-sm">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-800 truncate">{returnItem.item.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                Qty: {returnItem.returnQuantity}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-5 px-1 text-[9px]"
                                onClick={() => {
                                  const next = Math.max(1, (returnItem.returnQuantity || 1) - 1);
                                  updateReturnQuantity(returnItem.item.id, next);
                                }}
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                max={returnItem.item.availableQuantity}
                                value={returnItem.returnQuantity}
                                className="w-8 h-5 text-[9px] text-center"
                                onChange={(e) => {
                                  const raw = parseInt(e.target.value);
                                  const safe = isNaN(raw) ? 1 : Math.min(Math.max(raw, 1), returnItem.item.availableQuantity);
                                  updateReturnQuantity(returnItem.item.id, safe);
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-5 px-1 text-[9px]"
                                onClick={() => {
                                  const next = Math.min(returnItem.item.availableQuantity, (returnItem.returnQuantity || 1) + 1);
                                  updateReturnQuantity(returnItem.item.id, next);
                                }}
                              >
                                +
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-5 px-1 text-[9px]"
                                onClick={() => removeFromReturns(returnItem.item.id)}
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {getCurrentReturns().length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Total Items:</span>
                          <span className="font-medium">{getCurrentReturns().reduce((sum, item) => sum + item.returnQuantity, 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="text-muted-foreground">Total Value:</span>
                          <span className="font-medium">₹{getTotalValue()}</span>
                        </div>
                        <Button
                          onClick={processReturns}
                          disabled={isProcessing}
                          className="w-full mt-2 h-8 text-xs bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? 'Processing...' : 'Process Returns'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="gvn" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Items Received Today</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {stock.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No items received today available for damage</p>
                      ) : (
                        stock.map((item) => (
                          <Card key={item.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200 bg-white rounded-lg overflow-hidden">
                            <CardContent className="p-0">
                              <div className="relative">
                                <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="h-20 w-20 object-cover rounded-lg shadow-sm"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                                    }}
                                  />
                                </div>
                                <div className="absolute top-2 right-2">
                                  <Badge 
                                    variant="outline" 
                                    className={`px-2 py-1 text-xs font-medium ${
                                      item.availableQuantity === 0 
                                        ? 'bg-red-50 text-red-700 border-red-200' 
                                        : item.availableQuantity <= 5 
                                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                        : 'bg-green-50 text-green-700 border-green-200'
                                    }`}
                                  >
                                    {item.availableQuantity}
                                  </Badge>
                                </div>
                              </div>
                              <div className="p-4">
                                <h3 className="font-semibold text-sm mb-2 text-slate-800 line-clamp-2 group-hover:text-green-600 transition-colors">{item.name}</h3>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex flex-col">
                                    <span className="text-2xl font-bold text-slate-900">₹{item.invoicePrice.toFixed(2)}</span>
                                    <span className="text-xs text-slate-500">Invoice Price</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-slate-500 mb-1">Invoice Date</div>
                                    <div className="text-sm font-medium text-slate-700">
                                      {item.invoiceDate 
                                        ? new Date(item.invoiceDate as string).toLocaleDateString('en-GB')
                                        : 'N/A'
                                      }
                                    </div>
                                  </div>
                                </div>
                                <div className="mb-3">
                                  <div className="text-xs text-slate-500 mb-1">Invoice Date</div>
                                  <div className="text-sm font-medium text-slate-700">
                                    {item.invoiceDate 
                                      ? new Date(item.invoiceDate as string).toLocaleDateString('en-GB')
                                      : 'N/A'
                                    }
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeFromReturns(item.id)}
                                    disabled={!gvnReturns.find((returnItem) => returnItem.item.id === item.id)}
                                    className="h-9 w-9 p-0 hover:bg-red-50 hover:border-red-300 rounded-lg"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-12 text-center text-lg font-bold bg-white rounded-lg px-3 py-2 shadow-sm">
                                    {gvnReturns.find((returnItem) => returnItem.item.id === item.id)?.returnQuantity || 0}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addToReturns(item, 1)}
                                    disabled={
                                      item.availableQuantity === 0 ||
                                      (gvnReturns.find((returnItem) => returnItem.item.id === item.id)?.returnQuantity || 0) >= item.availableQuantity
                                    }
                                    className="h-9 w-9 p-0 hover:bg-green-50 hover:border-green-300 rounded-lg"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="md:fixed md:bottom-0 md:left-0 md:right-0 md:z-50 md:bg-white md:shadow-2xl md:border-t md:pt-4 lg:static lg:bg-transparent lg:shadow-none lg:border-0 lg:pt-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Selected for Damage</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto md:max-h-[30vh] lg:max-h-none">
                      {getCurrentReturns().length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 text-xs">No items selected</p>
                      ) : (
                        getCurrentReturns().map((returnItem) => (
                          <div key={returnItem.item.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded border bg-white shadow-sm">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-800 truncate">{returnItem.item.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                Qty: {returnItem.returnQuantity}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-5 px-1 text-[9px]"
                                onClick={() => {
                                  const next = Math.max(1, (returnItem.returnQuantity || 1) - 1);
                                  updateReturnQuantity(returnItem.item.id, next);
                                }}
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                max={returnItem.item.availableQuantity}
                                value={returnItem.returnQuantity}
                                className="w-8 h-5 text-[9px] text-center"
                                onChange={(e) => {
                                  const raw = parseInt(e.target.value);
                                  const safe = isNaN(raw) ? 1 : Math.min(Math.max(raw, 1), returnItem.item.availableQuantity);
                                  updateReturnQuantity(returnItem.item.id, safe);
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-5 px-1 text-[9px]"
                                onClick={() => {
                                  const next = Math.min(returnItem.item.availableQuantity, (returnItem.returnQuantity || 1) + 1);
                                  updateReturnQuantity(returnItem.item.id, next);
                                }}
                              >
                                +
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-5 px-1 text-[9px]"
                                onClick={() => removeFromReturns(returnItem.item.id)}
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {getCurrentReturns().length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Total Items:</span>
                          <span className="font-medium">{getCurrentReturns().reduce((sum, item) => sum + item.returnQuantity, 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="text-muted-foreground">Total Value:</span>
                          <span className="font-medium">₹{getTotalValue()}</span>
                        </div>
                        <Button
                          onClick={processReturns}
                          disabled={isProcessing}
                          className="w-full mt-2 h-8 text-xs bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? 'Processing...' : 'Process Returns'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );

  const renderViewTab = () => (
    <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Processed Returns
        </h2>
        <p className="text-slate-600 mt-1 text-sm">
          View processed returns: GRM by expiry date, GVN by processing date
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <Label htmlFor="view-date" className="text-sm font-medium text-slate-700">
              Date:
            </Label>
          </div>
          <Input
            id="view-date"
            type="date"
            value={viewDate}
            onChange={(e) => setViewDate(e.target.value)}
            className="w-40 bg-white border-slate-300 focus:border-slate-500"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewDate(selectedDate)}
            className="bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            Today
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => fetchProcessedReturns()}
            className="ml-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            Refresh
          </Button>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {viewLoading ? (
          <div className="text-center py-8">
            <p className="text-slate-600">Loading processed returns...</p>
          </div>
        ) : viewError ? (
          <div className="text-center py-8">
            <p className="text-red-600">{viewError}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* GRM Returns */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                GRM Returns ({viewProcessedGrm.length})
              </h3>
              {viewProcessedGrm.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No GRM returns found processed on {formatDisplayDate(viewDate)}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Loss</TableHead>
                        <TableHead>Total Loss</TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Credit Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewProcessedGrm.map((returnItem: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{returnItem.product_name || 'Unknown Product'}</TableCell>
                          <TableCell>{returnItem.quantity || 0}</TableCell>
                          <TableCell>₹{(returnItem.loss || 0).toFixed(2)}</TableCell>
                          <TableCell>₹{(returnItem.total_loss || 0).toFixed(2)}</TableCell>
                          <TableCell>{formatDDMMYYYY(returnItem.invoice_date)}</TableCell>
                          <TableCell>{formatDDMMYYYY(returnItem.expiry_date)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                returnItem.credit_status === 'received' ? 'default' : 
                                returnItem.credit_status === 'alert' ? 'destructive' : 
                                'secondary'
                              }
                              className={
                                returnItem.credit_status === 'received' ? 'bg-green-500 hover:bg-green-600 text-white' : 
                                returnItem.credit_status === 'alert' ? 'bg-red-500 hover:bg-red-600 text-white' : 
                                'bg-orange-500 hover:bg-orange-600 text-white'
                              }
                            >
                              {returnItem.credit_status === 'received' ? 'Received' : 
                               returnItem.credit_status === 'alert' ? 'Alert' : 
                               'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* GVN Returns */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                GVN Damages ({viewProcessedGvn.length})
              </h3>
              {viewProcessedGvn.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No GVN damages found processed on {formatDisplayDate(viewDate)}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Total Rate</TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Damage Date</TableHead>
                        <TableHead>Credit Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewProcessedGvn.map((returnItem: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{returnItem.product_name || 'Unknown Product'}</TableCell>
                          <TableCell>{returnItem.quantity || 0}</TableCell>
                          <TableCell>₹{(returnItem.rate || 0).toFixed(2)}</TableCell>
                          <TableCell>₹{(returnItem.total_rate || 0).toFixed(2)}</TableCell>
                          <TableCell>{formatDDMMYYYY(returnItem.invoice_date)}</TableCell>
                          <TableCell>{formatDDMMYYYY(returnItem.damage_date)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                returnItem.credit_status === 'received' ? 'default' : 
                                returnItem.credit_status === 'alert' ? 'destructive' : 
                                'secondary'
                              }
                              className={
                                returnItem.credit_status === 'received' ? 'bg-green-500 hover:bg-green-600 text-white' : 
                                returnItem.credit_status === 'alert' ? 'bg-red-500 hover:bg-red-600 text-white' : 
                                'bg-orange-500 hover:bg-orange-600 text-white'
                              }
                            >
                              {returnItem.credit_status === 'received' ? 'Received' : 
                               returnItem.credit_status === 'alert' ? 'Alert' : 
                               'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Summary */}
            {(viewProcessedGrm.length > 0 || viewProcessedGvn.length > 0) && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Summary for {formatDisplayDate(viewDate)}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total GRM Loss:</span>
                    <span className="font-medium ml-2">
                      ₹{viewProcessedGrm.reduce((sum: number, item: any) => sum + (item.total_loss || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total GVN Rate:</span>
                    <span className="font-medium ml-2">
                      ₹{viewProcessedGvn.reduce((sum: number, item: any) => sum + (item.total_rate || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderPendingTab = () => (
    <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Returns
        </h2>
        <p className="text-slate-600 mt-1 text-sm">
          View all pending returns awaiting credit note processing
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <Label htmlFor="pending-month" className="text-sm font-medium text-slate-700">
              Month:
            </Label>
          </div>
          <Input
            id="pending-month"
            type="month"
            value={pendingMonth}
            onChange={(e) => setPendingMonth(e.target.value)}
            className="w-40 bg-white border-slate-300 focus:border-slate-500"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPendingMonth(new Date().toISOString().slice(0, 7))}
            className="bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            Current Month
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => fetchPendingReturns()}
            className="ml-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            Refresh
          </Button>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {pendingLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading pending returns...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* GRM Pending Returns */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                GRM Pending Returns ({pendingGrm.length})
              </h3>
              {pendingGrm.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No pending GRM returns found for {pendingMonth}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Loss</TableHead>
                        <TableHead>Total Loss</TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Return Date</TableHead>
                        <TableHead>Credit Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingGrm.map((returnItem: any, index: number) => (
                        <TableRow key={`grm-${returnItem.id || index}`}>
                          <TableCell className="font-medium">{returnItem.productName}</TableCell>
                          <TableCell>{returnItem.itemCode}</TableCell>
                          <TableCell>{returnItem.quantity}</TableCell>
                          <TableCell>₹{(Number(returnItem.lossAmount) || 0).toFixed(2)}</TableCell>
                          <TableCell>₹{((Number(returnItem.lossAmount) || 0) * (Number(returnItem.quantity) || 0)).toFixed(2)}</TableCell>
                          <TableCell>{formatDDMMYYYY(returnItem.invoiceDate)}</TableCell>
                          <TableCell>{formatDDMMYYYY(returnItem.returnDate)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary"
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                              Pending
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* GVN Pending Returns */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                GVN Pending Returns ({pendingGvn.length})
              </h3>
              {pendingGvn.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No pending GVN returns found for {pendingMonth}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Total Rate</TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Credit Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingGvn.map((returnItem: any, index: number) => (
                        <TableRow key={`gvn-${returnItem.id || index}`}>
                          <TableCell className="font-medium">{returnItem.productName}</TableCell>
                          <TableCell>{returnItem.itemCode}</TableCell>
                          <TableCell>{returnItem.quantity}</TableCell>
                          <TableCell>₹{(Number(returnItem.rate) || 0).toFixed(2)}</TableCell>
                          <TableCell>₹{((Number(returnItem.rate) || 0) * (Number(returnItem.quantity) || 0)).toFixed(2)}</TableCell>
                          <TableCell>{formatDDMMYYYY(returnItem.invoiceDate)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary"
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                              Pending
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Summary */}
            {(pendingGrm.length > 0 || pendingGvn.length > 0) && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Summary for {pendingMonth}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total GRM Loss:</span>
                    <span className="font-medium ml-2">
                      ₹{pendingGrm.reduce((sum: number, item: any) => sum + ((Number(item.lossAmount) || 0) * (Number(item.quantity) || 0)), 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total GVN Rate:</span>
                    <span className="font-medium ml-2">
                      ₹{pendingGvn.reduce((sum: number, item: any) => sum + ((Number(item.rate) || 0) * (Number(item.quantity) || 0)), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-32 lg:pb-8">
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
                <RotateCcw className="h-5 w-5" />
                Returns Management
              </h1>
              <p className="text-slate-600 text-sm sm:text-base">Process GRM returns and GVN damages</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Main Tab Navigation */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
          <Button
            variant={mainTab === 'returns' ? 'default' : 'ghost'}
            onClick={() => setMainTab('returns')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <RotateCcw className="h-4 w-4" />
            Returns
          </Button>
          <Button
            variant={mainTab === 'view' ? 'default' : 'ghost'}
            onClick={() => setMainTab('view')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
          <Button
            variant={mainTab === 'pending' ? 'default' : 'ghost'}
            onClick={() => setMainTab('pending')}
            className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
          >
            <Clock className="h-4 w-4" />
            Pending
          </Button>
        </div>

        {/* Tab Content */}
        {mainTab === 'returns' && renderReturnsTab()}
        {mainTab === 'view' && renderViewTab()}
        {mainTab === 'pending' && renderPendingTab()}

        {/* Error Display */}
        {(error || viewError || pendingError) && (
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-red-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">{error || viewError || pendingError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Tab - Mobile & iPad Only - Always visible like Record Sale Page */}
      {mainTab === 'returns' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <RotateCcw className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {activeTab === 'grm' 
                      ? `${grmReturns.reduce((sum, item) => sum + item.returnQuantity, 0)} GRM item${grmReturns.reduce((sum, item) => sum + item.returnQuantity, 0) === 1 ? '' : 's'} added`
                      : `${gvnReturns.reduce((sum, item) => sum + item.returnQuantity, 0)} GVN item${gvnReturns.reduce((sum, item) => sum + item.returnQuantity, 0) === 1 ? '' : 's'} added`
                    }
                  </div>
                  {getCurrentReturns().length > 0 ? (
                    <div className="text-xs text-slate-600">
                      Total: ₹{getTotalValue()}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600">
                      {activeTab === 'grm' ? 'Add GRM items to process returns' : 'Add GVN items to process returns'}
                    </div>
                  )}
                </div>
              </div>
              <Button
                onClick={processReturns}
                disabled={isProcessing || getCurrentReturns().length === 0}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {getCurrentReturns().length === 0 ? 'Process Returns' : 'Process Returns >'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}