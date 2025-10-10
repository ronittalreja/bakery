// File: backend/models/Invoice.js
const db = require('../config/database');

class Invoice {
  static async create(invoiceData, connection = db) {
    try {
      const [result] = await connection.execute(
        'INSERT INTO invoices (invoice_number, invoice_date, store, customer_name, total_amount, file_reference) VALUES (?, ?, ?, ?, ?, ?)',
        [
          invoiceData.invoiceNo,
          invoiceData.invoiceDate || null,
          invoiceData.store || null,
          invoiceData.customerName || invoiceData.store || 'Unknown Customer',
          invoiceData.totalAmount,
          invoiceData.fileReference || null,
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error in Invoice.create:', error);
      throw error;
    }
  }

  static async findByDate(invoiceDate, connection = db) {
    try {
      const [rows] = await connection.execute('SELECT * FROM invoices WHERE invoice_date = ?', [invoiceDate]);
      return rows;
    } catch (error) {
      console.error('Error in Invoice.findByDate:', error);
      throw error;
    }
  }

  static async createItem(itemData, connection = db) {
    try {
      await connection.execute(
        'INSERT INTO invoice_items (invoice_id, sl_no, item_code, item_name, hsn_code, qty, uom, rate, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          itemData.invoiceId,
          itemData.slNo,
          itemData.itemCode,
          itemData.itemName,
          itemData.hsnCode,
          itemData.qty,
          itemData.uom,
          itemData.rate,
          itemData.total,
        ]
      );
    } catch (error) {
      console.error('Error in Invoice.createItem:', error);
      throw error;
    }
  }
}

module.exports = Invoice;