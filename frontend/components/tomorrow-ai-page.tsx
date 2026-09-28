// Tomorrow AI Dashboard Page
// Demand forecasting dashboard for Monginis

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, TrendingUp, Calendar, RefreshCw, Database, Settings, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Product {
  id: number;
  product_id: string;
  name: string;
  category: string;
  price: number;
  item_type: string;
  ml_group_id: string;
  active: boolean;
  alias_count: number;
}

interface DailySales {
  sale_date: string;
  ml_group_id: string;
  product_name: string;
  actual_sales: number;
  is_shop_open: boolean;
  event_name: string | null;
  days_to_event: number | null;
}

interface FeatureData {
  date: string;
  ml_group_id: string;
  target: number | null;
  day_of_week: number;
  is_weekend: number;
  sales_1_day_ago: number | null;
  sales_7_days_ago: number | null;
  rolling_avg_7: number | null;
  event_name: string | null;
  days_to_event: number | null;
}

export default function TomorrowAIPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "data" | "features" | "predictions">("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [featureData, setFeatureData] = useState<FeatureData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [filterItemType, setFilterItemType] = useState<string>("DISPLAY");
  const [dataStartDate, setDataStartDate] = useState("");
  const [dataEndDate, setDataEndDate] = useState("");
  const [predictionDate, setPredictionDate] = useState("");
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    setDataStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setDataEndDate(today.toISOString().split('T')[0]);
    setPredictionDate(tomorrow.toISOString().split('T')[0]);

    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/products?itemType=${filterItemType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchDailySales = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/daily-sales?startDate=${dataStartDate}&endDate=${dataEndDate}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDailySales(data.data);
      }
    } catch (error) {
      console.error('Error fetching daily sales:', error);
    }
  };

  const fetchFeatureData = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/features?startDate=${dataStartDate}&endDate=${dataEndDate}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setFeatureData(data.data);
      }
    } catch (error) {
      console.error('Error fetching feature data:', error);
    }
  };

  const triggerHistoricalSync = async () => {
    setIsLoading(true);
    setSyncStatus(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/sync/historical`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setSyncStatus({ message: `Historical sync completed: ${data.data.totalRecords} records`, type: "success" });
      } else {
        setSyncStatus({ message: data.error || "Sync failed", type: "error" });
      }
    } catch (error: any) {
      setSyncStatus({ message: error.message || "Sync failed", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerDailySync = async () => {
    setIsLoading(true);
    setSyncStatus(null);
    try {
      const token = localStorage.getItem('token');
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/sync`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: today })
      });
      const data = await response.json();
      if (data.success) {
        setSyncStatus({ message: `Daily sync completed: ${data.data.recordsProcessed} records`, type: "success" });
      } else {
        setSyncStatus({ message: data.error || "Sync failed", type: "error" });
      }
    } catch (error: any) {
      setSyncStatus({ message: error.message || "Sync failed", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const generateFeatures = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/features/generate`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          startDate: dataStartDate, 
          endDate: dataEndDate 
        })
      });
      const data = await response.json();
      if (data.success) {
        setSyncStatus({ message: `Features generated: ${data.data.featuresGenerated} records`, type: "success" });
        fetchFeatureData();
      } else {
        setSyncStatus({ message: data.error || "Feature generation failed", type: "error" });
      }
    } catch (error: any) {
      setSyncStatus({ message: error.message || "Feature generation failed", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePredictions = async () => {
    setIsLoading(true);
    setSyncStatus(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/model/predict`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ predictionDate })
      });
      const data = await response.json();
      if (data.success) {
        setSyncStatus({ message: `Predictions generated for ${predictionDate}`, type: "success" });
        fetchPredictions();
      } else {
        setSyncStatus({ message: data.error || "Prediction generation failed", type: "error" });
      }
    } catch (error: any) {
      setSyncStatus({ message: error.message || "Prediction generation failed", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPredictions = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/model/predictions?predictionDate=${predictionDate}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setPredictions(data.data);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-6 w-6 text-purple-600" />
                  Tomorrow AI
                </CardTitle>
                <CardDescription>
                  Demand forecasting system for Monginis
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-purple-600 border-purple-600">
                Admin Only
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Sync Status */}
        {syncStatus && (
          <Alert variant={syncStatus.type === "success" ? "default" : "destructive"}>
            {syncStatus.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{syncStatus.message}</AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === "overview" ? "default" : "ghost"}
            onClick={() => setActiveTab("overview")}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeTab === "products" ? "default" : "ghost"}
            onClick={() => setActiveTab("products")}
          >
            <Database className="h-4 w-4 mr-2" />
            Products
          </Button>
          <Button
            variant={activeTab === "data" ? "default" : "ghost"}
            onClick={() => setActiveTab("data")}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Daily Sales
          </Button>
          <Button
            variant={activeTab === "features" ? "default" : "ghost"}
            onClick={() => setActiveTab("features")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Features
          </Button>
          <Button
            variant={activeTab === "predictions" ? "default" : "ghost"}
            onClick={() => setActiveTab("predictions")}
          >
            <Brain className="h-4 w-4 mr-2" />
            Predictions
          </Button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Sync</CardTitle>
                <CardDescription>
                  Sync invoice/CRDR data to Tomorrow AI tables
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={triggerHistoricalSync}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Full Historical Sync
                  </Button>
                  <Button
                    onClick={triggerDailySync}
                    disabled={isLoading}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Daily Sync
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Historical sync processes all historical invoice/CRDR data. Daily sync processes only today's data.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{products.length}</div>
                    <div className="text-sm text-muted-foreground">Products</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{products.filter(p => p.item_type === 'DISPLAY').length}</div>
                    <div className="text-sm text-muted-foreground">Display Items</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{dailySales.length}</div>
                    <div className="text-sm text-muted-foreground">Daily Records</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{featureData.length}</div>
                    <div className="text-sm text-muted-foreground">Feature Records</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Products</CardTitle>
                  <CardDescription>Manage product classification and ML groups</CardDescription>
                </div>
                <Select value={filterItemType} onValueChange={setFilterItemType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISPLAY">DISPLAY</SelectItem>
                    <SelectItem value="SPECIAL_ORDER">SPECIAL_ORDER</SelectItem>
                    <SelectItem value="PACKING_MATERIAL">PACKING_MATERIAL</SelectItem>
                    <SelectItem value="OTHER">OTHER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Item Type</TableHead>
                    <TableHead>ML Group</TableHead>
                    <TableHead>Aliases</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        <Badge variant={product.item_type === 'DISPLAY' ? 'default' : 'secondary'}>
                          {product.item_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.ml_group_id}</TableCell>
                      <TableCell>{product.alias_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Daily Sales Tab */}
        {activeTab === "data" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Daily Sales Data</CardTitle>
                  <CardDescription>Inspect normalized daily sales for ML training</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dataStartDate}
                    onChange={(e) => setDataStartDate(e.target.value)}
                    className="w-[150px]"
                  />
                  <Input
                    type="date"
                    value={dataEndDate}
                    onChange={(e) => setDataEndDate(e.target.value)}
                    className="w-[150px]"
                  />
                  <Button onClick={fetchDailySales} size="sm">
                    Load
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>ML Group</TableHead>
                    <TableHead>Actual Sales</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Days to Event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySales.slice(0, 50).map((sale, index) => (
                    <TableRow key={index}>
                      <TableCell>{sale.sale_date}</TableCell>
                      <TableCell>{sale.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">{sale.ml_group_id}</TableCell>
                      <TableCell>{sale.actual_sales}</TableCell>
                      <TableCell>{sale.event_name || '—'}</TableCell>
                      <TableCell>{sale.days_to_event !== null ? sale.days_to_event : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {dailySales.length > 50 && (
                <p className="text-sm text-muted-foreground mt-4">
                  Showing first 50 of {dailySales.length} records
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Features Tab */}
        {activeTab === "features" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Feature Data</CardTitle>
                  <CardDescription>Inspect generated ML features</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dataStartDate}
                    onChange={(e) => setDataStartDate(e.target.value)}
                    className="w-[150px]"
                  />
                  <Input
                    type="date"
                    value={dataEndDate}
                    onChange={(e) => setDataEndDate(e.target.value)}
                    className="w-[150px]"
                  />
                  <Button onClick={generateFeatures} size="sm" disabled={isLoading}>
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    Generate
                  </Button>
                  <Button onClick={fetchFeatureData} size="sm" variant="outline">
                    Load
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>ML Group</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Weekend</TableHead>
                    <TableHead>Sales 1d Ago</TableHead>
                    <TableHead>Sales 7d Ago</TableHead>
                    <TableHead>Rolling 7d</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Days to Event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureData.slice(0, 50).map((feature, index) => (
                    <TableRow key={index}>
                      <TableCell>{feature.date}</TableCell>
                      <TableCell className="font-mono text-xs">{feature.ml_group_id}</TableCell>
                      <TableCell>{feature.target !== null ? feature.target : 'NULL'}</TableCell>
                      <TableCell>{feature.day_of_week}</TableCell>
                      <TableCell>{feature.is_weekend}</TableCell>
                      <TableCell>{feature.sales_1_day_ago !== null ? feature.sales_1_day_ago : 'NULL'}</TableCell>
                      <TableCell>{feature.sales_7_days_ago !== null ? feature.sales_7_days_ago : 'NULL'}</TableCell>
                      <TableCell>{feature.rolling_avg_7 !== null ? feature.rolling_avg_7.toFixed(2) : 'NULL'}</TableCell>
                      <TableCell>{feature.event_name || '—'}</TableCell>
                      <TableCell>{feature.days_to_event !== null ? feature.days_to_event : 'NULL'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {featureData.length > 50 && (
                <p className="text-sm text-muted-foreground mt-4">
                  Showing first 50 of {featureData.length} records
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Predictions Tab */}
        {activeTab === "predictions" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Demand Predictions</CardTitle>
                  <CardDescription>View and generate demand forecasts</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={predictionDate}
                    onChange={(e) => setPredictionDate(e.target.value)}
                    className="w-[150px]"
                  />
                  <Button onClick={generatePredictions} size="sm" disabled={isLoading}>
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4 mr-2" />
                    )}
                    Generate
                  </Button>
                  <Button onClick={fetchPredictions} size="sm" variant="outline">
                    Load
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Predicted Demand</TableHead>
                    <TableHead>Recommended Order</TableHead>
                    <TableHead>Model Version</TableHead>
                    <TableHead>Generated At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((pred, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{pred.product_name}</TableCell>
                      <TableCell>{pred.predicted_demand}</TableCell>
                      <TableCell className="font-bold text-green-600">{pred.recommended_order}</TableCell>
                      <TableCell>{pred.model_version}</TableCell>
                      <TableCell>
                        {new Date(pred.prediction_generated_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {predictions.length === 0 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  No predictions found for {predictionDate}. Click "Generate" to create predictions.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
