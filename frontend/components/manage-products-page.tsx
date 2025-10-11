// File: components/manage-products-page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Plus, Edit, Trash2, Check, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dateUtils";

interface Product {
  id: string;
  item_code?: string;
  name: string;
  hsn_code?: string;
  invoice_price: number;
  sale_price: number;
  grm_value: number;
  image_url?: string;
  is_active?: number | boolean;
  // Enriched from aggregated stock
  total_available?: number;
  next_expiry?: string | null;
  category?: string | null;
  shelf_life_days?: number | null;
}

interface ManageProductsPageProps {
  onBack: () => void;
}

export function ManageProductsPage({ onBack }: ManageProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    item_code: "",
    name: "",
    hsn_code: "",
    invoice_price: "",
    sale_price: "",
    grm_value: "",
    image_url: "",
    is_active: "1",
    category: "",
    shelf_life_days: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const categories = [
    { value: "cake", label: "Cake" },
    { value: "pastry", label: "Pastry" },
    { value: "savoury", label: "Savoury" },
    { value: "dry", label: "Dry Items" },
    { value: "decoration", label: "Decoration" },
    { value: "packaging", label: "Packaging" },
  ];

  // Safe token retrieval function - Fixed for Next.js
  const getAuthToken = (): string | null => {
    try {
      // Check if we're on the client side
      if (typeof window === 'undefined') return null;
      
      // Try sessionStorage first, fallback to localStorage if needed
      return sessionStorage.getItem("authToken") || localStorage.getItem("token");
    } catch (error) {
      console.error("Error accessing storage:", error);
      return null;
    }
  };

  const fetchProducts = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/products`, {
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

      // Fetch aggregated stock to enrich with stock and expiry
      const stockResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/stock/aggregated`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const stockData = await stockResp.json();
      const stockArray = Array.isArray(stockData) ? stockData : stockData.data || [];
      const stockByProduct: Record<string, { total_available?: number; next_expiry?: string | null }> = {};
      stockArray.forEach((row: any) => {
        stockByProduct[String(row.product_id)] = {
          total_available: Number(row.total_available || 0),
          next_expiry: row.next_expiry || null,
        };
      });

      if (!Array.isArray(productsArray)) {
        console.warn("Products data is not an array, using empty array");
        setProducts([]);
      } else {
        const mapped = productsArray.map((p: any) => {
          const enrich = stockByProduct[String(p.id)] || {};
          return {
            id: String(p.id),
            item_code: p.item_code,
            name: p.name,
            hsn_code: p.hsn_code,
            invoice_price: Number(p.invoice_price || 0),
            sale_price: Number(p.sale_price || 0),
            grm_value: Number(p.grm_value || 0),
            image_url: p.image_url || "/placeholder.svg",
            is_active: p.is_active,
            category: p.category || null,
            shelf_life_days: p.shelf_life_days ?? null,
            total_available: enrich.total_available || 0,
            next_expiry: enrich.next_expiry || null,
          } as Product;
        });
        setProducts(mapped);
      }
    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError(err.message || "Failed to fetch products");
      setProducts([]);
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const resetForm = () => {
    setFormData({
      item_code: "",
      name: "",
      hsn_code: "",
      invoice_price: "",
      sale_price: "",
      grm_value: "",
      image_url: "",
      is_active: "1",
    });
    setEditingProduct(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      item_code: product.item_code || "",
      name: product.name || "",
      hsn_code: product.hsn_code || "",
      invoice_price: (product.invoice_price ?? 0).toString(),
      sale_price: (product.sale_price ?? 0).toString(),
      grm_value: (product.grm_value ?? 0).toString(),
      image_url: product.image_url || "",
      is_active: String(product.is_active ? 1 : 0),
      category: product.category || "",
      shelf_life_days: product.shelf_life_days != null ? String(product.shelf_life_days) : "",
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

      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error("Name is required");
      }
      const invoice_price = parseFloat(formData.invoice_price);
      const sale_price = parseFloat(formData.sale_price);
      const grm_value = parseFloat(formData.grm_value);
      if (isNaN(invoice_price) || invoice_price < 0) throw new Error("Valid invoice price is required");
      if (isNaN(sale_price) || sale_price < 0) throw new Error("Valid sale price is required");
      if (isNaN(grm_value) || grm_value < 0) throw new Error("Valid GRM value is required");

      const productData = {
        name: formData.name.trim(),
        itemCode: formData.item_code?.trim() || undefined,
        hsnCode: formData.hsn_code?.trim() || undefined,
        invoicePrice: invoice_price,
        salePrice: sale_price,
        grmValue: grm_value,
        imageUrl: formData.image_url?.trim() || "/placeholder.svg",
        isActive: formData.is_active === "1",
        category: formData.category || undefined,
        shelfLifeDays: formData.shelf_life_days ? Number(formData.shelf_life_days) : undefined,
      } as any;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/products${editingProduct ? `/${editingProduct.id}` : ""}`,
        {
          method: editingProduct ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(productData),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || (editingProduct ? "Failed to update product" : "Failed to add product"));
      }

      // Refresh products to get updated data
      await fetchProducts(true);
      setSuccessMessage(editingProduct ? "Product updated successfully!" : "Product added successfully!");
      
      setIsDialogOpen(false);
      resetForm();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error saving product:", err);
      setError(err.message || "Failed to save product");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Failed to delete product");
      }
      
      // Refresh products to get updated data
      await fetchProducts(true);
      setSuccessMessage("Product deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error deleting product:", err);
      setError(err.message || "Failed to delete product");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "cake":
        return "bg-pink-100 text-pink-800";
      case "pastry":
        return "bg-yellow-100 text-yellow-800";
      case "savoury":
        return "bg-orange-100 text-orange-800";
      case "dry":
        return "bg-green-100 text-green-800";
      case "decoration":
        return "bg-purple-100 text-purple-800";
      case "packaging":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { color: "bg-red-100 text-red-800", text: "Out of Stock" };
    if (stock <= 5) return { color: "bg-yellow-100 text-yellow-800", text: "Low Stock" };
    return { color: "bg-green-100 text-green-800", text: "In Stock" };
  };

  const daysUntil = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const today = new Date();
    const d = new Date(dateStr);
    const diff = Math.ceil((d.getTime() - new Date(today.toISOString().split('T')[0]).getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Safe calculations with proper null checks
  const totalValue = Array.isArray(products) 
    ? products.reduce((sum, item) => {
        const price = typeof item.sale_price === 'number' ? item.sale_price : 0;
        const stock = typeof item.total_available === 'number' ? item.total_available : 0;
        return sum + (price * stock);
      }, 0)
    : 0;

  const totalItems = Array.isArray(products)
    ? products.reduce((sum, item) => {
        const stock = typeof item.total_available === 'number' ? item.total_available : 0;
        return sum + stock;
      }, 0)
    : 0;

  return (
    <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
                Manage Products
              </h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">Add, edit, and delete products</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => fetchProducts(true)} 
                disabled={isRefreshing}
                className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={openAddDialog} className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
              <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200">
                <ArrowLeft className="h-4 w-4" />
                Back
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{products.length}</div>
            <div className="text-sm text-slate-600">Product Items</div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalItems}</div>
            <div className="text-sm text-slate-600">Total Stock</div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">₹{totalValue.toLocaleString()}</div>
            <div className="text-sm text-slate-600">Total Stock Value</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Product Inventory</h2>
            <p className="text-slate-600 mt-1 text-sm">
              Showing {products.length} item{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8 text-slate-600">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-slate-600">No products available</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>HSN</TableHead>
                      <TableHead>Sale Price</TableHead>
                      <TableHead>Invoice Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Next Expiry</TableHead>
                      <TableHead>Shelf Life</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const stock = Number(product.total_available || 0);
                      const stockStatus = getStockStatus(stock);
                      const dte = product.next_expiry ? new Date(product.next_expiry) : null;
                      const daysLeft = daysUntil(product.next_expiry);
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <img
                              src={product.image_url || "/placeholder.svg"}
                              alt={product.name || "Product"}
                              className="w-12 h-12 object-cover rounded-md"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/placeholder.svg";
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{product.item_code || "N/A"}</TableCell>
                          <TableCell className="font-medium">{product.name || "N/A"}</TableCell>
                          <TableCell>{product.hsn_code || "-"}</TableCell>
                          <TableCell>₹{(product.sale_price || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{(product.invoice_price || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-bold">{stock}</TableCell>
                          <TableCell className="capitalize">{product.category || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{dte ? dte.toISOString().split("T")[0] : "-"}</TableCell>
                          <TableCell>{
                            product.shelf_life_days != null
                              ? `${product.shelf_life_days} days`
                              : daysLeft == null ? "-" : daysLeft >= 0 ? `${daysLeft} days` : `${Math.abs(daysLeft)} days overdue`
                          }</TableCell>
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
                                onClick={() => openEditDialog(product)}
                                disabled={isLoading}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(product.id)}
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-xl font-bold text-slate-900">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {editingProduct ? "Update product details" : "Enter details for the new product"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item_code" className="text-sm font-medium text-slate-700">Item Code</Label>
                <Input
                  id="item_code"
                  value={formData.item_code}
                  onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                  placeholder="e.g., ITEM-001"
                  disabled={isLoading}
                  maxLength={50}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Chocolate Truffle Cake"
                  required
                  disabled={isLoading}
                  maxLength={100}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hsn_code" className="text-sm font-medium text-slate-700">HSN Code</Label>
                <Input
                  id="hsn_code"
                  value={formData.hsn_code}
                  onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                  placeholder="19059010"
                  disabled={isLoading}
                  maxLength={20}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium text-slate-700">Category</Label>
                  <Select
                    value={String(formData as any).category || (editingProduct?.category || '')}
                    onValueChange={(value) => setFormData({ ...formData, category: value } as any)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="bg-white border-slate-300 focus:border-slate-500">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cakes">Cakes</SelectItem>
                      <SelectItem value="pastries">Pastries</SelectItem>
                      <SelectItem value="savouries">Savouries</SelectItem>
                      <SelectItem value="breads">Breads</SelectItem>
                      <SelectItem value="packing_material">Packing Material</SelectItem>
                      <SelectItem value="cookies">Cookies</SelectItem>
                      <SelectItem value="assorted_cakes">Assorted Cakes</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shelf_life_days" className="text-sm font-medium text-slate-700">Shelf Life (Days)</Label>
                  <Input
                    id="shelf_life_days"
                    type="number"
                    min="0"
                    value={(formData as any).shelf_life_days || (editingProduct?.shelf_life_days ?? '')}
                    onChange={(e) => setFormData({ ...formData, shelf_life_days: e.target.value } as any)}
                    placeholder="3"
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sale_price" className="text-sm font-medium text-slate-700">Sale Price (₹)</Label>
                  <Input
                    id="sale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                    placeholder="500.00"
                    required
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_price" className="text-sm font-medium text-slate-700">Invoice Price (₹)</Label>
                  <Input
                    id="invoice_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.invoice_price}
                    onChange={(e) => setFormData({ ...formData, invoice_price: e.target.value })}
                    placeholder="350.00"
                    required
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grm_value" className="text-sm font-medium text-slate-700">GRM Loss Value (₹)</Label>
                <Input
                  id="grm_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.grm_value}
                  onChange={(e) => setFormData({ ...formData, grm_value: e.target.value })}
                  placeholder="75.00"
                  required
                  disabled={isLoading}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_url" className="text-sm font-medium text-slate-700">Image URL</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://drive.google.com/file/d/FILE_ID/view or direct image URL"
                  disabled={isLoading}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
                <p className="text-xs text-slate-500">
                  Supports Google Drive links and direct image URLs (jpg, png, gif, webp)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active</Label>
                <Select
                  value={formData.is_active}
                  onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="bg-white border-slate-300 focus:border-slate-500">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Active</SelectItem>
                    <SelectItem value="0">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200" 
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : editingProduct ? "Update Product" : "Add Product"}
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