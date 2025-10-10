"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Search, AlertTriangle, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDateContext } from "@/hooks/use-date-context";
import { formatDate, formatDisplayDate } from "@/lib/dateUtils";

interface StockItem {
  id: string;
  batchId: string;
  stockDate: string;
  productName: string;
  quantity: number;
  invoicePrice: number;
  mrp: number;
  expiryDate?: string;
  invoiceDate?: string;
  image: string;
  category?: string;
  shelfLifeDays?: number | null;
}

interface StockResponse {
  success?: boolean;
  data?: any[];
  totalQuantity?: number;
  totalValue?: number;
  error?: string;
}

interface TodaysStockPageProps {
  onBack: () => void;
}

export function TodaysStockPage({ onBack }: TodaysStockPageProps) {
  const { selectedDate } = useDateContext();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [totalQuantity, setTotalQuantity] = useState<number>(0);
  const [mrpValue, setMrpValue] = useState<number>(0);
  const [invoiceValue, setInvoiceValue] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchStock = async () => {
      setIsLoading(true);
      setError("");
      try {
        if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
          throw new Error(`Invalid or missing selectedDate: ${selectedDate}`);
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching stock with token:", token.slice(0, 10) + "...", "and date:", selectedDate);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/stock?date=${selectedDate}&t=${Date.now()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );

        console.log("Stock API response status:", response.status, "ok:", response.ok, "headers:", [...response.headers]);

        const rawData = await response.json();
        console.log("Stock API raw response:", JSON.stringify(rawData, null, 2));

        let data: StockResponse = rawData;
        let items: any[] = Array.isArray(rawData) ? rawData : Array.isArray(rawData.data) ? rawData.data : [];

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${rawData.error || response.statusText}`);
        }
        if ("success" in rawData && !rawData.success) {
          throw new Error(rawData.error || "API returned unsuccessful response");
        }
        if (!items.length) {
          console.warn("No stock items returned for date:", selectedDate);
          setStockItems([]);
          setTotalQuantity(0);
          setTotalValue(0);
          return;
        }

        const mappedItems: StockItem[] = items.map((item, index) => {
          const invoicePrice = Number(item.invoice_price) || 0;
          const mappedItem: StockItem = {
            id: String(item.product_id || item.id || `temp-${index}`),
            batchId: String(item.id || `batch-${index}`),
            stockDate: item.invoice_date || selectedDate,
            productName: String(item.name || "Unknown Product"),
            quantity: Number(item.quantity) || 0,
            invoicePrice,
            mrp: Number(item.sale_price) || invoicePrice * 1.33 || 0,
            image: String(item.image_url || "/placeholder.svg"),
            expiryDate: item.expiry_date ? String(item.expiry_date) : undefined,
            invoiceDate: item.invoice_date ? String(item.invoice_date) : undefined,
            category: item.category || undefined,
            shelfLifeDays: item.shelf_life_days != null ? Number(item.shelf_life_days) : null,
          };
          console.log(`Item ${index} mapped to:`, JSON.stringify(mappedItem, null, 2));
          if (!item.name || !item.invoice_price || !item.sale_price) {
            console.warn("Incomplete stock item:", item, "Mapped to:", mappedItem);
          }
          return mappedItem;
        });

        const selectedDateObj = new Date(selectedDate);
        const validItems = mappedItems.filter((item) => {
          if (!item.expiryDate) return true;
          const expiry = new Date(item.expiryDate);
          return expiry >= selectedDateObj;
        });

        const computedTotalQuantity = validItems.reduce((sum, item) => sum + item.quantity, 0);
        const computedMRPValue = validItems.reduce((sum, item) => sum + item.quantity * item.mrp, 0);
        const computedInvoiceValue = validItems.reduce((sum, item) => sum + item.quantity * item.invoicePrice, 0);

        setStockItems(validItems);
        setTotalQuantity(Number(rawData.totalQuantity) || computedTotalQuantity);
        setMrpValue(Number(rawData.totalValue) || computedMRPValue);
        setInvoiceValue(computedInvoiceValue);
        console.log("Final stock items:", JSON.stringify(validItems, null, 2));
        console.log("Totals:", { totalQuantity: computedTotalQuantity, mrpValue: computedMRPValue, invoiceValue: computedInvoiceValue });
      } catch (err: any) {
        console.error("Error fetching stock:", err.message, err.stack);
        setError(err.message || "Failed to load stock data");
        setStockItems([]);
        setTotalQuantity(0);
        setMrpValue(0);
        setInvoiceValue(0);
        setTimeout(() => setError(""), 5000);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStock();
  }, [selectedDate]);

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const today = new Date(selectedDate);
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { color: "bg-red-100 text-red-800", text: "Out of Stock" };
    if (quantity <= 5) return { color: "bg-yellow-100 text-yellow-800", text: "Low Stock" };
    return { color: "bg-green-100 text-green-800", text: "In Stock" };
  };

  const filteredItems = stockItems.filter((item) =>
    item.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-6 w-6" />
                Today's Stock
              </h1>
              <p className="text-slate-600 mt-1">
                Inventory for {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 bg-white hover:bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-black transition-all duration-200">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-6">
            <div className="text-2xl font-bold text-slate-900">{filteredItems.length}</div>
            <div className="text-sm text-slate-600">Unique Items</div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-6">
            <div className="text-2xl font-bold text-slate-900">{totalQuantity}</div>
            <div className="text-sm text-slate-600">Total Quantity</div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-6">
            <div className="text-2xl font-bold text-blue-600">₹{(Number(mrpValue) || 0).toLocaleString()}</div>
            <div className="text-sm text-slate-600">MRP Stock Value</div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-6">
            <div className="text-2xl font-bold text-green-600">₹{(Number(invoiceValue) || 0).toLocaleString()}</div>
            <div className="text-sm text-slate-600">Invoice Cost Stock Value</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-6">
          <div className="flex items-center gap-2 max-w-md">
            <Search className="h-4 w-4 text-slate-600" />
            <Input
              placeholder="Search by product name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border-slate-300 focus:border-slate-500"
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Stock Overview</h2>
            <p className="text-slate-600 mt-1">
              Showing {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8 text-slate-600">Loading stock data...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-slate-600">No stock available for this date</div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Image</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Invoice Price</TableHead>
                        <TableHead>MRP</TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const stockStatus = getStockStatus(item.quantity);
                        const expiringSoon = isExpiringSoon(item.expiryDate);
                        return (
                          <TableRow key={`${item.id}-${item.batchId}`}>
                            <TableCell>
                              <img
                                src={item.image}
                                alt={item.productName}
                                className="w-12 h-12 object-cover rounded-md"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="capitalize">{item.category || '-'}</TableCell>
                            <TableCell className="font-bold">{item.quantity}</TableCell>
                            <TableCell>₹{(Number(item.invoicePrice) || 0).toLocaleString()}</TableCell>
                            <TableCell>₹{(Number(item.mrp) || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              {item.invoiceDate ? (
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(item.invoiceDate)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              {item.expiryDate ? (
                                <div className="flex items-center gap-1">
                                  {expiringSoon && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                                  <span className={expiringSoon ? "text-orange-600 font-medium" : ""}>
                                    {formatDate(item.expiryDate)}
                                  </span>
                                </div>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${stockStatus.color} border-0`} variant="secondary">
                                {stockStatus.text}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredItems.map((item) => {
                    const stockStatus = getStockStatus(item.quantity);
                    const expiringSoon = isExpiringSoon(item.expiryDate);
                    return (
                      <div key={`${item.id}-${item.batchId}`} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <img
                            src={item.image}
                            alt={item.productName}
                            className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 truncate">{item.productName}</h3>
                            <p className="text-sm text-slate-600 capitalize">{item.category || 'No category'}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`${stockStatus.color} border-0 text-xs`} variant="secondary">
                                {stockStatus.text}
                              </Badge>
                              {expiringSoon && (
                                <div className="flex items-center gap-1 text-orange-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span className="text-xs font-medium">Expiring Soon</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-slate-600">Quantity:</span>
                            <span className="font-bold ml-1">{item.quantity}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">MRP:</span>
                            <span className="font-medium ml-1">₹{(Number(item.mrp) || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Invoice Price:</span>
                            <span className="font-medium ml-1">₹{(Number(item.invoicePrice) || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Total Value:</span>
                            <span className="font-bold ml-1">₹{(Number(item.quantity * item.mrp) || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {(item.invoiceDate || item.expiryDate) && (
                          <div className="pt-2 border-t border-slate-100">
                            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                              {item.invoiceDate && (
                                <div>
                                  <span>Invoice:</span>
                                  <span className="ml-1">{formatDate(item.invoiceDate)}</span>
                                </div>
                              )}
                              {item.expiryDate && (
                                <div>
                                  <span>Expiry:</span>
                                  <span className={`ml-1 ${expiringSoon ? 'text-orange-600 font-medium' : ''}`}>
                                    {formatDate(item.expiryDate)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
