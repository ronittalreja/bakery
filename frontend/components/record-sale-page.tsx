// File: src/pages/RecordSalePage.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Plus, Minus, Check, Sparkles, Percent, AlertCircle, Search, Package, Menu, X, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDateContext } from "@/hooks/use-date-context";
import { useSaleContext } from "@/contexts/SaleContext";

const iconMap = {
  cake: () => <span>🎂</span>,
  candle: () => <span>🕯️</span>,
  popper: () => <span>🎉</span>,
  default: () => <span>📦</span>,
};

interface Product {
  id: string;
  name: string;
  mrp: number;
  invoicePrice: number;
  icon: string;
  stock: number;
  batchId: string;
  imageUrl?: string;
  category?: string;
  shelfLifeDays?: number | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface RecordSalePageProps {
  onBack: () => void;
}

export function RecordSalePage({ onBack }: RecordSalePageProps) {
  const { user } = useAuth();
  const { selectedDate } = useDateContext();
  const { setRefreshSales } = useSaleContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [addonProducts, setAddonProducts] = useState<Product[]>([]);
  const [decorations, setDecorations] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [showAddons, setShowAddons] = useState(true);
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showCategoryMenu, setShowCategoryMenu] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');

  const fetchDecorations = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        setDecorations([]);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/decorations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch decorations: ${response.status}`);
      }
      
      const data = await response.json();
      const decorationsArray = Array.isArray(data) ? data : data.decorations || data.data || [];
      
      const mappedDecorations = decorationsArray.map((d: any) => ({
        id: String(d.id),
        name: d.name || "Unknown Decoration",
        mrp: Number(d.sale_price || 0),
        invoicePrice: Number(d.cost || 0),
        icon: "default",
        stock: Number(d.stock_quantity || 0),
        batchId: "",
        imageUrl: d.image_url || "/placeholder.svg",
        category: d.category || undefined,
        shelfLifeDays: null,
      }));
      
      setDecorations(mappedDecorations.filter((d: Product) => d.stock > 0));
    } catch (err: any) {
      console.error("Error fetching decorations:", err.message);
      setDecorations([]);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        throw new Error(`Invalid or missing selectedDate: ${selectedDate}`);
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Fetching products with token:", token.slice(0, 10) + "...", "and date:", selectedDate);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/stock?group=product&date=${selectedDate}&t=${Date.now()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      console.log("Stock API response status:", response.status, "ok:", response.ok, "headers:", [...response.headers]);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log("Stock API raw response:", JSON.stringify(rawData, null, 2));

      let items: any[] = Array.isArray(rawData) ? rawData : Array.isArray(rawData.data) ? rawData.data : [];

      if ("success" in rawData && !rawData.success) {
        throw new Error(rawData.error || "API returned unsuccessful response");
      }
      if (!items.length) {
        console.warn("No products returned for date:", selectedDate);
        setProducts([]);
        setAddonProducts([]);
        setDecorations([]);
        return;
      }

      const mapProduct = (item: any): Product => {
        const icon = item.name.includes("Candle") ? "candle" :
                     item.name.includes("Popper") ? "popper" :
                     item.name.includes("Cake") || item.name.includes("VEG") ? "cake" : "default";
        const mappedProduct: Product = {
          id: (item.product_id ?? item.id ?? item.productId).toString(),
          name: item.name || "Unknown Product",
          mrp: Number(item.sale_price ?? item.mrp) || Number(item.invoice_price) * 1.33 || 0,
          invoicePrice: Number(item.invoice_price) || 0,
          icon,
          stock: Number(item.total_available ?? item.quantity) || 0,
          batchId: "", // leave empty; backend will allocate FEFO without batchId
          imageUrl: item.image_url || "/placeholder.svg",
          category: item.category || undefined,
          shelfLifeDays: item.shelf_life_days != null ? Number(item.shelf_life_days) : null,
        };
        console.log(`Mapped product:`, JSON.stringify(mappedProduct, null, 2));
        return mappedProduct;
      };

      const mappedProducts = items
        .filter((item: any) => !item.name.includes("Candle") && !item.name.includes("Popper"))
        .map(mapProduct)
        .filter((p: Product) => p.stock > 0);
      const mappedAddons = items
        .filter((item: any) => item.name.includes("Candle") || item.name.includes("Popper"))
        .map(mapProduct)
        .filter((p: Product) => p.stock > 0);

      setProducts(mappedProducts);
      setAddonProducts(mappedAddons);
      console.log("Mapped products:", JSON.stringify(mappedProducts, null, 2));
      console.log("Mapped addons:", JSON.stringify(mappedAddons, null, 2));
    } catch (err: any) {
      console.error("Error fetching products:", err.message, err.stack);
      setError(err.message || "Failed to load products");
      setTimeout(() => setError(""), 5000);
      setProducts([]);
      setAddonProducts([]);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchProducts();
    fetchDecorations();
  }, [fetchProducts, fetchDecorations]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity < product.stock) {
          return prev.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        }
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Real-time stock validation
  const validateStock = async (productId: string, requestedQuantity: number) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) return false;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/stock?group=product&date=${selectedDate}&t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      
      // Try to find product by product_id (numeric) or item_code (string) or name
      const product = data.data?.find((p: any) => 
        p.product_id === Number(productId) || 
        p.product_id === productId ||
        p.item_code === productId ||
        p.name === productId
      );
      
      if (!product) {
        console.log("Product not found in stock data:", productId);
        console.log("Available products:", data.data?.map((p: any) => ({ id: p.product_id, code: p.item_code, name: p.name })));
        return false;
      }
      
      const availableStock = Number(product.total_available || 0);
      console.log(`Stock validation for ${productId}: Available=${availableStock}, Requested=${requestedQuantity}`);
      
      return availableStock >= requestedQuantity;
    } catch (error) {
      console.error("Error validating stock:", error);
      return false;
    }
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      return prev
        .map((item) => (item.product.id === productId ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item))
        .filter((item) => item.quantity > 0);
    });
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + item.product.mrp * item.quantity, 0);
  };

  const getDiscountAmount = () => {
    const subtotal = getSubtotal();
    if (discountType === "percentage") {
      return Math.round((subtotal * discount) / 100);
    }
    return Math.min(discount, subtotal);
  };

  const getTotalAmount = () => {
    return getSubtotal() - getDiscountAmount();
  };

  // Filter products based on search query
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAddonProducts = addonProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDecorations = decorations.filter(decoration =>
    decoration.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get available categories for navigation
  const getAvailableCategories = () => {
    const categories = [];
    
    // Add product categories
    const productCategories = Object.keys(
      filteredProducts.reduce((acc: Record<string, typeof filteredProducts>, p) => {
        const key = (p.category || 'uncategorized').toString();
        if (!acc[key]) acc[key] = [] as any;
        (acc[key] as any).push(p);
        return acc;
      }, {})
    );
    
    productCategories.forEach(cat => {
      categories.push({
        id: `category-${cat}`,
        name: cat.replaceAll('_', ' ').toUpperCase(),
        type: 'category',
        icon: '📦'
      });
    });

    // Add add-ons if available
    if (filteredAddonProducts.length > 0) {
      categories.push({
        id: 'addons',
        name: 'ADD-ONS',
        type: 'addons',
        icon: '➕'
      });
    }

    // Add decorations if available
    if (filteredDecorations.length > 0) {
      categories.push({
        id: 'decorations',
        name: 'DECORATIONS',
        type: 'decorations',
        icon: '🎨'
      });
    }

    return categories;
  };

  // Scroll to category function
  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(categoryId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
    setShowCategoryMenu(false);
  };

  const handleCheckout = async () => {
    if (!paymentMethod || cart.length === 0) {
      setError("Please select a payment method and add items to the cart");
      setTimeout(() => setError(""), 5000);
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Validate stock for all items before proceeding
      for (const item of cart) {
        const product = products.find((p) => p.id === item.product.id) || 
                       addonProducts.find((p) => p.id === item.product.id) ||
                       decorations.find((d) => d.id === item.product.id);
        if (!product) {
          throw new Error(`Product not found: ${item.product.name}`);
        }
        
        // For decorations, check stock directly from the product object
        if (decorations.find((d) => d.id === item.product.id)) {
          if (product.stock < item.quantity) {
            throw new Error(
              `Insufficient stock for decoration: ${item.product.name}. Available: ${product.stock}, Requested: ${item.quantity}`
            );
          }
        } else {
          // Real-time stock validation for regular products
          const hasStock = await validateStock(item.product.id, item.quantity);
          if (!hasStock) {
          throw new Error(
              `Insufficient stock for product: ${item.product.name}. Please refresh and try again.`
            );
          }
        }
      }

      // Calculate separate totals for products vs decorations
      let productMRPTotal = 0;
      let decorationMRPTotal = 0;
      let productCostTotal = 0;
      let decorationCostTotal = 0;

      cart.forEach((item) => {
        const product = products.find((p) => p.id === item.product.id) || 
                       addonProducts.find((p) => p.id === item.product.id) ||
                       decorations.find((d) => d.id === item.product.id);
        
        if (product) {
          const itemMRP = product.mrp * item.quantity;
          const itemCost = product.invoicePrice * item.quantity;
          
          // Check if it's a decoration
          if (decorations.find((d) => d.id === item.product.id)) {
            decorationMRPTotal += itemMRP;
            decorationCostTotal += itemCost;
          } else {
            // Regular product or add-on
            productMRPTotal += itemMRP;
            productCostTotal += itemCost;
          }
        }
      });

      const totalCost = productCostTotal + decorationCostTotal;

      const items = cart.map((item) => {
        const product = products.find((p) => p.id === item.product.id) || 
                       addonProducts.find((p) => p.id === item.product.id) ||
                       decorations.find((d) => d.id === item.product.id);
        if (!product) {
          throw new Error(`Product not found: ${item.product.name}`);
        }
        return {
          productId: item.product.id, // Keep as string to handle both numeric IDs and decoration names/SKUs
          // omit batchId to let backend allocate across earliest-expiring batches (FEFO)
          quantity: item.quantity,
          unitPrice: item.product.mrp,
          totalPrice: item.product.mrp * item.quantity,
          name: item.product.name,
        } as any;
      });

      console.log("Sale request body:", JSON.stringify({ 
        saleDate: selectedDate, 
        items, 
        paymentType: paymentMethod, 
        totalAmount: getTotalAmount(),
        productMRPTotal,
        decorationMRPTotal,
        productCostTotal,
        decorationCostTotal,
        totalCost
      }, null, 2));

      // Combine selected date with current time to record precise sale time
      const now = new Date();
      const hhmmss = now.toTimeString().slice(0, 8);
      const saleDateTime = `${selectedDate}T${hhmmss}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sales`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        body: JSON.stringify({
          saleDate: saleDateTime,
          items,
          paymentType: paymentMethod,
          totalAmount: getTotalAmount(),
          productMRPTotal,
          decorationMRPTotal,
          productCostTotal,
          decorationCostTotal,
          totalCost,
        }),
      });

      const data = await response.json();
      console.log("Sale response:", JSON.stringify(data, null, 2));
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to record sale");
      }

        setSaleCompleted(true);
        setTimeout(() => {
          setCart([]);
          setPaymentMethod("");
          setDiscount(0);
          setSaleCompleted(false);
          setShowAddons(false);
          setMobileView('products'); // Redirect to products view
          // Refresh both products and decorations to show updated stock
          fetchProducts();
          fetchDecorations();
          setRefreshSales(() => () => {}); // Trigger SalesTimelinePage refresh
        }, 300);
    } catch (err: any) {
      console.error("Error recording sale:", err.message, err.stack);
      setError(err.message || "An error occurred while recording the sale");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const paymentMethods = [
    { id: "cash", name: "Cash", icon: "💵" },
    { id: "hdfc", name: "HDFC", icon: "🏦" },
    { id: "gpay", name: "GPay", icon: "📱" },
    { id: "swiggy", name: "Swiggy", icon: "🛵" },
    { id: "zomato", name: "Zomato", icon: "🍽️" },
  ];

  // Mobile Products View
  const renderMobileProductsView = () => (
    <>
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Products</h1>
        <Button
          onClick={() => setMobileView('cart')}
          className="bg-green-600 hover:bg-green-700 text-white relative"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart ({cart.length})
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
        <CardContent className="p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 text-base border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />
            {searchQuery && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="h-6 w-6 p-0 hover:bg-slate-100 rounded-full"
                >
                  <X className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
        <CardContent className="p-4">
          {filteredProducts.length === 0 && filteredAddonProducts.length === 0 && filteredDecorations.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-1">
                {searchQuery ? 'No items found' : 'No items available'}
              </h3>
              <p className="text-slate-500">
                {searchQuery 
                  ? `No products match "${searchQuery}"` 
                  : 'No products are currently available'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Regular Products */}
              {Object.entries(
                filteredProducts.reduce((acc: Record<string, typeof filteredProducts>, p) => {
                  const key = (p.category || 'uncategorized').toString();
                  if (!acc[key]) acc[key] = [] as any;
                  (acc[key] as any).push(p);
                  return acc;
                }, {})
              ).map(([cat, items]) => (
                <div key={cat} id={`category-${cat}`}>
                  <div className="mb-3 font-semibold capitalize text-slate-800">{cat.replaceAll('_', ' ')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {items.map((product) => {
                      const IconComponent = iconMap[product.icon as keyof typeof iconMap] || iconMap.default;
                      return (
                        <Card key={product.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200 bg-white rounded-lg overflow-hidden">
                          <CardContent className="p-0">
                            <div className="relative">
                              <div className="w-full h-24 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="h-16 w-16 object-cover rounded-lg shadow-sm" />
                                ) : (
                                  <div className="h-16 w-16 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-200">
                                    <IconComponent />
                                  </div>
                                )}
                              </div>
                              <div className="absolute top-1 right-1">
                                <Badge 
                                  variant="outline" 
                                  className={`px-1 py-0 text-xs font-medium ${
                                    product.stock === 0 
                                      ? 'bg-red-50 text-red-700 border-red-200' 
                                      : product.stock <= 5 
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : 'bg-green-50 text-green-700 border-green-200'
                                  }`}
                                >
                                  {product.stock}
                                </Badge>
                              </div>
                            </div>
                            <div className="p-3">
                              <h3 className="font-semibold text-xs mb-1 text-slate-800 line-clamp-2">{product.name}</h3>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-slate-900">₹{product.mrp.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFromCart(product.id)}
                                  disabled={!cart.find((item) => item.product.id === product.id)}
                                  className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-300 rounded-md"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-bold bg-white rounded-md px-1 py-1">
                                  {cart.find((item) => item.product.id === product.id)?.quantity || 0}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addToCart(product)}
                                  disabled={
                                    product.stock === 0 ||
                                    (cart.find((item) => item.product.id === product.id)?.quantity || 0) >= product.stock
                                  }
                                  className="h-6 w-6 p-0 hover:bg-green-50 hover:border-green-300 rounded-md"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Add-ons */}
              {filteredAddonProducts.length > 0 && (
                <div id="addons">
                  <div className="mb-3 font-semibold text-slate-800">Add-ons</div>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredAddonProducts.map((product) => {
                      const IconComponent = iconMap[product.icon as keyof typeof iconMap] || iconMap.default;
                      return (
                        <Card key={product.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200 bg-white rounded-lg overflow-hidden">
                          <CardContent className="p-0">
                            <div className="relative">
                              <div className="w-full h-24 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="h-16 w-16 object-cover rounded-lg shadow-sm" />
                                ) : (
                                  <div className="h-16 w-16 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-200">
                                    <IconComponent />
                                  </div>
                                )}
                              </div>
                              <div className="absolute top-1 right-1">
                                <Badge 
                                  variant="outline" 
                                  className={`px-1 py-0 text-xs font-medium ${
                                    product.stock === 0 
                                      ? 'bg-red-50 text-red-700 border-red-200' 
                                      : product.stock <= 5 
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : 'bg-green-50 text-green-700 border-green-200'
                                  }`}
                                >
                                  {product.stock}
                                </Badge>
                              </div>
                            </div>
                            <div className="p-3">
                              <h3 className="font-semibold text-xs mb-1 text-slate-800 line-clamp-2">{product.name}</h3>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-slate-900">₹{product.mrp.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFromCart(product.id)}
                                  disabled={!cart.find((item) => item.product.id === product.id)}
                                  className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-300 rounded-md"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-bold bg-white rounded-md px-1 py-1">
                                  {cart.find((item) => item.product.id === product.id)?.quantity || 0}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addToCart(product)}
                                  disabled={
                                    product.stock === 0 ||
                                    (cart.find((item) => item.product.id === product.id)?.quantity || 0) >= product.stock
                                  }
                                  className="h-6 w-6 p-0 hover:bg-green-50 hover:border-green-300 rounded-md"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Decorations */}
              {filteredDecorations.length > 0 && (
                <div id="decorations">
                  <div className="mb-3 font-semibold text-slate-800">Decorations</div>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredDecorations.map((product) => {
                      const IconComponent = iconMap[product.icon as keyof typeof iconMap] || iconMap.default;
                      return (
                        <Card key={product.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200 bg-white rounded-lg overflow-hidden">
                          <CardContent className="p-0">
                            <div className="relative">
                              <div className="w-full h-24 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="h-16 w-16 object-cover rounded-lg shadow-sm" />
                                ) : (
                                  <div className="h-16 w-16 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-200">
                                    <IconComponent />
                                  </div>
                                )}
                              </div>
                              <div className="absolute top-1 right-1">
                                <Badge 
                                  variant="outline" 
                                  className={`px-1 py-0 text-xs font-medium ${
                                    product.stock === 0 
                                      ? 'bg-red-50 text-red-700 border-red-200' 
                                      : product.stock <= 5 
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : 'bg-green-50 text-green-700 border-green-200'
                                  }`}
                                >
                                  {product.stock}
                                </Badge>
                              </div>
                            </div>
                            <div className="p-3">
                              <h3 className="font-semibold text-xs mb-1 text-slate-800 line-clamp-2">{product.name}</h3>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-slate-900">₹{product.mrp.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFromCart(product.id)}
                                  disabled={!cart.find((item) => item.product.id === product.id)}
                                  className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-300 rounded-md"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-bold bg-white rounded-md px-1 py-1">
                                  {cart.find((item) => item.product.id === product.id)?.quantity || 0}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addToCart(product)}
                                  disabled={
                                    product.stock === 0 ||
                                    (cart.find((item) => item.product.id === product.id)?.quantity || 0) >= product.stock
                                  }
                                  className="h-6 w-6 p-0 hover:bg-green-50 hover:border-green-300 rounded-md"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  // Mobile Cart View
  const renderMobileCartView = () => (
    <>
      {/* Mobile Cart Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          onClick={() => setMobileView('products')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Button>
        <h1 className="text-xl font-bold text-slate-900">Cart</h1>
        <div className="w-8"></div> {/* Spacer for centering */}
      </div>

      {/* Cart Summary */}
      <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
        <CardContent className="p-4">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Your cart is empty</p>
              <Button
                onClick={() => setMobileView('products')}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white"
              >
                Browse Products
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cart Items */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="flex-1 truncate font-medium text-slate-900 text-sm">{item.product.name}</span>
                      <span className="text-slate-600 text-sm">₹{item.product.mrp.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFromCart(item.product.id)}
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300 rounded-md"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-bold bg-slate-50 rounded-md px-2 py-1">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addToCart(item.product)}
                          disabled={item.quantity >= item.product.stock}
                          className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-300 rounded-md"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="font-semibold text-slate-900">₹{(item.product.mrp * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex justify-between text-slate-700">
                  <span>Subtotal:</span>
                  <span>₹{getSubtotal().toFixed(2)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-₹{getDiscountAmount().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-slate-900">
                  <span>Total:</span>
                  <span>₹{getTotalAmount().toFixed(2)}</span>
                </div>
              </div>

              {/* Discount */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <Label className="text-sm font-medium flex items-center gap-2 text-slate-700">
                  <Percent className="h-4 w-4" />
                  Discount (Optional)
                </Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={discountType === "percentage" ? "default" : "outline"}
                    onClick={() => setDiscountType("percentage")}
                  >
                    %
                  </Button>
                  <Button
                    size="sm"
                    variant={discountType === "amount" ? "default" : "outline"}
                    onClick={() => setDiscountType("amount")}
                  >
                    ₹
                  </Button>
                  <Input
                    type="number"
                    placeholder="0"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    className="flex-1"
                    min="0"
                    max={discountType === "percentage" ? 100 : getSubtotal()}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700">Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => (
                    <Button
                      key={method.id}
                      variant={paymentMethod === method.id ? "default" : "outline"}
                      onClick={() => setPaymentMethod(method.id)}
                      className="flex items-center gap-2 h-10"
                    >
                      <span className="text-sm">{method.icon}</span>
                      <span className="text-xs">{method.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-all duration-200"
                onClick={handleCheckout}
                disabled={cart.length === 0 || !paymentMethod || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Checkout ₹{getTotalAmount().toFixed(2)}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  if (saleCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-to-br from-green-50 to-white border-green-200 shadow-xl">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">Sale Recorded Successfully!</h2>
            <p className="text-green-600 mb-6">The sale has been recorded and stock has been updated.</p>
            <Button 
              onClick={onBack}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-32 lg:pb-8">
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Mobile Layout - Separate Views (Mobile + iPad) */}
        <div className="lg:hidden">
          {mobileView === 'products' ? (
            <div className="space-y-6">
              {/* Mobile Products View */}
              {renderMobileProductsView()}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Mobile Cart View */}
              {renderMobileCartView()}
            </div>
          )}
        </div>

        {/* Persistent Bottom Cart Bar - Mobile & iPad Only */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {cart.length === 0 ? 'Cart is empty' : `${cart.reduce((sum, item) => sum + item.quantity, 0)} item${cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? '' : 's'} added`}
                  </div>
                  {cart.length > 0 && (
                    <div className="text-xs text-slate-600">
                      Total: ₹{getTotalAmount().toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setMobileView('cart')}
                disabled={cart.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {cart.length === 0 ? 'View Cart' : 'View Cart >'}
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop Layout - Side by Side */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Search Bar */}
            <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
              <CardContent className="p-6">
                <div className="relative max-w-2xl mx-auto">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-500" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search all products, add-ons, and decorations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-4 py-3 text-base border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  {searchQuery && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                        className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full"
                      >
                        <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                      </Button>
                    </div>
                  )}
                </div>
                {searchQuery && (
                  <div className="mt-3 text-center">
                    <span className="text-sm text-slate-600 font-medium">
                      {filteredProducts.length + filteredAddonProducts.length + filteredDecorations.length} items found
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-slate-900">Products</CardTitle>
                  <Badge variant="outline" className="bg-white border-slate-300 text-slate-700">
                    Grouped by category
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {filteredProducts.length === 0 && filteredAddonProducts.length === 0 && filteredDecorations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <Search className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-1">
                        {searchQuery ? 'No items found' : 'No items available'}
                      </h3>
                      <p className="text-gray-500">
                        {searchQuery 
                          ? `No products, add-ons, or decorations match "${searchQuery}"` 
                          : 'No products, add-ons, or decorations are currently available'
                        }
                      </p>
                    </div>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchQuery("")}
                        className="mt-2"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {Object.entries(
                      filteredProducts.reduce((acc: Record<string, typeof filteredProducts>, p) => {
                        const key = (p.category || 'uncategorized').toString();
                        if (!acc[key]) acc[key] = [] as any;
                        (acc[key] as any).push(p);
                        return acc;
                      }, {})
                    ).map(([cat, items]) => (
                      <div key={cat} id={`category-${cat}`}>
                        <div className="mb-2 font-semibold capitalize">{cat.replaceAll('_', ' ')}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {items.map((product) => {
                      const IconComponent = iconMap[product.icon as keyof typeof iconMap] || iconMap.default;
                      
                      
                      return (
                        <Card key={product.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200 bg-white rounded-lg overflow-hidden">
                          <CardContent className="p-0">
                            <div className="relative">
                              <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                              {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="h-20 w-20 object-cover rounded-lg shadow-sm" />
                              ) : (
                                  <div className="h-20 w-20 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-200">
                                    <IconComponent />
                                  </div>
                              )}
                            </div>
                              <div className="absolute top-2 right-2">
                                <Badge 
                                  variant="outline" 
                                  className={`px-2 py-1 text-xs font-medium ${
                                    product.stock === 0 
                                      ? 'bg-red-50 text-red-700 border-red-200' 
                                      : product.stock <= 5 
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : 'bg-green-50 text-green-700 border-green-200'
                                  }`}
                                >
                                  {product.stock}
                                </Badge>
                              </div>
                            </div>
                            <div className="p-4">
                              <h3 className="font-semibold text-sm mb-2 text-slate-800 line-clamp-2 group-hover:text-green-600 transition-colors">{product.name}</h3>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex flex-col">
                                  <span className="text-2xl font-bold text-slate-900">₹{product.mrp.toFixed(2)}</span>
                                  <span className="text-xs text-slate-500">MRP</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-slate-500 mb-1">Available</div>
                                  <div className="text-sm font-medium text-slate-700">{product.stock} units</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeFromCart(product.id)}
                                disabled={!cart.find((item) => item.product.id === product.id)}
                                  className="h-9 w-9 p-0 hover:bg-red-50 hover:border-red-300 rounded-lg"
                              >
                                  <Minus className="h-4 w-4" />
                              </Button>
                                <span className="w-12 text-center text-lg font-bold bg-white rounded-lg px-3 py-2 shadow-sm">
                                {cart.find((item) => item.product.id === product.id)?.quantity || 0}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addToCart(product)}
                                disabled={
                                  product.stock === 0 ||
                                  (cart.find((item) => item.product.id === product.id)?.quantity || 0) >= product.stock
                                }
                                  className="h-9 w-9 p-0 hover:bg-green-50 hover:border-green-300 rounded-lg"
                              >
                                  <Plus className="h-4 w-4" />
                              </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Decorations & Add-ons
                    </CardTitle>
                    <CardDescription>Candles, party poppers, and other accessories - can be sold individually</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setShowAddons(!showAddons)}>
                    {showAddons ? "Hide" : "Show"} Decorations
                  </Button>
                </div>
              </CardHeader>
              {showAddons && (
                <CardContent>
                  {addonProducts.length === 0 && decorations.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No decorations available</p>
                  ) : (
                    <div className="space-y-6">
                      {/* Regular Add-ons */}
                      {(addonProducts.length > 0 && filteredAddonProducts.length > 0) && (
                        <div id="addons">
                          <h4 className="font-semibold text-sm mb-3 text-muted-foreground">Regular Add-ons</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {filteredAddonProducts.map((product) => {
                              const IconComponent = iconMap[product.icon as keyof typeof iconMap] || iconMap.default;
                              return (
                                <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md bg-white rounded-xl overflow-hidden">
                                  <CardContent className="p-0">
                                    <div className="relative">
                                      <div className="w-full h-24 flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                                      {product.imageUrl ? (
                                          <img src={product.imageUrl} alt={product.name} className="h-14 w-14 object-cover rounded-lg shadow-sm" />
                                      ) : (
                                          <div className="h-14 w-14 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                            <IconComponent />
                                          </div>
                                      )}
                                    </div>
                                      <div className="absolute top-2 right-2">
                                        <Badge 
                                          variant="secondary" 
                                          className={`px-2 py-1 text-xs font-medium ${
                                            product.stock === 0 
                                              ? 'bg-red-100 text-red-800 border-red-200' 
                                              : product.stock <= 5 
                                              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                              : 'bg-green-100 text-green-800 border-green-200'
                                          }`}
                                        >
                                        {product.stock}
                                      </Badge>
                                      </div>
                                    </div>
                                    <div className="p-3">
                                      <h3 className="font-semibold text-xs mb-2 text-gray-800 line-clamp-2 group-hover:text-orange-600 transition-colors">{product.name}</h3>
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex flex-col">
                                          <span className="text-lg font-bold text-gray-900">₹{product.mrp.toFixed(2)}</span>
                                          <span className="text-xs text-gray-500">MRP</span>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xs text-gray-500 mb-1">Available</div>
                                          <div className="text-xs font-medium text-gray-700">{product.stock}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 bg-orange-50 rounded-lg p-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => removeFromCart(product.id)}
                                        disabled={!cart.find((item) => item.product.id === product.id)}
                                          className="h-7 w-7 p-0 hover:bg-red-50 hover:border-red-300 rounded-md"
                                      >
                                          <Minus className="h-3 w-3" />
                                      </Button>
                                        <span className="w-8 text-center text-sm font-bold bg-white rounded-md px-2 py-1">
                                        {cart.find((item) => item.product.id === product.id)?.quantity || 0}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => addToCart(product)}
                                        disabled={
                                          product.stock === 0 ||
                                          (cart.find((item) => item.product.id === product.id)?.quantity || 0) >= product.stock
                                        }
                                          className="h-7 w-7 p-0 hover:bg-green-50 hover:border-green-300 rounded-md"
                                      >
                                          <Plus className="h-3 w-3" />
                                      </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Decorations - Can be sold solo */}
                      {(decorations.length > 0 && filteredDecorations.length > 0) && (
                        <div id="decorations">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-semibold text-sm text-muted-foreground">Decorations</h4>
                            <Badge variant="outline" className="text-xs">
                              Can be sold individually
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {filteredDecorations.map((product) => {
                              const IconComponent = iconMap[product.icon as keyof typeof iconMap] || iconMap.default;
                              const stockStatus = product.stock === 0 ? "Out of Stock" : 
                                                product.stock <= 5 ? "Low Stock" : "In Stock";
                              const stockColor = product.stock === 0 ? "bg-red-100 text-red-800" : 
                                               product.stock <= 5 ? "bg-yellow-100 text-yellow-800" : 
                                               "bg-green-100 text-green-800";
                              return (
                                <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md bg-white rounded-xl overflow-hidden">
                                  <CardContent className="p-0">
                                    <div className="relative">
                                      <div className="w-full h-28 flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100">
                                      {product.imageUrl ? (
                                          <img src={product.imageUrl} alt={product.name} className="h-16 w-16 object-cover rounded-lg shadow-sm" />
                                      ) : (
                                          <div className="h-16 w-16 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                            <IconComponent />
                                          </div>
                                      )}
                                    </div>
                                      <div className="absolute top-2 right-2">
                                        <Badge 
                                          variant="secondary" 
                                          className={`px-2 py-1 text-xs font-medium ${
                                            product.stock === 0 
                                              ? 'bg-red-100 text-red-800 border-red-200' 
                                              : product.stock <= 5 
                                              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                              : 'bg-green-100 text-green-800 border-green-200'
                                          }`}
                                        >
                                          {product.stock}
                                      </Badge>
                                    </div>
                                    </div>
                                    <div className="p-4">
                                      <h3 className="font-semibold text-sm mb-3 text-gray-800 line-clamp-2 group-hover:text-purple-600 transition-colors">{product.name}</h3>
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex flex-col">
                                          <span className="text-xl font-bold text-gray-900">₹{product.mrp.toFixed(2)}</span>
                                          <span className="text-xs text-gray-500">MRP</span>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xs text-gray-500 mb-1">Available</div>
                                          <div className="text-sm font-medium text-gray-700">{product.stock} units</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 bg-purple-50 rounded-xl p-3">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => removeFromCart(product.id)}
                                        disabled={!cart.find((item) => item.product.id === product.id)}
                                          className="h-9 w-9 p-0 hover:bg-red-50 hover:border-red-300 rounded-lg"
                                      >
                                          <Minus className="h-4 w-4" />
                                      </Button>
                                        <span className="w-12 text-center text-lg font-bold bg-white rounded-lg px-3 py-2 shadow-sm">
                                        {cart.find((item) => item.product.id === product.id)?.quantity || 0}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => addToCart(product)}
                                        disabled={
                                          product.stock === 0 ||
                                          (cart.find((item) => item.product.id === product.id)?.quantity || 0) >= product.stock
                                        }
                                          className="h-9 w-9 p-0 hover:bg-green-50 hover:border-green-300 rounded-lg"
                                      >
                                          <Plus className="h-4 w-4" />
                                      </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          <div className="lg:sticky lg:top-4 lg:max-h-screen lg:overflow-y-auto fixed bottom-0 left-0 right-0 top-auto z-50 max-h-[70vh] overflow-y-auto lg:relative lg:sticky lg:top-4 lg:max-h-screen lg:overflow-y-auto lg:z-auto">
            <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-slate-900">Cart Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.product.id} className="bg-white border border-slate-200 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="flex-1 truncate font-medium text-slate-900 text-sm">{item.product.name}</span>
                            <span className="text-slate-600 text-sm">₹{item.product.mrp.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeFromCart(item.product.id)}
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300 rounded-md"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-bold bg-slate-50 rounded-md px-2 py-1">
                                {item.quantity}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addToCart(item.product)}
                                disabled={item.quantity >= item.product.stock}
                                className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-300 rounded-md"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="font-semibold text-slate-900">₹{(item.product.mrp * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-200 pt-4 space-y-3">
                      <div className="flex justify-between text-slate-700">
                        <span>Subtotal:</span>
                        <span>₹{getSubtotal().toFixed(2)}</span>
                      </div>

                      {discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount:</span>
                          <span>-₹{getDiscountAmount().toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg text-slate-900">
                        <span>Total:</span>
                        <span>₹{getTotalAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <Label className="text-sm font-medium flex items-center gap-2 text-slate-700">
                    <Percent className="h-4 w-4" />
                    Discount (Optional)
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={discountType === "percentage" ? "default" : "outline"}
                      onClick={() => setDiscountType("percentage")}
                    >
                      %
                    </Button>
                    <Button
                      size="sm"
                      variant={discountType === "amount" ? "default" : "outline"}
                      onClick={() => setDiscountType("amount")}
                    >
                      ₹
                    </Button>
                    <Input
                      type="number"
                      placeholder="0"
                      value={discount || ""}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      className="flex-1"
                      min="0"
                      max={discountType === "percentage" ? 100 : getSubtotal()}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map((method) => (
                      <Button
                        key={method.id}
                        variant={paymentMethod === method.id ? "default" : "outline"}
                        onClick={() => setPaymentMethod(method.id)}
                        className="flex items-center gap-2 h-12"
                      >
                        <span className="text-lg">{method.icon}</span>
                        <span className="text-sm">{method.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-all duration-200"
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !paymentMethod || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Checkout ₹{getTotalAmount().toFixed(2)}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Floating Category Navigation Button */}
        <div className="fixed bottom-20 lg:bottom-6 right-6 z-50">
          <div className="relative">
            {/* Category Menu */}
            {showCategoryMenu && (
              <div className="absolute bottom-16 right-0 mb-2 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto min-w-48">
                <div className="p-2">
                  <div className="flex items-center justify-between p-2 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-700">Categories</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCategoryMenu(false)}
                      className="h-6 w-6 p-0 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="py-2">
                    {getAvailableCategories().map((category) => (
                      <button
                        key={category.id}
                        onClick={() => scrollToCategory(category.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <span className="text-lg">{category.icon}</span>
                        <span className="text-sm font-medium text-slate-700">{category.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Floating Button */}
            <Button
              onClick={() => setShowCategoryMenu(!showCategoryMenu)}
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              <Menu className="h-6 w-6 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
