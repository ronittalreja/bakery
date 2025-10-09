"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getAuthToken } from "@/hooks/use-auth"; // Import useAuth and getAuthToken
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Plus, Edit, Trash2, Check, AlertTriangle, Search, X } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

interface StockItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  invoicePrice: number;
  mrp: number;
  expiryDate?: string;
  batchNumber?: string;
  addedDate: string;
  invoiceDate?: string;
  image: string;
}

interface Product {
  id: string;
  name: string;
  item_code?: string;
  category?: string;
  shelf_life_days?: number;
  invoice_price: number;
  sale_price: number;
  image_url?: string;
}

interface AdminStockManagementPageProps {
  onBack: () => void;
}

export function AdminStockManagementPage({ onBack }: AdminStockManagementPageProps) {
  const { user, loading: authLoading } = useAuth(); // Get auth state
  const router = useRouter();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProductSelectionOpen, setIsProductSelectionOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formData, setFormData] = useState({
    productName: "",
    category: "",
    quantity: "",
    invoicePrice: "",
    mrp: "",
    expiryDate: "",
    batchNumber: "",
    image: "",
    invoiceDate: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const categories = [
    { value: "Cakes", label: "Cakes" },
    { value: "Pastries", label: "Pastries" },
    { value: "Savouries", label: "Savouries" },
    { value: "Dry Items", label: "Dry Items" },
    { value: "Decorations", label: "Decorations" },
    { value: "Packaging", label: "Packaging" },
  ];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/"); // Adjust to your login route if different
    }
  }, [user, authLoading, router]);

  const fetchProducts = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      const response = await fetch("http://localhost:5000/api/products", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }
      
      const data = await response.json();
      const productsArray = Array.isArray(data) ? data : data.products || data.data || [];
      
      if (Array.isArray(productsArray)) {
        const mapped: Product[] = productsArray.map((p: any) => ({
          id: String(p.id),
          name: p.name || "",
          item_code: p.item_code,
          category: p.category || "",
          shelf_life_days: p.shelf_life_days ?? null,
          invoice_price: Number(p.invoice_price || 0),
          sale_price: Number(p.sale_price || 0),
          image_url: p.image_url || "/placeholder.svg",
        }));
        setProducts(mapped);
      }
    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError(err.message || "Failed to fetch products");
      setTimeout(() => setError(""), 5000);
    }
  };

  useEffect(() => {
    if (!user) return; // Skip fetch if not authenticated
    const fetchStock = async () => {
      setIsLoading(true);
      try {
        const token = getAuthToken();
        if (!token) {
          throw new Error("No authentication token found");
        }
        // Fetch batch-level stock for admin edits
        const response = await fetch(`http://localhost:5000/api/stock?date=${new Date().toISOString().split('T')[0]}&t=${Date.now()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        
        if (response.status === 401) {
          router.push("/"); // Redirect on invalid/expired token
          return;
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stock: ${response.status}`);
        }
        
        const data = await response.json();
        const stockArray = Array.isArray(data) ? data : data.data || [];

        if (!Array.isArray(stockArray)) {
          console.warn("Stock data is not an array, using empty array");
          setStockItems([]);
        } else {
          // Map backend rows to UI StockItem
          const mapped: StockItem[] = stockArray.map((row: any) => ({
            id: String(row.id),
            productId: String(row.product_id),
            productName: row.name || "",
            category: "", // not provided by backend
            quantity: Number(row.quantity || row.available_quantity || 0),
            invoicePrice: Number(row.invoice_price || 0),
            mrp: Number(row.sale_price || 0),
            expiryDate: row.expiry_date || undefined,
            batchNumber: row.invoice_reference || undefined,
            addedDate: row.invoice_date || new Date().toISOString().split('T')[0],
            invoiceDate: row.invoice_date || undefined,
            image: row.image_url || "/placeholder.svg",
          }));
          setStockItems(mapped);
        }
      } catch (err: any) {
        console.error("Error fetching stock:", err);
        setError(err.message || "Failed to fetch stock data");
        setStockItems([]);
        setTimeout(() => setError(""), 5000);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStock();
    fetchProducts();
  }, [user]);

  const resetForm = () => {
    setFormData({
      productName: "",
      category: "",
      quantity: "",
      invoicePrice: "",
      mrp: "",
      expiryDate: "",
      batchNumber: "",
      image: "",
      invoiceDate: "",
    });
    setEditingItem(null);
    setSelectedProduct(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsProductSelectionOpen(true);
  };

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      productName: product.name,
      category: product.category || "",
      quantity: "",
      invoicePrice: product.invoice_price.toString(),
      mrp: product.sale_price.toString(),
      expiryDate: "",
      batchNumber: "",
      image: product.image_url || "/placeholder.svg",
      invoiceDate: new Date().toISOString().split('T')[0],
    });
    setIsProductSelectionOpen(false);
    setIsDialogOpen(true);
  };

  const calculateExpiryDate = (invoiceDate: string, shelfLifeDays: number | null) => {
    if (!shelfLifeDays || shelfLifeDays <= 0) return "";
    const invoiceDateObj = new Date(invoiceDate);
    invoiceDateObj.setDate(invoiceDateObj.getDate() + shelfLifeDays);
    return invoiceDateObj.toISOString().split('T')[0];
  };

  const openEditDialog = (item: StockItem) => {
    setEditingItem(item);
    setFormData({
      productName: item.productName || "",
      category: item.category || "",
      quantity: (item.quantity ?? 0).toString(),
      invoicePrice: (item.invoicePrice ?? 0).toString(),
      mrp: (item.mrp ?? 0).toString(),
      expiryDate: item.expiryDate || "",
      batchNumber: item.batchNumber || "",
      image: item.image || "",
      invoiceDate: item.invoiceDate || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      const quantity = parseInt(formData.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error("Valid quantity is required");
      }

      if (editingItem) {
        // Update existing stock batch
      const response = await fetch(`http://localhost:5000/api/stock/update`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
          body: JSON.stringify({ 
            batchId: editingItem.id, 
            quantity, 
            expiryDate: formData.expiryDate || null,
            reason: "Admin adjustment" 
          }),
      });

      if (response.status === 401) {
        router.push("/");
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update stock");
      }

      setSuccessMessage("Stock updated successfully!");
      } else {
        // Add new stock batch
        if (!selectedProduct) {
          throw new Error("Please select a product");
        }

        const invoiceDate = formData.invoiceDate || new Date().toISOString().split('T')[0];
        const expiryDate = calculateExpiryDate(invoiceDate, selectedProduct.shelf_life_days ?? null);

        const response = await fetch(`http://localhost:5000/api/stock/add-batch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId: selectedProduct.id,
            quantity,
            invoiceDate,
            invoiceReference: formData.batchNumber || `BATCH-${Date.now()}`,
          }),
        });

        if (response.status === 401) {
          router.push("/");
          return;
        }
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to add stock batch");
        }

        setSuccessMessage("Stock batch added successfully!");
      }

      // Refetch stock data
      await new Promise((r) => setTimeout(r, 200));
      const token2 = getAuthToken();
      if (token2) {
        const ref = await fetch(`http://localhost:5000/api/stock?date=${new Date().toISOString().split('T')[0]}&t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token2}` },
        });
        const refData = await ref.json();
        const stockArray = Array.isArray(refData) ? refData : refData.data || [];
        const mapped: StockItem[] = Array.isArray(stockArray) ? stockArray.map((row: any) => ({
          id: String(row.id),
          productId: String(row.product_id),
          productName: row.name || "",
          category: "",
          quantity: Number(row.quantity || row.available_quantity || 0),
          invoicePrice: Number(row.invoice_price || 0),
          mrp: Number(row.sale_price || 0),
          expiryDate: row.expiry_date || undefined,
          batchNumber: row.invoice_reference || undefined,
          addedDate: row.invoice_date || new Date().toISOString().split('T')[0],
          invoiceDate: row.invoice_date || undefined,
          image: row.image_url || "/placeholder.svg",
        })) : [];
        setStockItems(mapped);
      }
      
      setIsDialogOpen(false);
      resetForm();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error saving stock:", err);
      setError(err.message || "Failed to save stock item");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this stock batch? This action cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      const response = await fetch(`http://localhost:5000/api/stock/batch/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (response.status === 401) {
        router.push("/");
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete stock batch");
      }
      
      // Refetch stock data
      const ref = await fetch(`http://localhost:5000/api/stock?date=${new Date().toISOString().split('T')[0]}&t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refData = await ref.json();
      const stockArray = Array.isArray(refData) ? refData : refData.data || [];
      const mapped: StockItem[] = Array.isArray(stockArray) ? stockArray.map((row: any) => ({
        id: String(row.id),
        productId: String(row.product_id),
        productName: row.name || "",
        category: "",
        quantity: Number(row.quantity || row.available_quantity || 0),
        invoicePrice: Number(row.invoice_price || 0),
        mrp: Number(row.sale_price || 0),
        expiryDate: row.expiry_date || undefined,
        batchNumber: row.invoice_reference || undefined,
        addedDate: row.invoice_date || new Date().toISOString().split('T')[0],
        invoiceDate: row.invoice_date || undefined,
        image: row.image_url || "/placeholder.svg",
      })) : [];
      setStockItems(mapped);
      
      setSuccessMessage("Stock batch deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error deleting stock batch:", err);
      setError(err.message || "Failed to delete stock batch");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    try {
      const today = new Date();
      const expiry = new Date(expiryDate);
      if (isNaN(expiry.getTime())) return false;
      
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays >= 0; // Within 7 days
    } catch {
      return false;
    }
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { color: "bg-red-100 text-red-800", text: "Out of Stock" };
    if (quantity <= 3) return { color: "bg-yellow-100 text-yellow-800", text: "Low Stock" };
    return { color: "bg-green-100 text-green-800", text: "In Stock" };
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "Cakes":
        return "bg-pink-100 text-pink-800";
      case "Pastries":
        return "bg-yellow-100 text-yellow-800";
      case "Savouries":
        return "bg-orange-100 text-orange-800";
      case "Dry Items":
        return "bg-green-100 text-green-800";
      case "Decorations":
        return "bg-purple-100 text-purple-800";
      case "Packaging":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Safe filtering with null checks
  const filteredItems = Array.isArray(stockItems)
    ? stockItems.filter((item) => {
        if (!item || typeof item !== "object") return false;
        
        const productName = item.productName || "";
        const batchNumber = item.batchNumber || "";
        const category = item.category || "";
        
        const matchesSearch =
          searchTerm === "" ||
          productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
          
        const matchesCategory = categoryFilter === "all" || category === categoryFilter;
        
        return matchesSearch && matchesCategory;
      })
    : [];

  // Safe calculations with default values
  const mrpValue = filteredItems.reduce((sum, item) => {
    const mrp = typeof item.mrp === "number" ? item.mrp : 0;
    const quantity = typeof item.quantity === "number" ? item.quantity : 0;
    return sum + mrp * quantity;
  }, 0);

  const invoiceValue = filteredItems.reduce((sum, item) => {
    const invoicePrice = typeof item.invoicePrice === "number" ? item.invoicePrice : 0;
    const quantity = typeof item.quantity === "number" ? item.quantity : 0;
    return sum + invoicePrice * quantity;
  }, 0);

  const totalItems = filteredItems.reduce((sum, item) => {
    const quantity = typeof item.quantity === "number" ? item.quantity : 0;
    return sum + quantity;
  }, 0);

  return (
    <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                Stock Management
              </h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">Add, edit, and manage inventory stock levels</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={openAddDialog} className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200">
                <Plus className="h-4 w-4" />
                Add Stock
              </Button>
            </div>
          </div>
        </div>

        {successMessage && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{filteredItems.length}</div>
            <div className="text-sm text-slate-600">Stock Items</div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalItems}</div>
            <div className="text-sm text-slate-600">Total Quantity</div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">₹{mrpValue.toLocaleString()}</div>
            <div className="text-sm text-slate-600">MRP Stock Value</div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold text-green-600">₹{invoiceValue.toLocaleString()}</div>
            <div className="text-sm text-slate-600">Invoice Cost Stock Value</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Search by product name or batch number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 bg-white border-slate-300 focus:border-slate-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Stock Inventory</h2>
            <p className="text-slate-600 mt-1 text-sm">
              Showing {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8 text-slate-600">Loading stock data...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-slate-600">No stock available</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Invoice Price</TableHead>
                      <TableHead>MRP</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const stockStatus = getStockStatus(item.quantity || 0);
                      const expiringSoon = isExpiringSoon(item.expiryDate);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <img
                              src={item.image || "/placeholder.svg"}
                              alt={item.productName || "Product"}
                              className="w-12 h-12 object-cover rounded-md"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/placeholder.svg";
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.productName || "N/A"}</TableCell>
                          <TableCell>
                            <Badge
                              className={`${getCategoryBadgeColor(item.category)} border-0`}
                              variant="secondary"
                            >
                              {item.category || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">{item.quantity || 0}</TableCell>
                          <TableCell>₹{(item.invoicePrice || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{(item.mrp || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-sm">{item.batchNumber || "-"}</TableCell>
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
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(item)}
                                disabled={isLoading}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(item.id)}
                                disabled={isLoading}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
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

        {/* Product Selection Modal */}
        <Dialog open={isProductSelectionOpen} onOpenChange={setIsProductSelectionOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-2xl font-bold text-slate-900">Select Product to Add Stock</DialogTitle>
              <DialogDescription className="text-slate-600">
                Choose a product from the list to add stock for. Click on any product card to select it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map((product) => (
                  <div 
                    key={product.id} 
                    className="group hover:shadow-xl transition-all duration-300 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden cursor-pointer hover:border-slate-300"
                    onClick={() => selectProduct(product)}
                  >
                    <div className="relative">
                      <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                        <img
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          className="h-20 w-20 object-cover rounded-lg shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge 
                          variant="secondary" 
                          className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 border-blue-200"
                        >
                          {product.category || "PRODUCT"}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm mb-2 text-slate-800 line-clamp-2 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                          <span className="text-2xl font-bold text-slate-900">₹{product.sale_price}</span>
                          <span className="text-xs text-slate-500">Sale Price</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-1">Cost Price</div>
                          <div className="text-sm font-medium text-slate-700">₹{product.invoice_price}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-slate-500">
                          Code: <span className="font-medium">{product.item_code || "N/A"}</span>
                        </div>
                        {product.shelf_life_days && (
                          <div className="text-xs text-slate-500">
                            Shelf: <span className="font-medium">{product.shelf_life_days}d</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-100 rounded-lg p-3">
                        <div className="text-center">
                          <span className="text-sm font-medium text-slate-700">Click to Add Stock</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {products.length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">No Products Available</h3>
                  <p className="text-slate-500">Please add products first in the Manage Products section.</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-6 border-t border-slate-200">
              <Button 
                variant="outline" 
                onClick={() => setIsProductSelectionOpen(false)} 
                className="px-6 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stock Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-xl font-bold text-slate-900">{editingItem ? "Edit Stock Item" : "Add New Stock Item"}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {editingItem ? "Update stock item information" : "Enter details for the new stock item"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingItem && selectedProduct && (
              <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Selected Product</Label>
                  <div className="flex items-center space-x-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
                    <img
                      src={selectedProduct.image_url || "/placeholder.svg"}
                      alt={selectedProduct.name}
                      className="w-10 h-10 object-cover rounded-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-slate-900">{selectedProduct.name}</p>
                      <p className="text-xs text-slate-500">{selectedProduct.item_code || "No code"}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(null);
                        setIsDialogOpen(false);
                        setIsProductSelectionOpen(true);
                      }}
                      className="bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
              </div>
              )}

              {editingItem ? (
                // Edit mode - show quantity and expiry date
                <>
              <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Product</Label>
                    <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                      <p className="font-medium text-slate-900">{editingItem.productName}</p>
                      <p className="text-sm text-slate-500">Batch: {editingItem.batchNumber || "N/A"}</p>
                    </div>
              </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-sm font-medium text-slate-700">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="10"
                    required
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate" className="text-sm font-medium text-slate-700">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
                </>
              ) : (
                // Add mode - show quantity and invoice date
                <>
                <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-sm font-medium text-slate-700">Quantity</Label>
                  <Input
                      id="quantity"
                    type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="10"
                    required
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoiceDate" className="text-sm font-medium text-slate-700">Invoice Date</Label>
                  <Input
                      id="invoiceDate"
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => {
                        const newInvoiceDate = e.target.value;
                        const expiryDate = calculateExpiryDate(newInvoiceDate, selectedProduct?.shelf_life_days || null);
                        setFormData({ 
                          ...formData, 
                          invoiceDate: newInvoiceDate,
                          expiryDate: expiryDate
                        });
                      }}
                    required
                    disabled={isLoading}
                      max={new Date().toISOString().split('T')[0]}
                      className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
                  {selectedProduct?.shelf_life_days && formData.invoiceDate && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Calculated Expiry Date</Label>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">
                          {calculateExpiryDate(formData.invoiceDate, selectedProduct.shelf_life_days)}
                        </p>
                        <p className="text-xs text-blue-600">
                          Based on {selectedProduct.shelf_life_days} days shelf life
                        </p>
              </div>
              </div>
                  )}
              <div className="space-y-2">
                    <Label htmlFor="batchNumber" className="text-sm font-medium text-slate-700">Batch/Reference Number (Optional)</Label>
                <Input
                      id="batchNumber"
                      value={formData.batchNumber}
                      onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                      placeholder="BATCH-001"
                  disabled={isLoading}
                      maxLength={50}
                      className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
                </>
              )}

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200" 
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : editingItem ? "Update Stock" : "Add Stock"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)} 
                  disabled={isLoading}
                  className="bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}