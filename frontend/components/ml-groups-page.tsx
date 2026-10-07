"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Search, Check, X, Layers, FileText, Package } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

interface Product {
  id: number;
  product_id: string;
  name: string;
  category: string;
  price: number;
  item_type: string;
  ml_group_id: string | null;
  active: boolean;
  mapping_status: 'pending' | 'approved' | 'notforuse';
  alias_count: number;
}

interface UnmappedItem {
  item_name: string;
  total_qty: number;
  invoice_count: number;
  first_seen: string;
  last_seen: string;
}

interface Alias {
  id: number;
  product_id: string;
  historical_item_code: string;
  historical_name: string;
  effective_from: string | null;
  effective_to: string | null;
}

interface MLGroupsPageProps {
  onBack: () => void;
}

type TabType = "all" | "mapped" | "unmapped" | "notforuse";

export function MLGroupsPage({ onBack }: MLGroupsPageProps) {
  const [tab, setTab] = usePersistedState<TabType>('ml_groups_tab', "all");
  const [products, setProducts] = useState<Product[]>([]);
  const [unmappedItems, setUnmappedItems] = useState<UnmappedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedTargetProduct, setSelectedTargetProduct] = useState<Product | null>(null);
  const [selectedSourceProducts, setSelectedSourceProducts] = useState<Set<string>>(new Set());
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [aliasProduct, setAliasProduct] = useState<Product | null>(null);
  const [aliasList, setAliasList] = useState<Alias[]>([]);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Fetch products
      const statusFilter = tab === "mapped" ? "approved" : tab === "unmapped" ? "pending" : tab === "notforuse" ? "notforuse" : undefined;
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products?${statusParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }

      // Fetch unmapped items if on unmapped tab
      if (tab === "unmapped") {
        const valResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/validation-report`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const valData = await valResponse.json();
        if (valData.success) {
          setUnmappedItems(valData.data.unmapped_items);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (productId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId })
      });
      const data = await response.json();
      if (data.success) {
        // Update local state without full refresh
        setProducts(products.map(p =>
          p.product_id === productId ? { ...p, mapping_status: 'approved' } : p
        ));
      }
    } catch (error) {
      console.error('Error approving product:', error);
    }
  };

  const handleNotForUse = async (productId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/notforuse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId })
      });
      const data = await response.json();
      if (data.success) {
        setProducts(products.map(p =>
          p.product_id === productId ? { ...p, mapping_status: 'notforuse' } : p
        ));
      }
    } catch (error) {
      console.error('Error marking product as not for use:', error);
    }
  };

  const handleSearchProducts = async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        const filtered = data.data.filter((p: Product) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.product_id.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);

        // Auto-select the current product if it's in the results
        if (selectedProduct) {
          const currentProductInResults = filtered.find((p: Product) => p.product_id === selectedProduct.product_id);
          if (currentProductInResults) {
            setSelectedTargetProduct(currentProductInResults);
            setSelectedSourceProducts(new Set([selectedProduct.product_id]));
          }
        }
      }
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const handleFetchAliases = async (product: Product) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/${product.product_id}/aliases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAliasList(data.data);
        setAliasProduct(product);
        setShowAliasModal(true);
      }
    } catch (error) {
      console.error('Error fetching aliases:', error);
    }
  };

  const handleAddUnmappedItem = async (itemName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/unmapped`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemName, mappingStatus: 'pending' })
      });
      const data = await response.json();
      if (data.success) {
        // Remove from unmapped items list
        setUnmappedItems(unmappedItems.filter(item => item.item_name !== itemName));
        // Refresh products to show the new item
        fetchData();
      } else {
        alert(data.error || 'Failed to add product');
      }
    } catch (error) {
      console.error('Error adding unmapped item:', error);
      alert('Failed to add product');
    }
  };

  const handleAddAllUnmappedItems = async () => {
    if (!confirm(`Add all ${unmappedItems.length} unmapped items to product master?`)) return;

    try {
      const token = localStorage.getItem('token');
      const promises = unmappedItems.map(item =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/unmapped`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ itemName: item.item_name, mappingStatus: 'pending' })
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.ok);

      if (allSuccess) {
        setUnmappedItems([]);
        fetchData();
      } else {
        alert('Some items failed to add');
      }
    } catch (error) {
      console.error('Error adding all unmapped items:', error);
      alert('Failed to add all items');
    }
  };

  const handleMarkUnmappedAsNotForUse = async (itemName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/unmapped`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemName, mappingStatus: 'notforuse' })
      });
      const data = await response.json();
      if (data.success) {
        // Remove from unmapped items list
        setUnmappedItems(unmappedItems.filter(item => item.item_name !== itemName));
        // Refresh products to show the new item
        fetchData();
      } else {
        alert(data.error || 'Failed to mark as not for use');
      }
    } catch (error) {
      console.error('Error marking unmapped item as not for use:', error);
      alert('Failed to mark as not for use');
    }
  };

  const handleAddAliasAndApprove = async () => {
    if (!selectedProduct || !selectedTargetProduct || selectedSourceProducts.size === 0) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/alias-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetProductId: selectedTargetProduct.product_id,
          sourceProductIds: Array.from(selectedSourceProducts)
        })
      });
      const data = await response.json();
      if (data.success) {
        // Update all affected products in local state
        const affectedIds = new Set([selectedTargetProduct.product_id, ...selectedSourceProducts]);
        setProducts(products.map(p =>
          affectedIds.has(p.product_id) ? { ...p, mapping_status: 'approved' } : p
        ));
        setShowSearchModal(false);
        setSelectedTargetProduct(null);
        setSelectedSourceProducts(new Set());
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error adding alias and approving:', error);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.product_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: products.length,
    approved: products.filter(p => p.mapping_status === 'approved').length,
    notforuse: products.filter(p => p.mapping_status === 'notforuse').length,
    pending: products.filter(p => p.mapping_status === 'pending').length
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Product Mapping</h1>
                <p className="text-sm text-slate-600">Manage product approvals and aliases</p>
              </div>
            </div>
            <Button onClick={() => fetchData()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={tab === "all" ? "default" : "outline"}
              onClick={() => setTab("all")}
              className="flex items-center gap-2"
            >
              <Package className="h-4 w-4" />
              All Products ({stats.total})
            </Button>
            <Button
              variant={tab === "mapped" ? "default" : "outline"}
              onClick={() => setTab("mapped")}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Mapped ({stats.approved})
            </Button>
            <Button
              variant={tab === "unmapped" ? "default" : "outline"}
              onClick={() => setTab("unmapped")}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Unmapped ({stats.pending})
            </Button>
            <Button
              variant={tab === "notforuse" ? "default" : "outline"}
              onClick={() => setTab("notforuse")}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Not For Use ({stats.notforuse})
            </Button>
          </div>

          {/* Stats */}
          {tab === "all" && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Total Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Approved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Not For Use</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.notforuse}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                {tab === "all" && "All Products"}
                {tab === "mapped" && "Mapped Products"}
                {tab === "unmapped" && "Unmapped Products"}
                {tab === "notforuse" && "Not For Use Products"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Item Type</TableHead>
                    <TableHead>ML Group ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aliases</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs">{product.product_id}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.item_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.ml_group_id || '-'}</TableCell>
                      <TableCell>
                        {product.mapping_status === 'approved' && (
                          <Badge className="bg-green-500">Approved</Badge>
                        )}
                        {product.mapping_status === 'notforuse' && (
                          <Badge className="bg-red-500">Not For Use</Badge>
                        )}
                        {product.mapping_status === 'pending' && (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={product.alias_count > 0 ? "default" : "secondary"}
                          className={product.alias_count > 0 ? "cursor-pointer hover:bg-blue-600" : ""}
                          onClick={() => product.alias_count > 0 && handleFetchAliases(product)}
                        >
                          {product.alias_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(product.product_id)}
                            disabled={product.mapping_status === 'approved'}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleNotForUse(product.product_id)}
                            disabled={product.mapping_status === 'notforuse'}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowSearchModal(true);
                            }}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Unmapped Items Table */}
          {tab === "unmapped" && unmappedItems.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Unmapped Invoice Items</CardTitle>
                    <CardDescription>
                      Items from invoices that are not in product master. Add to product master or mark as not for use.
                    </CardDescription>
                  </div>
                  <Button onClick={handleAddAllUnmappedItems}>
                    Add All ({unmappedItems.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Total Qty</TableHead>
                      <TableHead>Invoice Count</TableHead>
                      <TableHead>First Seen</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmappedItems.slice(0, 50).map((item) => (
                      <TableRow key={item.item_name}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.total_qty}</TableCell>
                        <TableCell>{item.invoice_count}</TableCell>
                        <TableCell>{new Date(item.first_seen).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(item.last_seen).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddUnmappedItem(item.item_name)}
                              title="Add to product master"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkUnmappedAsNotForUse(item.item_name)}
                              title="Mark as not for use"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Alias Details Modal */}
      {showAliasModal && aliasProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
            <CardHeader>
              <CardTitle>Aliases for {aliasProduct.name}</CardTitle>
              <CardDescription>
                Historical item codes and names mapped to this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aliasList.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No aliases found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Historical Code</TableHead>
                      <TableHead>Historical Name</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Effective To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aliasList.map((alias) => (
                      <TableRow key={alias.id}>
                        <TableCell className="font-mono text-xs">{alias.historical_item_code}</TableCell>
                        <TableCell>{alias.historical_name}</TableCell>
                        <TableCell>{alias.effective_from || '-'}</TableCell>
                        <TableCell>{alias.effective_to || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAliasModal(false);
                    setAliasProduct(null);
                    setAliasList([]);
                  }}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
            <CardHeader>
              <CardTitle>Search and Link Products</CardTitle>
              <CardDescription>
                Select products to link "{selectedProduct.name}" to (multi-select enabled)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search products to link..."
                    onChange={(e) => handleSearchProducts(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-auto">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSelectedTargetProduct(product);
                        const newSet = new Set(selectedSourceProducts);
                        if (newSet.has(product.product_id)) {
                          newSet.delete(product.product_id);
                        } else {
                          newSet.add(product.product_id);
                        }
                        setSelectedSourceProducts(newSet);
                      }}
                      className={`p-3 border rounded cursor-pointer hover:bg-slate-50 flex items-center gap-3 ${
                        selectedSourceProducts.has(product.product_id) ? 'bg-blue-50 border-blue-500' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSourceProducts.has(product.product_id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newSet = new Set(selectedSourceProducts);
                          if (e.target.checked) {
                            newSet.add(product.product_id);
                          } else {
                            newSet.delete(product.product_id);
                          }
                          setSelectedSourceProducts(newSet);
                          if (e.target.checked) {
                            setSelectedTargetProduct(product);
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-slate-600">{product.product_id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedSourceProducts.size > 0 && (
                <div className="mt-2 text-sm text-slate-600">
                  {selectedSourceProducts.size} product(s) selected
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleAddAliasAndApprove}
                  disabled={!selectedTargetProduct || selectedSourceProducts.size === 0}
                  className="flex-1"
                >
                  Link and Approve ({selectedSourceProducts.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSearchModal(false);
                    setSelectedTargetProduct(null);
                    setSelectedSourceProducts(new Set());
                    setSearchResults([]);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
