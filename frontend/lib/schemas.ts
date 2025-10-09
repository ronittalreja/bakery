import { z } from "zod"

export const StockItemSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  stockDate: z.string(),
  productName: z.string(),
  quantity: z.number().int().nonnegative(),
  invoicePrice: z.number().nonnegative(),
  mrp: z.number().nonnegative(),
  image: z.string(),
  expiryDate: z.string().optional(),
  isDecoration: z.boolean(),
  grmLoss: z.number().nonnegative(),
})

export const InvoiceItemSchema = z.object({
  slNo: z.number().int().positive(),
  itemCode: z.string(),
  itemName: z.string(),
  hsnCode: z.string(),
  qty: z.number().int().positive(),
  uom: z.string(),
  rate: z.number().nonnegative(),
  total: z.number().nonnegative(),
})

export const InvoiceDataSchema = z.object({
  invoiceNo: z.string(),
  invoiceDate: z.string(),
  store: z.string(),
  items: z.array(InvoiceItemSchema),
  totalQty: z.number().int().nonnegative(),
  totalAmount: z.number().nonnegative(),
  pageCount: z.number().int().positive(),
  validation: z.object({
    isToday: z.boolean(),
    isCorrectStore: z.boolean(),
    isValid: z.boolean(),
  }),
})

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  mrp: z.number().nonnegative(),
  invoicePrice: z.number().nonnegative(),
  icon: z.string(),
  stock: z.number().int().nonnegative(),
  batchId: z.string(),
  imageUrl: z.string(),
  isDecoration: z.boolean(),
})

export const SaleItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
})

export const SaleTransactionSchema = z.object({
  id: z.string(),
  time: z.string(),
  date: z.string(),
  staffMember: z.string(),
  items: z.array(SaleItemSchema),
  totalAmount: z.number().nonnegative(),
  paymentMethod: z.string(),
})

export const AddCakeSchema = z.object({
  name: z.string().min(1, "Cake name is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  invoicePrice: z.number().nonnegative("Invoice price must be non-negative"),
  expiryDate: z.string().min(1, "Expiry date is required"),
})