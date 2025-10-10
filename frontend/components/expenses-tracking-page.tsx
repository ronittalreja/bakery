"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getAuthToken } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Receipt, Plus, Edit, Trash2, Check, Filter, Calendar, TrendingDown, DollarSign, ChevronDown } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  staffId?: string;
}

interface ExpensesTrackingPageProps {
  onBack: () => void;
}

export function ExpensesTrackingPage({ onBack }: ExpensesTrackingPageProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    date: "",
    category: "",
    description: "",
    amount: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const categories = [
    { value: "Rent", label: "Rent", color: "bg-red-100 text-red-800" },
    { value: "Utilities", label: "Utilities", color: "bg-blue-100 text-blue-800" },
    { value: "Supplies", label: "Supplies", color: "bg-green-100 text-green-800" },
    { value: "Staff", label: "Staff Wages", color: "bg-purple-100 text-purple-800" },
    { value: "Equipment", label: "Equipment", color: "bg-orange-100 text-orange-800" },
    { value: "Marketing", label: "Marketing", color: "bg-pink-100 text-pink-800" },
    { value: "Transport", label: "Transport", color: "bg-yellow-100 text-yellow-800" },
    { value: "Insurance", label: "Insurance", color: "bg-indigo-100 text-indigo-800" },
    { value: "Other", label: "Other", color: "bg-gray-100 text-gray-800" },
  ];

  // Redirect to root (login page) if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/"); // Redirect to root (login page)
    }
  }, [user, authLoading, router]);

  // Fetch expenses when authenticated or month/year changes
  useEffect(() => {
    if (!user) return; // Skip fetch if not authenticated
    const fetchExpenses = async () => {
      setIsLoading(true);
      try {
        const token = getAuthToken();
        if (!token) {
          throw new Error("No authentication token found");
        }
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/expenses?month=${selectedMonth}&year=${selectedYear}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (response.status === 401) {
          router.push("/"); // Redirect to root (login page) on invalid/expired token
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch expenses: ${response.status}`);
        }
        const data = await response.json();
        const expensesArray = Array.isArray(data) ? data : data.expenses || data.data || [];
        const mapped: Expense[] = expensesArray.map((row: any) => ({
          id: String(row.id),
          date: row.expense_date || row.date,
          category: row.category,
          description: row.description,
          amount: Number(row.amount) || 0,
          staffId: row.staff_id ? String(row.staff_id) : undefined,
        })).filter((e: Expense) => e.id && e.date && e.category && e.description && typeof e.amount === 'number');
        setExpenses(mapped);
      } catch (err: any) {
        console.error("Error fetching expenses:", err);
        setError(err.message || "Failed to fetch expenses");
        setTimeout(() => setError(""), 3000);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExpenses();
  }, [user, selectedMonth, selectedYear]);

  const resetForm = () => {
    setFormData({
      date: "",
      category: "",
      description: "",
      amount: "",
    });
    setEditingExpense(null);
  };

  const openAddDialog = () => {
    resetForm();
    setFormData({ ...formData, date: new Date().toISOString().split("T")[0] });
    setIsDialogOpen(true);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Valid amount is required");
      }
      if (!formData.date) {
        throw new Error("Date is required");
      }
      if (!formData.category) {
        throw new Error("Category is required");
      }
      if (!formData.description.trim()) {
        throw new Error("Description is required");
      }
      const payload = {
        expenseDate: formData.date,
        category: formData.category,
        description: formData.description.trim(),
        amount,
      };
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/expenses${editingExpense ? `/${editingExpense.id}` : ""}`,
        {
          method: editingExpense ? "PUT" : "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      if (response.status === 401) {
        router.push("/"); // Redirect to root (login page) on invalid/expired token
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || (editingExpense ? "Failed to update expense" : "Failed to add expense"));
      }
      // Backend returns only insertId/boolean; refetch to sync
      setSuccessMessage(editingExpense ? "Expense updated successfully!" : "Expense added successfully!");
      // Re-fetch list to reflect DB
      const refresh = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/expenses?month=${selectedMonth}&year=${selectedYear}`, { headers: { Authorization: `Bearer ${token}` } });
      const refreshed = await refresh.json();
      const refreshedArray = Array.isArray(refreshed) ? refreshed : refreshed.expenses || refreshed.data || [];
      const refreshedMapped: Expense[] = refreshedArray.map((row: any) => ({
        id: String(row.id),
        date: row.expense_date || row.date,
        category: row.category,
        description: row.description,
        amount: Number(row.amount) || 0,
        staffId: row.staff_id ? String(row.staff_id) : undefined,
      }));
      setExpenses(refreshedMapped);
      setIsDialogOpen(false);
      resetForm();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error saving expense:", err);
      setError(err.message || "Failed to save expense");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/expenses/${expenseId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.status === 401) {
        router.push("/"); // Redirect to root (login page) on invalid/expired token
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete expense");
      }
      // Refetch after delete to stay consistent
      const refresh = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/expenses?month=${selectedMonth}&year=${selectedYear}`, { headers: { Authorization: `Bearer ${token}` } });
      const refreshed = await refresh.json();
      const refreshedArray = Array.isArray(refreshed) ? refreshed : refreshed.expenses || refreshed.data || [];
      const refreshedMapped: Expense[] = refreshedArray.map((row: any) => ({
        id: String(row.id),
        date: row.expense_date || row.date,
        category: row.category,
        description: row.description,
        amount: Number(row.amount) || 0,
        staffId: row.staff_id ? String(row.staff_id) : undefined,
      }));
      setExpenses(refreshedMapped);
      setSuccessMessage("Expense deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error deleting expense:", err);
      setError(err.message || "Failed to delete expense");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    return categories.find((cat) => cat.value === category)?.color || "bg-gray-100 text-gray-800";
  };


  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const getAvailableMonths = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const months = [];
    
    // Generate only months from current year, from current month going backwards
    for (let month = currentMonth; month >= 1; month--) {
      months.push({
        value: `${currentYear}-${month.toString().padStart(2, '0')}`,
        label: `${getMonthName(month)} ${currentYear}`,
        month,
        year: currentYear
      });
    }
    
    return months;
  };

  const handleMonthChange = (monthValue: string) => {
    const [year, month] = monthValue.split('-').map(Number);
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const filteredExpenses = expenses.filter((expense) => {
    const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
    return matchesCategory;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const categoryTotals = categories.map((category) => ({
    ...category,
    total: filteredExpenses.filter((exp) => exp.category === category.value).reduce((sum, exp) => sum + exp.amount, 0),
  }));

  return (
    <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
                  Expenses Tracking - {getMonthName(selectedMonth)} {selectedYear}
                </h1>
                <p className="text-slate-600 mt-1 text-sm sm:text-base">Track and manage all business expenses</p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <Select 
                  value={`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`} 
                  onValueChange={handleMonthChange}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-48 bg-white border-slate-300 focus:border-slate-500">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableMonths().map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={openAddDialog} className="flex items-center gap-2 bg-white hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 transition-all duration-200">
                <Plus className="h-4 w-4" />
                Add Expense
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
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">₹{totalExpenses.toLocaleString()}</div>
                <div className="text-sm text-slate-600">Total Expenses</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{filteredExpenses.length}</div>
                <div className="text-sm text-slate-600">Transactions</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">
                  ₹{filteredExpenses.length > 0 ? Math.round(totalExpenses / filteredExpenses.length) : 0}
                </div>
                <div className="text-sm text-slate-600">Avg. per Transaction</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Category Breakdown</h2>
          </div>
          <div className="p-4 sm:p-6">
            {categoryTotals.every((cat) => cat.total === 0) ? (
              <div className="text-center py-8 text-slate-600">No expense data available</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {categoryTotals
                  .filter((cat) => cat.total > 0)
                  .map((category) => (
                    <div key={category.value} className="text-center p-3 bg-muted/30 rounded-lg">
                      <Badge className={`${category.color} border-0 mb-2`} variant="secondary">
                        {category.label}
                      </Badge>
                      <div className="font-bold text-lg">₹{category.total.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {totalExpenses > 0 ? ((category.total / totalExpenses) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Category Filter:</span>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoading}>
              <SelectTrigger className="w-40 bg-white border-slate-300 focus:border-slate-500">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Expense Records</h2>
            <p className="text-slate-600 mt-1 text-sm">
              Showing {sortedExpenses.length} expense{sortedExpenses.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8 text-slate-600">Loading expense data...</div>
            ) : sortedExpenses.length === 0 ? (
              <div className="text-center py-8 text-slate-600">No expenses available</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-mono text-sm">{formatDate(expense.date)}</TableCell>
                        <TableCell>
                          <Badge className={`${getCategoryColor(expense.category)} border-0`} variant="secondary">
                            {expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell className="font-bold text-red-600">₹{expense.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(expense)} disabled={isLoading}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(expense.id)} disabled={isLoading}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-xl font-bold text-slate-900">{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {editingExpense ? "Update expense information" : "Enter details for the new expense"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-medium text-slate-700">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium text-slate-700">Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="1500"
                    required
                    disabled={isLoading}
                    className="bg-white border-slate-300 focus:border-slate-500"
                  />
                </div>
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
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-slate-700">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Monthly electricity bill"
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
                  {isLoading ? "Processing..." : editingExpense ? "Update Expense" : "Add Expense"}
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
      </div>
    </main>
  );
}