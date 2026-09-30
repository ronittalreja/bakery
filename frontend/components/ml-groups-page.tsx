"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle, Search, Settings, Layers, FileText } from "lucide-react";

interface Product {
  id: number;
  product_id: string;
  name: string;
  category: string;
  price: number;
  item_type: string;
  ml_group_id: string | null;
  active: boolean;
  alias_count: number;
}

interface Alias {
  id: number;
  product_id: string;
  historical_item_code: string;
  historical_name: string;
  effective_from: string | null;
  effective_to: string | null;
  current_product_name: string;
}

interface ValidationReport {
  summary: {
    total_invoice_items: number;
    mapped_items: number;
    unmapped_items: number;
    mapping_conflicts: number;
    ml_groups: {
      total_groups: number;
      total_products: number;
      with_ml_group: number;
      without_ml_group: number;
    };
  };
  unmapped_items: Array<{
    item_name: string;
    total_qty: number;
    invoice_count: number;
    first_seen: string;
    last_seen: string;
  }>;
  conflicts: Array<{
    historical_item_code: string;
    historical_name: string;
    mapping_count: number;
    mapped_to: string;
  }>;
}

interface MLGroupsPageProps {
  onBack: () => void;
}

export function MLGroupsPage({ onBack }: MLGroupsPageProps) {
  const [view, setView] = useState<"products" | "validation">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchValidationReport = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/validation-report`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setValidationReport(data.data);
      }
    } catch (error) {
      console.error('Error fetching validation report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAliases = async (productId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products/${productId}/aliases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAliases(data.data);
      }
    } catch (error) {
      console.error('Error fetching aliases:', error);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.product_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <h1 className="text-2xl font-bold text-slate-900">ML Groups & Aliases</h1>
                <p className="text-sm text-slate-600">Manage product mappings for ML forecasting</p>
              </div>
            </div>
            <Button onClick={() => fetchProducts()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          {/* View Toggle */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={view === "products" ? "default" : "outline"}
              onClick={() => setView("products")}
              className="flex items-center gap-2"
            >
              <Layers className="h-4 w-4" />
              Products
            </Button>
            <Button
              variant={view === "validation" ? "default" : "outline"}
              onClick={() => {
                setView("validation");
                fetchValidationReport();
              }}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Validation Report
            </Button>
          </div>

          {view === "products" && (
            <>
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
                  <CardTitle>Products ({filteredProducts.length})</CardTitle>
                  <CardDescription>
                    Manage ML group IDs and aliases for products
                  </CardDescription>
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
                        <TableHead>Aliases</TableHead>
                        <TableHead>Status</TableHead>
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
                          <TableCell className="font-mono text-xs">
                            {product.ml_group_id || <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.alias_count > 0 ? "default" : "secondary"}>
                              {product.alias_count}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {product.active ? (
                              <Badge variant="default" className="bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedProductId(product.product_id);
                                fetchAliases(product.product_id);
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Aliases Panel */}
              {selectedProductId && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Aliases for {selectedProductId}</CardTitle>
                    <CardDescription>
                      Historical item codes and names mapped to this product
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                        {aliases.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-slate-500">
                              No aliases found
                            </TableCell>
                          </TableRow>
                        ) : (
                          aliases.map((alias) => (
                            <TableRow key={alias.id}>
                              <TableCell className="font-mono text-xs">{alias.historical_item_code}</TableCell>
                              <TableCell>{alias.historical_name}</TableCell>
                              <TableCell>{alias.effective_from || '-'}</TableCell>
                              <TableCell>{alias.effective_to || '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {view === "validation" && (
            <>
              {isLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600">Loading validation report...</p>
                </div>
              ) : validationReport ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">Total Invoice Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{validationReport.summary.total_invoice_items}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">Mapped Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">{validationReport.summary.mapped_items}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">Unmapped Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">{validationReport.summary.unmapped_items}</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ML Groups Stats */}
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle>ML Group Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-slate-600">Total Groups</div>
                          <div className="text-xl font-bold">{validationReport.summary.ml_groups.total_groups}</div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-600">Total Products</div>
                          <div className="text-xl font-bold">{validationReport.summary.ml_groups.total_products}</div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-600">With ML Group</div>
                          <div className="text-xl font-bold text-green-600">{validationReport.summary.ml_groups.with_ml_group}</div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-600">Without ML Group</div>
                          <div className="text-xl font-bold text-red-600">{validationReport.summary.ml_groups.without_ml_group}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Unmapped Items */}
                  {validationReport.unmapped_items.length > 0 && (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          Unmapped Items ({validationReport.unmapped_items.length})
                        </CardTitle>
                        <CardDescription>
                          These items exist in invoices but are not mapped to any product or alias
                        </CardDescription>
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationReport.unmapped_items.slice(0, 50).map((item) => (
                              <TableRow key={item.item_name}>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell>{item.total_qty}</TableCell>
                                <TableCell>{item.invoice_count}</TableCell>
                                <TableCell>{new Date(item.first_seen).toLocaleDateString()}</TableCell>
                                <TableCell>{new Date(item.last_seen).toLocaleDateString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {validationReport.unmapped_items.length > 50 && (
                          <p className="text-sm text-slate-500 mt-4">
                            Showing 50 of {validationReport.unmapped_items.length} unmapped items
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Conflicts */}
                  {validationReport.conflicts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                          Mapping Conflicts ({validationReport.conflicts.length})
                        </CardTitle>
                        <CardDescription>
                          These historical items are mapped to multiple products
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Historical Code</TableHead>
                              <TableHead>Historical Name</TableHead>
                              <TableHead>Mapping Count</TableHead>
                              <TableHead>Mapped To</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationReport.conflicts.map((conflict) => (
                              <TableRow key={`${conflict.historical_item_code}-${conflict.historical_name}`}>
                                <TableCell className="font-mono text-xs">{conflict.historical_item_code}</TableCell>
                                <TableCell>{conflict.historical_name}</TableCell>
                                <TableCell>
                                  <Badge variant="destructive">{conflict.mapping_count}</Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{conflict.mapped_to}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {validationReport.unmapped_items.length === 0 && validationReport.conflicts.length === 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        All items are properly mapped! No issues found.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
