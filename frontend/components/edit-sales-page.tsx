// File: src/components/AddSalesPage.tsx - Redesigned to match Record Sale
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Plus, Minus, Check, Sparkles, Percent, AlertCircle, Search, Package, Menu, X, ArrowLeft, CalendarIcon } from "lucide-react";
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
  expiryDate?: string;
  isGrmRestored?: boolean;
  originalQuantity?: number;
  soldQuantity?: number;
  grmQuantity?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface AddSalesPageProps {
  onBack: () => void;
}

export function AddSalesPage({ onBack }: AddSalesPageProps) {
  const { user } = useAuth();
  const { setRefreshSales } = useSaleContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [addonProducts, setAddonProducts] = useState<Product[]>([]);
  const [decorations, setDecorations] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>(
    new Date().toTimeString().slice(0, 5)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [showAddons, setShowAddons] = useState(true);
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showCategoryMenu, setShowCategoryMenu] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'products' | 'payment'>('products');

  // Simple manual date selection - bypass complex date context
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  // Convert 24hr time to 12hr format for display
  const formatTime12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Convert 12hr time to 24hr format for storage
  const formatTime24Hour = (time12: string) => {
    if (!time12) return '00:00';
    
    const trimmed = time12.trim().toUpperCase();
    const hasAMPM = trimmed.includes('AM') || trimmed.includes('PM');
    
    if (!hasAMPM) {
      // If no AM/PM, assume it's already 24hr format
      const [hours, minutes] = trimmed.split(':');
      if (hours && minutes) {
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      }
      return '00:00';
    }
    
    const [time, ampm] = trimmed.split(' ');
    const [hours, minutes] = time.split(':');
    let hour = parseInt(hours) || 0;
    
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}`;
  };

  // Format expiry date to DD-MM-YYYY
  const formatExpiryDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchProducts = useCallback(async (date: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        setProducts([]);
        return;
      }

      // Fetch available stock for add sales (excludes already sold items, includes GRM processed)
      const response: any = await apiClient(
        `/api/add-sales/available-stock?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch products");
      }
      
      const productsArray = Array.isArray(response) ? response : response.data || [];
      
      const mappedProducts = productsArray.map((p: any) => ({
        id: String(p.id),
        name: p.name || "Unknown Product",
        mrp: Number(p.sale_price || 0),
        invoicePrice: Number(p.invoice_price || 0),
        icon: p.category || "default",
        stock: Number(p.quantity || 0),
        batchId: String(p.id),
        imageUrl: p.image_url || "/placeholder.svg",
        category: p.category || undefined,
        shelfLifeDays: p.shelf_life_days != null ? Number(p.shelf_life_days) : null,
        expiryDate: p.expiry_date || undefined,
        isGrmRestored: p.is_grm_restored || false,
        originalQuantity: Number(p.original_quantity || 0),
        soldQuantity: Number(p.sold_quantity || 0),
        grmQuantity: Number(p.grm_quantity || 0),
      }));
      
      console.log('📦 Frontend received products:', mappedProducts);
      setProducts(mappedProducts);
    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError(err.message || "Failed to fetch products");
      setProducts([]);
    }
  }, []);

  const fetchDecorations = useCallback(async (date: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        setDecorations([]);
        return;
      }

      const response: any = await apiClient(
        `/api/decorations/add-sales?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch decorations");
      }
      
      const decorationsArray = Array.isArray(response) ? response : response.decorations || response.data || [];
      
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
        soldQuantity: Number(d.sold_quantity || 0),
      }));
      
      setDecorations(mappedDecorations.filter((d: Product) => d.stock > 0));
    } catch (err: any) {
      console.error("Error fetching decorations:", err);
      setError(err.message || "Failed to fetch decorations");
      setDecorations([]);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchProducts(selectedDate);
      fetchDecorations(selectedDate);
    }
  }, [selectedDate, fetchProducts, fetchDecorations]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev => prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.mrp * item.quantity), 0);
  };

  const getDiscountAmount = () => {
    const subtotal = getSubtotal();
    if (discountType === "percentage") {
      return subtotal * (discount / 100);
    } else {
      return discount;
    }
  };

  const getTotalAmount = () => {
    return getSubtotal() - getDiscountAmount();
  };

  // Filter products based on search query and available stock
  const filteredProducts = products.filter(product => {
    const hasStock = product.stock > 0;
    const matchesSearch = searchQuery === '' || product.name.toLowerCase().includes(searchQuery.toLowerCase());
    console.log(`🔍 Filtering product: ${product.name}, stock=${product.stock}, hasStock=${hasStock}, matchesSearch=${matchesSearch}`);
    return hasStock && matchesSearch;
  });
  
  console.log(`📊 Filtered products count: ${filteredProducts.length} (from ${products.length} total)`);

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
    
    // Add decorations category
    if (filteredDecorations.length > 0) {
      categories.push({
        id: 'category-decorations',
        name: 'DECORATIONS',
        type: 'category',
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

  const handleSale = async () => {
    if (!selectedDate || !selectedTime) {
      setError("Please select date and time");
      return;
    }

    if (cart.length === 0) {
      setError("Please add items to cart");
      return;
    }

    if (!paymentMethod) {
      setError("Please select payment method");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      
      // Combine date and time for saleDateTime (avoid timezone conversion)
      const dateObj = new Date(`${selectedDate}T${selectedTime}:00`);
      // Create ISO string in local timezone to avoid date shift
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      const saleDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;

      const items = cart.map(item => ({
        productId: item.product.id,
        batchId: item.product.batchId || null,
        quantity: item.quantity,
        unitPrice: item.product.mrp,
        totalPrice: item.product.mrp * item.quantity,
        name: item.product.name,
        itemType: decorations.find(d => d.id === item.product.id) ? 'decoration' : 'product'
      }));

      // Calculate decoration totals separately
      let decorationMRPTotal = 0;
      let decorationCostTotal = 0;
      let totalCost = 0;
      
      cart.forEach(item => {
        const isDecoration = decorations.find(d => d.id === item.product.id);
        if (isDecoration) {
          decorationMRPTotal += item.product.mrp * item.quantity;
          decorationCostTotal += item.product.invoicePrice * item.quantity;
        }
        totalCost += item.product.invoicePrice * item.quantity;
      });

      const response = await apiClient(
        '/api/add-sales/record',
        {
          method: 'POST',
          body: JSON.stringify({
            saleDate: saleDateTime,
            items,
            paymentType: paymentMethod,
            totalAmount: getTotalAmount(),
            productMRPTotal: getSubtotal() - decorationMRPTotal,
            decorationMRPTotal,
            productCostTotal: totalCost - decorationCostTotal,
            decorationCostTotal,
            totalCost,
          }),
        },
        token
      );

      if (!response.success) {
        throw new Error(response.error || "Failed to record sale");
      }

      setSaleCompleted(true);
      setTimeout(() => {
        setCart([]);
        setPaymentMethod("");
        setDiscount(0);
        setSaleCompleted(false);
        setShowAddons(false);
        setMobileView('products');
        fetchProducts(selectedDate);
        fetchDecorations(selectedDate);
        setRefreshSales(() => () => {});
      }, 2000);
    } catch (err: any) {
      console.error("Error recording sale:", err.message, err.stack);
      setError(err.message || "Failed to record sale");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  if (saleCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
        <div className="max-w-md mx-auto pt-20">
          <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Sale Recorded Successfully!</h3>
              <p className="text-slate-600 mb-4">Your historical sale has been recorded for {selectedDate}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  
  if (mobileView === 'payment') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
        <div className="max-w-4xl mx-auto pt-20">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setMobileView('products')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-900">Payment & Checkout</CardTitle>
                <CardDescription>Complete your historical sale</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date and Time Display */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">Sale Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-600">Date</Label>
                      <p className="font-medium">{selectedDate}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-slate-600">Time</Label>
                      <p className="font-medium">{formatTime12Hour(selectedTime)}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <Label className="text-base font-medium text-slate-900">Payment Method</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {['Cash', 'Card', 'UPI', 'Other'].map((method) => (
                      <Button
                        key={method}
                        variant={paymentMethod === method ? "default" : "outline"}
                        onClick={() => setPaymentMethod(method)}
                        className={paymentMethod === method ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {method}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Discount */}
                <div>
                  <Label className="text-base font-medium text-slate-900">Discount (Optional)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="number"
                      placeholder="0"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      min="0"
                      max={discountType === "percentage" ? 100 : getSubtotal()}
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as "percentage" | "amount")}
                      className="px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="percentage">%</option>
                      <option value="amount">₹</option>
                    </select>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-3">Order Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-700">
                      <span>Items ({cart.length}):</span>
                      <span>₹{getSubtotal().toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-₹{getDiscountAmount().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-300 pt-2">
                      <div className="flex justify-between font-bold text-lg text-slate-900">
                        <span>Total:</span>
                        <span>₹{getTotalAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSale}
                  disabled={isProcessing || !paymentMethod}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {isProcessing ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Record Sale ₹{getTotalAmount().toFixed(2)}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Add Historical Sale</h1>
                <p className="text-sm text-slate-600">Record sales for {selectedDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{selectedDate}</p>
                <p className="text-xs text-slate-600">{formatTime12Hour(selectedTime)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date and Time Selection */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Select Date & Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sale-date">Date</Label>
                <Input
                  id="sale-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sale-time">Time</Label>
                <Input
                  id="sale-time"
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Products Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900">Products</CardTitle>
              <Badge variant="outline" className="bg-white border-slate-300 text-slate-700">
                Grouped by category
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              {/* Product Categories */}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map((product) => {
                      const IconComponent = iconMap[product.icon as keyof typeof iconMap] || iconMap.default;
                      const cartItem = cart.find(item => item.product.id === product.id);
                      
                      return (
                        <Card key={product.id} className="group hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                                <IconComponent />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm mb-1 text-slate-800 line-clamp-2 group-hover:text-green-600 transition-colors">{product.name}</h3>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex flex-col">
                                    <span className="text-lg font-bold text-slate-900">₹{product.mrp.toFixed(2)}</span>
                                    <span className="text-xs text-slate-500">MRP</span>
                                    {product.expiryDate && (
                                      <span className="text-xs text-orange-600">Expiry: {formatExpiryDate(product.expiryDate)}</span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <Badge variant={product.stock > 0 ? "default" : "secondary"}>
                                      Stock: {product.stock}
                                    </Badge>
                                    {product.isGrmRestored && (
                                      <span className="ml-1 text-xs text-green-600">GRM</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addToCart(product)}
                                disabled={product.stock === 0}
                                className="flex-1"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                              {cartItem ? (
                                <div className="ml-2 flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-6 text-center font-medium text-sm">{cartItem.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                                    className="h-6 w-6 p-0"
                                    disabled={cartItem.quantity >= product.stock}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="ml-2 flex items-center gap-1">
                                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                                    0
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {/* Decorations Category */}
              {filteredDecorations.length > 0 && (
                <div id="category-decorations">
                  <div className="mb-2 font-semibold">Decorations</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredDecorations.map((decoration) => {
                      const cartItem = cart.find(item => item.product.id === decoration.id);
                      
                      return (
                        <Card key={decoration.id} className="group hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <span>🎨</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm mb-1 text-purple-800 line-clamp-2 group-hover:text-purple-600 transition-colors">{decoration.name}</h3>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex flex-col">
                                    <span className="text-lg font-bold text-purple-900">₹{decoration.mrp.toFixed(2)}</span>
                                    <span className="text-xs text-purple-500">MRP</span>
                                  </div>
                                  <Badge variant="outline" className="border-purple-300 text-purple-700">
                                    Stock: {decoration.stock}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addToCart(decoration)}
                                disabled={decoration.stock === 0}
                                className="flex-1"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                              {cartItem && (
                                <div className="ml-2 flex items-center gap-1">
                                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">
                                    {cartItem.quantity}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Category Navigation Button */}
      <div className="fixed bottom-20 lg:bottom-6 right-6 z-50">
        <div className="relative">
          {/* Category Menu */}
          {showCategoryMenu && (
            <div className="absolute bottom-16 right-0 mb-2 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto min-w-48">
              <div className="p-2">
                <div className="flex items-center justify-between p-2 border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-700">Categories</span>
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
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </div>
                {cart.length > 0 && (
                  <div className="text-xs text-slate-600">
                    Total: ₹{getTotalAmount().toFixed(2)}
                  </div>
                )}
              </div>
            </div>
            <Button
              onClick={() => setMobileView('payment')}
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
        </div>
      </div>
    </div>
  );
}

// Helper function for API calls
const apiClient = async (url: string, options: any = {}, token?: string) => {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}${url}`, defaultOptions);
  return response.json();
};
