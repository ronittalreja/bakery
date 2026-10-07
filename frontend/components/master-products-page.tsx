"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Package, Search, Store } from "lucide-react"
import { useAuth, getAuthToken } from "@/hooks/use-auth"
import { apiClient } from "@/lib/apiClient"

interface MasterProduct {
  id: number
  item_code: string
  name: string
  hsn_code: string
  invoice_price: string
  sale_price: string
  grm_value: string
  is_active: string
  category: string
  shelf_life_days: string
  store_id: number
  store_name: string
}

interface MasterProductsPageProps {
  onBack: () => void
}

export function MasterProductsPage({ onBack }: MasterProductsPageProps) {
  const { user } = useAuth()
  const [products, setProducts] = useState<MasterProduct[]>([])
  const [filteredProducts, setFilteredProducts] = useState<MasterProduct[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.store_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredProducts(filtered)
    } else {
      setFilteredProducts(products)
    }
  }, [searchTerm, products])

  const fetchProducts = async () => {
    setIsLoading(true)
    setError("")

    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await apiClient("/api/products/master") as MasterProduct[]
      setProducts(response)
      setFilteredProducts(response)
    } catch (err) {
      setError("Failed to fetch master products")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading master products...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
            <Button onClick={fetchProducts} className="mt-4">Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Master Products</h1>
        <p className="text-muted-foreground">All products from all stores</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Products List</CardTitle>
              <CardDescription>{filteredProducts.length} products across all stores</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Invoice Price</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.item_code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          {product.store_name}
                        </div>
                      </TableCell>
                      <TableCell>₹{parseFloat(product.invoice_price).toFixed(2)}</TableCell>
                      <TableCell>₹{parseFloat(product.sale_price).toFixed(2)}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            product.is_active === "1"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {product.is_active === "1" ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
