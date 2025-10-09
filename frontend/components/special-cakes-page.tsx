"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Cake, Plus, Check, Percent } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDateTime } from "@/lib/dateUtils"

interface SpecialCakesPageProps {
  onBack: () => void
}

interface SpecialCake {
  id: string
  name: string
  invoicePrice: number
  grmLoss: number
  mrp: number
  discount: number
  discountType: "percentage" | "amount"
  finalAmount: number
  paymentMethod: string
  timestamp: string
}

export function SpecialCakesPage({ onBack }: SpecialCakesPageProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: "",
    invoicePrice: "",
    grmLoss: "",
    mrp: "",
  })
  const [discount, setDiscount] = useState<number>(0)
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [specialCakes, setSpecialCakes] = useState<SpecialCake[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saleCompleted, setSaleCompleted] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const getDiscountAmount = () => {
    const mrp = Number.parseFloat(formData.mrp) || 0
    if (discountType === "percentage") {
      return Math.round((mrp * discount) / 100)
    }
    return Math.min(discount, mrp)
  }

  const getFinalAmount = () => {
    const mrp = Number.parseFloat(formData.mrp) || 0
    return mrp - getDiscountAmount()
  }

  const paymentMethods = [
    { id: "cash", name: "Cash", icon: "💵" },
    { id: "hdfc", name: "HDFC", icon: "🏦" },
    { id: "gpay", name: "GPay", icon: "📱" },
    { id: "swiggy", name: "Swiggy", icon: "🛵" },
    { id: "zomato", name: "Zomato", icon: "🍽️" },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.invoicePrice || !formData.grmLoss || !formData.mrp || !paymentMethod) {
      toast({
        title: "Error",
        description: "Please fill in all fields and select a payment method",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const newSpecialCake: SpecialCake = {
        id: Date.now().toString(),
        name: formData.name,
        invoicePrice: Number.parseFloat(formData.invoicePrice),
        grmLoss: Number.parseFloat(formData.grmLoss),
        mrp: Number.parseFloat(formData.mrp),
        discount: discount,
        discountType: discountType,
        finalAmount: getFinalAmount(),
        paymentMethod: paymentMethod,
        timestamp: formatDateTime(new Date()),
      }

      setSpecialCakes((prev) => [...prev, newSpecialCake])

      // Show success state
      setSaleCompleted(true)

      // Reset form after showing success
      setTimeout(() => {
        setFormData({
          name: "",
          invoicePrice: "",
          grmLoss: "",
          mrp: "",
        })
        setDiscount(0)
        setPaymentMethod("")
        setSaleCompleted(false)
      }, 3000)

      toast({
        title: "Success",
        description: "Special cake order recorded successfully and added to Sales Summary",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record special cake order",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (saleCompleted) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription className="text-lg">
              Special cake order recorded successfully! It has been added to Sales Summary.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-500 flex items-center justify-center">
            <Cake className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Special Cakes</h1>
            <p className="text-muted-foreground">Record special cake orders with payment and discount options</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Special Cake Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Special Cake Order
              </CardTitle>
              <CardDescription>Record a new special cake order with pricing and payment details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cake-name">Cake Name</Label>
                  <Input
                    id="cake-name"
                    placeholder="Enter cake name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice-price">Invoice Price (₹)</Label>
                    <Input
                      id="invoice-price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.invoicePrice}
                      onChange={(e) => handleInputChange("invoicePrice", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grm-loss">GRM Loss (₹)</Label>
                    <Input
                      id="grm-loss"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.grmLoss}
                      onChange={(e) => handleInputChange("grmLoss", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mrp">MRP (₹)</Label>
                  <Input
                    id="mrp"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.mrp}
                    onChange={(e) => handleInputChange("mrp", e.target.value)}
                  />
                </div>

                <div className="space-y-3 border-t pt-4">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Discount (Optional)
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={discountType === "percentage" ? "default" : "outline"}
                      onClick={() => setDiscountType("percentage")}
                    >
                      %
                    </Button>
                    <Button
                      type="button"
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
                      max={discountType === "percentage" ? 100 : Number.parseFloat(formData.mrp) || 0}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map((method) => (
                      <Button
                        key={method.id}
                        type="button"
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

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Recording..." : `Record Special Cake ₹${getFinalAmount()}`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!formData.name || !formData.mrp ? (
                <p className="text-muted-foreground text-center py-4">Fill in cake details to see summary</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Cake:</span>
                      <span className="font-medium">{formData.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>MRP:</span>
                      <span>₹{Number.parseFloat(formData.mrp).toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount:</span>
                        <span>-₹{getDiscountAmount().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Final Amount:</span>
                      <span>₹{getFinalAmount().toFixed(2)}</span>
                    </div>
                  </div>

                  {paymentMethod && (
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <span className="text-sm text-muted-foreground">Payment Method: </span>
                      <span className="font-medium">{paymentMethods.find((m) => m.id === paymentMethod)?.name}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Today's Special Cakes */}
      {specialCakes.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Today's Special Cakes</CardTitle>
            <CardDescription>Special cake orders recorded today (will appear in Sales Summary)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {specialCakes.map((cake) => (
                <div key={cake.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{cake.name}</h3>
                    <span className="text-sm text-muted-foreground">{cake.timestamp}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Invoice Price:</span>
                      <span className="ml-2 font-medium">₹{cake.invoicePrice}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">GRM Loss:</span>
                      <span className="ml-2 font-medium">₹{cake.grmLoss}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">MRP:</span>
                      <span className="ml-2 font-medium">₹{cake.mrp}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Final Amount:</span>
                      <span className="ml-2 font-medium text-primary">₹{cake.finalAmount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payment:</span>
                      <span className="ml-2 font-medium capitalize">{cake.paymentMethod}</span>
                    </div>
                    {cake.discount > 0 && (
                      <div>
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="ml-2 font-medium text-green-600">
                          {cake.discountType === "percentage" ? `${cake.discount}%` : `₹${cake.discount}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center font-semibold">
                  <span>Total Value:</span>
                  <span>₹{specialCakes.reduce((sum, cake) => sum + cake.finalAmount, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
