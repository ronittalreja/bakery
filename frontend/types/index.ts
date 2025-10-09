export interface User {
  id: string;
  username: string;
  role: "staff" | "admin";
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category?: string;
  shelf_life_days?: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  sale_date: string;
  staff_id: string;
  product?: Product;
}

export interface StockBatch {
  id: string;
  product_id: string;
  quantity: number;
  purchase_price: number;
  expiry_date: string;
  batch_number: string;
  invoice_date: string;
  invoice_reference?: string;
  created_at: string;
  product?: Product;
}

export interface Return {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  return_date: string;
  staff_id: string;
  product?: Product;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
}

export interface Decoration {
  id: string;
  name: string;
  price: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Damage {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  date: string;
  staff_id: string;
  product?: Product;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  date: string;
  file_path: string;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}
