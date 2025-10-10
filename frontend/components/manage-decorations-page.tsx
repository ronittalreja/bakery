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
import { Sparkles, Plus, Edit, Trash2, Check, ArrowLeft, AlertTriangle, Package, RefreshCw, History, Calendar } from "lucide-react";

interface Decoration {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  image: string;
}

interface StockHistoryEntry {
  id: string;
  decorationId: string;
  decorationName: string;
  decorationSku: string;
  quantityAdded: number;
  addedDate: string;
  addedTime: string;
  reason?: string;
}

interface ManageDecorationsPageProps {
  onBack: () => void;
}

export function ManageDecorationsPage({ onBack }: ManageDecorationsPageProps) {
  const { user, loading: authLoading } = useAuth(); // Add useAuth
  const router = useRouter(); // Add useRouter
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDecoration, setEditingDecoration] = useState<Decoration | null>(null);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "",
    price: "",
    costPrice: "",
    stock: "",
    image: "",
  });
  const [stockAdjustment, setStockAdjustment] = useState({
    decorationId: "",
    adjustment: "",
    reason: "",
  });
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [selectedDecorationForStock, setSelectedDecorationForStock] = useState<Decoration | null>(null);
  const [addStockQuantity, setAddStockQuantity] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const categories = [
    { value: "candles", label: "Candles" },
    { value: "party", label: "Party Items" },
    { value: "spray", label: "Sprays" },
    { value: "utensils", label: "Utensils" },
    { value: "disposable", label: "Disposable Items" },
    { value: "balloons", label: "Balloons" },
    { value: "ribbons", label: "Ribbons & Bows" },
    { value: "toppers", label: "Cake Toppers" },
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const fetchDecorations = async (isRefresh = false) => {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/decorations", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.status === 401) {
        router.push("/login"); // Redirect on invalid/expired token
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch decorations: ${response.status}`);
      }
      const data = await response.json();
      const decorationsArray = Array.isArray(data) ? data : data.decorations || data.data || [];
      const mappedDecorations = decorationsArray.map((d: any) => ({
        id: String(d.id),
        sku: d.sku || "",
        name: d.name || "",
        category: d.category || "",
        price: Number(d.sale_price || 0),
        costPrice: Number(d.cost || 0),
        stock: Number(d.stock_quantity || 0),
        image: d.image_url || "/placeholder.svg",
      }));
      setDecorations(mappedDecorations);
    } catch (err: any) {
      console.error("Error fetching decorations:", err);
      setError(err.message || "Failed to fetch decorations");
      setDecorations([]);
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchStockHistory = async (month: string) => {
    setIsLoadingHistory(true);
    try {
      // Get stock history from localStorage
      const storedHistory = localStorage.getItem('decorationStockHistory');
      let allHistory: StockHistoryEntry[] = storedHistory ? JSON.parse(storedHistory) : [];
      
      // Filter by selected month (month is in YYYY-MM format)
      const filteredHistory = allHistory.filter(entry => {
        // Convert DD-MM-YYYY to YYYY-MM for comparison
        const dateParts = entry.addedDate.split('-');
        if (dateParts.length === 3) {
          const [dayPart, monthPart, yearPart] = dateParts; // DD-MM-YYYY
          const entryMonth = `${yearPart}-${monthPart}`;
          return entryMonth === month;
        }
        return false;
      });
      
      setStockHistory(filteredHistory);
    } catch (err: any) {
      console.error("Error fetching stock history:", err);
      setError(err.message || "Failed to fetch stock history");
      setStockHistory([]);
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const addStockHistoryEntry = (decoration: Decoration, quantityAdded: number, reason?: string) => {
    const now = new Date();
    
    // Format date as DD-MM-YYYY
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;
    
    // Format time as 12-hour format
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert to 12-hour format
    const formattedTime = `${displayHours}:${minutes} ${ampm}`;
    
    const newEntry: StockHistoryEntry = {
      id: `entry_${Date.now()}`,
      decorationId: decoration.id,
      decorationName: decoration.name,
      decorationSku: decoration.sku,
      quantityAdded: quantityAdded,
      addedDate: formattedDate,
      addedTime: formattedTime,
      reason: reason || "Stock addition"
    };

    // Get existing history from localStorage
    const storedHistory = localStorage.getItem('decorationStockHistory');
    let allHistory: StockHistoryEntry[] = storedHistory ? JSON.parse(storedHistory) : [];
    
    // Add new entry
    allHistory.unshift(newEntry); // Add to beginning of array
    
    // Store back to localStorage
    localStorage.setItem('decorationStockHistory', JSON.stringify(allHistory));
    
    // Update current state if we're on history tab
    if (activeTab === "history") {
      const filteredHistory = allHistory.filter(entry => {
        // Convert DD-MM-YYYY to YYYY-MM for comparison
        const dateParts = entry.addedDate.split('-');
        if (dateParts.length === 3) {
          const [dayPart, monthPart, yearPart] = dateParts; // DD-MM-YYYY
          const entryMonth = `${yearPart}-${monthPart}`;
          return entryMonth === selectedMonth;
        }
        return false;
      });
      setStockHistory(filteredHistory);
    }
  };

  useEffect(() => {
    if (!user) return; // Skip fetch if not authenticated
    fetchDecorations();
  }, [user]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchStockHistory(selectedMonth);
    }
  }, [activeTab, selectedMonth]);

  const resetForm = () => {
    setFormData({
      sku: "",
      name: "",
      category: "",
      price: "",
      costPrice: "",
      stock: "",
      image: "",
    });
    setEditingDecoration(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (decoration: Decoration) => {
    setEditingDecoration(decoration);
    setFormData({
      sku: decoration.sku || "",
      name: decoration.name || "",
      category: decoration.category || "",
      price: (decoration.price ?? 0).toString(),
      costPrice: (decoration.costPrice ?? 0).toString(),
      stock: (decoration.stock ?? 0).toString(),
      image: decoration.image || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      // Enhanced validation
      if (!formData.sku.trim()) {
        throw new Error("SKU is required");
      }
      if (formData.sku.trim().length < 3) {
        throw new Error("SKU must be at least 3 characters long");
      }
      if (!formData.name.trim()) {
        throw new Error("Name is required");
      }
      if (formData.name.trim().length < 2) {
        throw new Error("Name must be at least 2 characters long");
      }
      if (!formData.category) {
        throw new Error("Category is required");
      }
      
      const price = parseFloat(formData.price);
      const costPrice = parseFloat(formData.costPrice);
      const stock = parseInt(formData.stock);
      
      if (isNaN(price) || price < 0) {
        throw new Error("Valid price is required (must be 0 or greater)");
      }
      if (price > 10000) {
        throw new Error("Price cannot exceed ₹10,000");
      }
      if (isNaN(costPrice) || costPrice < 0) {
        throw new Error("Valid cost price is required (must be 0 or greater)");
      }
      if (costPrice > 10000) {
        throw new Error("Cost price cannot exceed ₹10,000");
      }
      if (isNaN(stock) || stock < 0) {
        throw new Error("Valid stock quantity is required (must be 0 or greater)");
      }
      if (stock > 10000) {
        throw new Error("Stock quantity cannot exceed 10,000");
      }
      
      // Check for duplicate SKU when adding new decoration
      if (!editingDecoration) {
        const existingDecoration = decorations.find(d => d.sku.toLowerCase() === formData.sku.trim().toLowerCase());
        if (existingDecoration) {
          throw new Error("A decoration with this SKU already exists");
        }
      }
      
      const decorationData = {
        sku: formData.sku.trim().toUpperCase(),
        name: formData.name.trim(),
        category: formData.category,
        price,
        costPrice,
        stock,
        image: formData.image?.trim() || "/placeholder.svg",
      };
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/decorations${editingDecoration ? `/${editingDecoration.id}` : ""}`,
        {
          method: editingDecoration ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(decorationData),
        }
      );
      
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      
      if (!response.ok) {
        let errorMessage = editingDecoration ? "Failed to update decoration" : "Failed to add decoration";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // Refresh decorations to get updated data
      await fetchDecorations(true);
      setSuccessMessage(editingDecoration ? "Decoration updated successfully!" : "Decoration added successfully!");
      
      setIsDialogOpen(false);
      resetForm();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error saving decoration:", err);
      setError(err.message || "Failed to save decoration");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (decorationId: string) => {
    const decoration = decorations.find(d => d.id === decorationId);
    if (!decoration) {
      setError("Decoration not found");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${decoration.name}"? This action cannot be undone.`)) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/decorations/${decorationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      
      if (!response.ok) {
        let errorMessage = "Failed to delete decoration";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // Refresh decorations to get updated data
      await fetchDecorations(true);
      setSuccessMessage(`Decoration "${decoration.name}" deleted successfully!`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error deleting decoration:", err);
      setError(err.message || "Failed to delete decoration");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const openStockAdjustmentDialog = (decoration: Decoration) => {
    setStockAdjustment({
      decorationId: decoration.id,
      adjustment: "",
      reason: "",
    });
    setShowStockDialog(true);
  };

  const openAddStockDialog = () => {
    setShowAddStockDialog(true);
    setSelectedDecorationForStock(null);
    setAddStockQuantity("");
  };

  const selectDecorationForStock = (decoration: Decoration) => {
    setSelectedDecorationForStock(decoration);
    setAddStockQuantity("");
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDecorationForStock) {
      setError("Please select a decoration");
      return;
    }

    const quantity = parseInt(addStockQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const newStock = selectedDecorationForStock.stock + quantity;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/decorations/${selectedDecorationForStock.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku: selectedDecorationForStock.sku,
          name: selectedDecorationForStock.name,
          category: selectedDecorationForStock.category,
          price: selectedDecorationForStock.price,
          costPrice: selectedDecorationForStock.costPrice,
          stock: newStock,
          image: selectedDecorationForStock.image,
        }),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Failed to add stock");
      }

      // Add to stock history
      addStockHistoryEntry(selectedDecorationForStock, quantity, "Stock addition");

      // Refresh decorations to get updated data
      await fetchDecorations(true);

      setShowAddStockDialog(false);
      setSelectedDecorationForStock(null);
      setAddStockQuantity("");
      setSuccessMessage(`Stock added successfully! New stock: ${newStock}`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error adding stock:", err);
      setError(err.message || "Failed to add stock");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      const adjustment = parseInt(stockAdjustment.adjustment);
      if (isNaN(adjustment)) {
        throw new Error("Please enter a valid adjustment amount");
      }
      
      if (!stockAdjustment.reason.trim()) {
        throw new Error("Please provide a reason for the stock adjustment");
      }
      
      const decoration = decorations.find(d => d.id === stockAdjustment.decorationId);
      if (!decoration) {
        throw new Error("Decoration not found");
      }
      
      const newStock = decoration.stock + adjustment;
      if (newStock < 0) {
        throw new Error("Stock cannot be negative");
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/decorations/${stockAdjustment.decorationId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku: decoration.sku,
          name: decoration.name,
          category: decoration.category,
          price: decoration.price,
          costPrice: decoration.costPrice,
          stock: newStock,
          image: decoration.image,
        }),
      });
      
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Failed to update stock");
      }
      
      // Refresh decorations to get updated data
      await fetchDecorations(true);
      
      setShowStockDialog(false);
      setStockAdjustment({ decorationId: "", adjustment: "", reason: "" });
      setSuccessMessage(`Stock adjusted successfully! New stock: ${newStock}`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error adjusting stock:", err);
      setError(err.message || "Failed to adjust stock");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "candles":
        return "bg-yellow-100 text-yellow-800";
      case "party":
        return "bg-pink-100 text-pink-800";
      case "spray":
        return "bg-blue-100 text-blue-800";
      case "utensils":
        return "bg-gray-100 text-gray-800";
      case "disposable":
        return "bg-green-100 text-green-800";
      case "balloons":
        return "bg-purple-100 text-purple-800";
      case "ribbons":
        return "bg-red-100 text-red-800";
      case "toppers":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { color: "bg-red-100 text-red-800", text: "Out of Stock" };
    if (stock <= 10) return { color: "bg-yellow-100 text-yellow-800", text: "Low Stock" };
    return { color: "bg-green-100 text-green-800", text: "In Stock" };
  };

  const totalValue = Array.isArray(decorations)
    ? decorations.reduce((sum, item) => {
        const costPrice = typeof item.costPrice === "number" ? item.costPrice : 0;
        const stock = typeof item.stock === "number" ? item.stock : 0;
        return sum + costPrice * stock;
      }, 0)
    : 0;

  const totalItems = Array.isArray(decorations)
    ? decorations.reduce((sum, item) => {
        const stock = typeof item.stock === "number" ? item.stock : 0;
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
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
                Manage Decorations
              </h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">Add, edit, and delete decoration items</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={openAddStockDialog} 
                className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
              >
                <Package className="h-4 w-4" />
                Add Stock
              </Button>
              <Button onClick={openAddDialog} className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200">
                <Plus className="h-4 w-4" />
                Add Decoration
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

        {/* Tab Slider */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === "inventory"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className="h-4 w-4" />
              Inventory
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === "history"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="h-4 w-4" />
              History
            </button>
          </div>
        </div>

        {activeTab === "inventory" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{decorations.length}</div>
            <div className="text-sm text-slate-600">Decoration Items</div>
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
            <h2 className="text-lg font-bold text-slate-900">Decoration Inventory</h2>
            <p className="text-slate-600 mt-1 text-sm">
              Showing {decorations.length} item{decorations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8 text-slate-600">Loading decorations...</div>
            ) : decorations.length === 0 ? (
              <div className="text-center py-8 text-slate-600">No decorations available</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Sale Price</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Stock Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decorations.map((decoration) => {
                      const stockStatus = getStockStatus(decoration.stock || 0);
                      return (
                        <TableRow key={decoration.id}>
                          <TableCell>
                            <img
                              src={decoration.image || "/placeholder.svg"}
                              alt={decoration.name || "Decoration"}
                              className="w-12 h-12 object-cover rounded-md"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/placeholder.svg";
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{decoration.sku || "N/A"}</TableCell>
                          <TableCell className="font-medium">{decoration.name || "N/A"}</TableCell>
                          <TableCell>
                            <Badge
                              className={`${getCategoryBadgeColor(decoration.category)} border-0`}
                              variant="secondary"
                            >
                              {decoration.category || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{(decoration.price || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{(decoration.costPrice || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-bold">{decoration.stock || 0}</TableCell>
                          <TableCell className="font-bold text-green-600">₹{((decoration.stock || 0) * (decoration.costPrice || 0)).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={`${stockStatus.color} border-0`} variant="secondary">
                              {stockStatus.text}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(decoration)}
                                disabled={isLoading}
                                title="Edit decoration"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openStockAdjustmentDialog(decoration)}
                                disabled={isLoading}
                                title="Adjust stock"
                              >
                                <Package className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(decoration.id)}
                                disabled={isLoading}
                                title="Delete decoration"
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
          </>
        )}

        {activeTab === "history" && (
          <>
            {/* Month Filter and Summary */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Calendar className="h-5 w-5 text-slate-600" />
                  <div className="flex items-center gap-2">
                    <Label htmlFor="monthFilter" className="text-sm font-medium text-slate-700">Filter by Month:</Label>
                    <Input
                      id="monthFilter"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-40 bg-white border-slate-300 focus:border-slate-500"
                    />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-3 sm:p-4">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-bold text-green-700">
                      ₹{stockHistory.reduce((total, entry) => {
                        const decoration = decorations.find(d => d.id === entry.decorationId);
                        const costPrice = decoration?.costPrice || 0;
                        return total + (entry.quantityAdded * costPrice);
                      }, 0).toLocaleString()}
                    </div>
                    <div className="text-xs sm:text-sm text-green-600 font-medium">Total Value Added</div>
                  </div>
                </div>
              </div>
            </div>

            {/* History Cards */}
            <div className="space-y-4">
              {isLoadingHistory ? (
                <div className="text-center py-8 text-slate-600">Loading stock history...</div>
              ) : stockHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-600">No stock additions found for this month</div>
              ) : (
                stockHistory.map((entry) => (
                  <div key={entry.id} className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                          <Package className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{entry.decorationName}</h3>
                          <p className="text-sm text-slate-600">SKU: {entry.decorationSku}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-600">Quantity Added:</span>
                              <span className="font-semibold text-green-600">+{entry.quantityAdded}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-600">Date:</span>
                              <span className="text-sm font-medium">{entry.addedDate}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-600">Time:</span>
                              <span className="text-sm font-medium">{entry.addedTime}</span>
                            </div>
                          </div>
                          {entry.reason && (
                            <div className="mt-2">
                              <span className="text-sm text-slate-600">Reason: </span>
                              <span className="text-sm font-medium text-slate-700">{entry.reason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-xl font-bold text-slate-900">{editingDecoration ? "Edit Decoration" : "Add New Decoration"}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {editingDecoration ? "Update decoration item details" : "Enter details for the new decoration item"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sku" className="text-sm font-medium text-slate-700">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g., DEC-CAN-001"
                  required
                  disabled={isLoading}
                  maxLength={20}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Birthday Candle Set"
                  required
                  disabled={isLoading}
                  maxLength={100}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium text-slate-700">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="bg-white border-slate-300 focus:border-slate-500">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium text-slate-700">Sale Price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="50.00"
                    required
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPrice" className="text-sm font-medium text-slate-700">Cost Price (₹)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="30.00"
                    required
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock" className="text-sm font-medium text-slate-700">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="100"
                  required
                  disabled={isLoading}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image" className="text-sm font-medium text-slate-700">Image URL</Label>
                <Input
                  id="image"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="/images/candle.jpg"
                  disabled={isLoading}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200" 
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : editingDecoration ? "Update Decoration" : "Add Decoration"}
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

        <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
          <DialogContent className="max-w-md bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-xl font-bold text-slate-900">Adjust Stock</DialogTitle>
              <DialogDescription className="text-slate-600">
                Adjust the stock quantity for this decoration item
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleStockAdjustment} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Current Stock</Label>
                <div className="text-lg font-semibold text-slate-900 bg-slate-100 rounded-lg p-3">
                  {decorations.find(d => d.id === stockAdjustment.decorationId)?.stock || 0} units
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment" className="text-sm font-medium text-slate-700">Adjustment Amount</Label>
                <Input
                  id="adjustment"
                  type="number"
                  value={stockAdjustment.adjustment}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, adjustment: e.target.value })}
                  placeholder="Enter positive or negative number"
                  required
                  disabled={isLoading}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
                <p className="text-xs text-slate-500">
                  Use positive numbers to add stock, negative to reduce
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium text-slate-700">Reason</Label>
                <Input
                  id="reason"
                  value={stockAdjustment.reason}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                  placeholder="e.g., Restock, Damaged items, etc."
                  required
                  disabled={isLoading}
                  className="bg-white border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200" 
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : "Adjust Stock"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowStockDialog(false)}
                  disabled={isLoading}
                  className="bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Stock Dialog */}
        <Dialog open={showAddStockDialog} onOpenChange={setShowAddStockDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-2xl font-bold text-slate-900">Add Stock to Decorations</DialogTitle>
              <DialogDescription className="text-slate-600">
                Select a decoration and enter the quantity to add to its stock.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {!selectedDecorationForStock ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {decorations.map((decoration) => (
                    <div 
                      key={decoration.id} 
                      className="group hover:shadow-xl transition-all duration-300 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden cursor-pointer hover:border-slate-300"
                      onClick={() => selectDecorationForStock(decoration)}
                    >
                        <div className="relative">
                          <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100">
                            <img
                              src={decoration.image || "/placeholder.svg"}
                              alt={decoration.name}
                              className="h-20 w-20 object-cover rounded-lg shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/placeholder.svg";
                              }}
                            />
                          </div>
                          <div className="absolute top-2 right-2">
                            <Badge 
                              variant="secondary" 
                              className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 border-purple-200"
                            >
                              {decoration.category || "DECORATION"}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-sm mb-2 text-slate-800 line-clamp-2 group-hover:text-purple-600 transition-colors">{decoration.name}</h3>
                          
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex flex-col">
                              <span className="text-2xl font-bold text-slate-900">₹{decoration.price}</span>
                              <span className="text-xs text-slate-500">Sale Price</span>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500 mb-1">Current Stock</div>
                              <div className="text-sm font-medium text-slate-700">{decoration.stock}</div>
                            </div>
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
              ) : (
                <form onSubmit={handleAddStock} className="space-y-4">
                  <div className="p-4 bg-slate-100 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedDecorationForStock.image || "/placeholder.svg"}
                        alt={selectedDecorationForStock.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-slate-900">{selectedDecorationForStock.name}</h3>
                        <p className="text-sm text-slate-600">SKU: {selectedDecorationForStock.sku}</p>
                        <p className="text-sm text-slate-600">Current Stock: {selectedDecorationForStock.stock} units</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDecorationForStock(null)}
                        className="ml-auto bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                      >
                        <span className="text-xl leading-none">×</span>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addStockQuantity" className="text-sm font-medium text-slate-700">Quantity to Add</Label>
                    <Input
                      id="addStockQuantity"
                      type="number"
                      min="1"
                      value={addStockQuantity}
                      onChange={(e) => setAddStockQuantity(e.target.value)}
                      placeholder="Enter quantity to add"
                      required
                      disabled={isLoading}
                      className="bg-white border-slate-300 focus:border-slate-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      type="submit" 
                      className="flex-1 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200" 
                      disabled={isLoading}
                    >
                      {isLoading ? "Adding Stock..." : "Add Stock"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddStockDialog(false)}
                      disabled={isLoading}
                      className="bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}