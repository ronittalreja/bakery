"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, Search, Store, RefreshCw, Plus } from "lucide-react"
import { useAuth, getAuthToken } from "@/hooks/use-auth"
import { apiClient } from "@/lib/apiClient"

interface MasterProduct {
  id: number | null
  item_code: string
  name: string
  hsn_code: string
  invoice_price: string
  sale_price: string
  grm_value: string
  is_active: string
  category: string
  shelf_life_days: string | null
  store_id: number
  store_name: string
  source: 'existing' | 'unmapped'
  invoice_count?: number
  total_quantity?: number
  first_seen?: string
  last_seen?: string
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

  const stats = {
    total: products.length,
    existing: products.filter(p => p.source === 'existing').length,
    unmapped: products.filter(p => p.source === 'unmapped').length
  }

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

  const handleSyncProduct = async (product: MasterProduct) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/products/sync-unmapped`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productName: product.name,
          productCode: product.item_code === 'PENDING' ? null : product.item_code,
          storeId: product.store_id,
          unitPrice: parseFloat(product.invoice_price)
        })
      })

      const data = await response.json()

      if (data.success) {
        // Refresh the product list
        fetchProducts()
      } else {
        alert(data.error || 'Failed to sync product')
      }
    } catch (error) {
      console.error('Error syncing product:', error)
      alert('Failed to sync product')
    }
  }

  const handleSyncAll = async () => {
    if (!confirm(`Sync all ${stats.unmapped} unmapped products to master database?`)) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/products/sync-all-unmapped`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        alert(`Successfully synced ${data.syncedCount} products`)
        fetchProducts()
      } else {
        alert(data.error || 'Failed to sync products')
      }
    } catch (error) {
      console.error('Error syncing all products:', error)
      alert('Failed to sync products')
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
              <CardDescription>
                {stats.total} total ({stats.existing} existing, {stats.unmapped} unmapped)
              </CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {stats.unmapped > 0 && (
                <Button onClick={handleSyncAll} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Sync All ({stats.unmapped})
                </Button>
              )}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={fetchProducts} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Invoice Price</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead>First Seen</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id || product.name}>
                      <TableCell>
                        <Badge
                          variant={product.source === 'existing' ? 'default' : 'secondary'}
                          className={product.source === 'unmapped' ? 'bg-orange-100 text-orange-800' : ''}
                        >
                          {product.source === 'existing' ? 'Master' : 'Unmapped'}
                        </Badge>
                      </TableCell>
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
                      <TableCell>
                        {product.source === 'unmapped' ? (
                          <Badge variant="outline">{product.invoice_count || 0}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.source === 'unmapped' && product.first_seen ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(product.first_seen).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.source === 'unmapped' ? (
                          <Button
                            onClick={() => handleSyncProduct(product)}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Sync
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
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
