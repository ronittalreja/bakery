// File: src/components/edit-sales-page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Plus, Minus, Check, Sparkles, Percent, AlertCircle, Search, Package, Menu, X, ArrowLeft, Clock, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/apiClient";

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
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface EditSalesPageProps {
  onBack: () => void;
}

export function AddSalesPage({ onBack }: EditSalesPageProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [addonProducts, setAddonProducts] = useState<Product[]>([]);
  const [decorations, setDecorations] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
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
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');

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
    const [time, ampm] = time12.split(' ');
    if (!ampm) return time12; // Already in 24hr format
    const [hours, minutes] = time.split(':');
    let hour = parseInt(hours);
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minutes}`;
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

  const paymentMethods = [
    { id: "cash", name: "Cash", icon: "Cash" },
    { id: "hdfc", name: "HDFC", icon: "HDFC" },
    { id: "gpay", name: "GPay", icon: "GPay" },
    { id: "swiggy", name: "Swiggy", icon: "Swiggy" },
    { id: "zomato", name: "Zomato", icon: "Zomato" },
  ];

  // Get max date (today)
  const maxDate = new Date().toISOString().split('T')[0];

  const fetchProducts = useCallback(async (date: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        setProducts([]);
        return;
      }

      // Fetch stock for specific date
      const response: any = await apiClient(
        `/api/stock?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch products");
      }
      
      const mappedProducts = response.data.map((p: any) => ({
        id: String(p.id),
        name: p.name || "Unknown Product",
        mrp: Number(p.sale_price || 0),
        invoicePrice: Number(p.invoice_price || 0),
        icon: "default",
        stock: Number(p.quantity || 0),
        batchId: String(p.id),
        imageUrl: p.image_url || "/placeholder.svg",
        category: p.category || undefined,
        shelfLifeDays: p.shelf_life_days || null,
        expiryDate: p.expiry_date || undefined,
      }));
      
      setProducts(mappedProducts);

      // Also fetch expired/returned items for this date to allow selling them
      const expiredResponse: any = await apiClient(
        `/api/returns?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (expiredResponse.success && expiredResponse.data) {
        const expiredProducts = expiredResponse.data.map((p: any) => ({
          id: String(p.product_id),
          name: p.name || "Unknown Product",
          mrp: Number(p.invoice_price || 0),
          invoicePrice: Number(p.invoice_price || 0),
          icon: "default",
          stock: Number(p.quantity || 0),
          batchId: String(p.batch_id || p.id),
          imageUrl: p.image_url || "/placeholder.svg",
          category: p.category || undefined,
          shelfLifeDays: p.shelf_life_days || null,
          expiryDate: p.expiry_date || undefined,
        }));
        
        // Combine available stock with expired items, but remove duplicates
        const combinedProducts = [...mappedProducts];
        
        // Add expired items only if not already in combined products
        expiredProducts.forEach((expiredProduct: Product) => {
          const exists = combinedProducts.find(p => p.id === expiredProduct.id);
          if (!exists) {
            combinedProducts.push(expiredProduct);
          }
        });
        
        setProducts(combinedProducts);
      }
    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError(err.message || "Failed to fetch products");
      setProducts([]);
    }
  }, []);

  const fetchDecorations = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) {
        setDecorations([]);
        return;
      }

      const response: any = await apiClient(
        "/api/decorations",
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
      }));
      
      setDecorations(mappedDecorations.filter((d: Product) => d.stock > 0));
    } catch (err: any) {
      console.error("Error fetching decorations:", err);
      setDecorations([]);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchProducts(selectedDate);
    }
    fetchDecorations();
  }, [selectedDate, fetchProducts, fetchDecorations]);

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prevCart => 
      prevCart.map(item =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(quantity, item.product.stock) }
          : item
      )
    );
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.mrp * item.quantity), 0);
  };

  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    if (discountType === "percentage") {
      return subtotal * (discount / 100);
    }
    return discount;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscountAmount();
  };

  const handleSale = async () => {
    if (cart.length === 0) {
      setError("Please add items to cart");
      return;
    }

    if (!paymentMethod) {
      setError("Please select a payment method");
      return;
    }

    if (!selectedDate || !selectedTime) {
      setError("Please select date and time");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      
      // Combine date and time for saleDateTime
      const saleDateTime = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.mrp,
        totalPrice: item.product.mrp * item.quantity,
        name: item.product.name,
        batchId: item.product.batchId
      }));

      const response = await apiClient("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          saleDate: saleDateTime,
          items,
          paymentType: paymentMethod,
          totalAmount: calculateTotal(),
          productMRPTotal: calculateSubtotal(),
          decorationMRPTotal: 0,
          productCostTotal: 0,
          decorationCostTotal: 0,
          totalCost: 0,
          isHistorical: true,
        }),
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to record sale");
      }

      setSaleCompleted(true);
      setCart([]);
      setPaymentMethod("");
      setDiscount(0);
      
      // Refresh products to update stock
      fetchProducts(selectedDate);
      
    } catch (err: any) {
      console.error("Error recording sale:", err);
      setError(err.message || "Failed to record sale");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (saleCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
        <div className="max-w-md mx-auto pt-20">
          <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Sale Recorded!</h2>
              <p className="text-slate-600 mb-6">
                Sale for {selectedDate} at {selectedTime} has been successfully recorded.
              </p>
              <Button
                onClick={() => {
                  setSaleCompleted(false);
                }}
                className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
              >
                Record Another Sale
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border-b border-slate-200 shadow-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2 bg-white hover:bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-black transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Add Sales</h1>
                <p className="text-sm text-slate-600">Add historical sales</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Date and Time Selection */}
        <Card className="mb-6 bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Select Date & Time
            </CardTitle>
            <CardDescription>
              Choose date and time for historical sale
            </CardDescription>
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
                  max={maxDate}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sale-time">Time (12-hour)</Label>
                <Input
                  id="sale-time"
                  type="text"
                  value={formatTime12Hour(selectedTime)}
                  onChange={(e) => setSelectedTime(formatTime24Hour(e.target.value))}
                  placeholder="2:30 PM"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products Section */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Products
                    </CardTitle>
                    <CardDescription>
                      Available stock for {selectedDate} (including expired items)
                    </CardDescription>
                  </div>
                  <div className="relative">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find(item => item.product.id === product.id);
                    const IconComponent = iconMap[product.icon as keyof typeof iconMap] || iconMap.default;
                    
                    return (
                      <div
                        key={product.id}
                        className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <IconComponent />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-slate-900 truncate">{product.name}</h3>
                              <p className="text-sm text-slate-600">₹{product.mrp.toFixed(2)}</p>
                              {product.expiryDate && (
                                <p className="text-xs text-amber-600">
                                  Expires: {formatExpiryDate(product.expiryDate)}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant={product.stock > 0 ? "default" : "secondary"}>
                            Stock: {product.stock}
                          </Badge>
                        </div>
                        
                        {cartItem ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                                disabled={cartItem.quantity <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{cartItem.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                                disabled={cartItem.quantity >= product.stock}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="text-sm font-medium text-slate-900">
                              ₹{(product.mrp * cartItem.quantity).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => addToCart(product)}
                            disabled={product.stock <= 0}
                            className="w-full"
                          >
                            <ShoppingCart className="h-3 w-3 mr-2" />
                            Add to Cart
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-lg sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Cart ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No items in cart</p>
                ) : (
                  <div className="space-y-4">
                    {/* Cart Items */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900 truncate">{item.product.name}</p>
                            <p className="text-sm text-slate-600">
                              {item.quantity} × ₹{item.product.mrp.toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 min-w-0 text-right">
                              ₹{(item.product.mrp * item.quantity).toFixed(2)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromCart(item.product.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Discount Section */}
                    <div className="border-t pt-4 space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Discount</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            type="number"
                            value={discount}
                            onChange={(e) => setDiscount(Number(e.target.value))}
                            placeholder="0"
                            min="0"
                            max={discountType === "percentage" ? 100 : calculateSubtotal()}
                          />
                          <Select
                            value={discountType}
                            onValueChange={(value: "percentage" | "amount") => setDiscountType(value)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">%</SelectItem>
                              <SelectItem value="amount">₹</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
                            <span className="text-sm">{method.name}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Total */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>₹{calculateSubtotal().toFixed(2)}</span>
                      </div>
                      {calculateDiscountAmount() > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount:</span>
                          <span>-₹{calculateDiscountAmount().toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>₹{calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Complete Sale Button */}
                    <Button
                      onClick={handleSale}
                      disabled={isProcessing || cart.length === 0 || !paymentMethod}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-all duration-200"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Complete Sale
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
