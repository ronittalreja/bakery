// File: backend/models/Invoice.js
const db = require('../config/database');

class Invoice {
  static async create(invoiceData, connection = db) {
    try {
      const storeId = invoiceData.store_id || 1;
      const [result] = await connection.execute(
        'INSERT INTO invoices (invoice_number, invoice_date, store, customer_name, total_amount, file_reference, store_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          invoiceData.invoiceNo,
          invoiceData.invoiceDate || null,
          invoiceData.store || null,
          invoiceData.customerName || invoiceData.store || 'Unknown Customer',
          invoiceData.totalAmount,
          invoiceData.fileReference || null,
          storeId
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error in Invoice.create:', error);
      throw error;
    }
  }

  static async findByDate(invoiceDate, storeId = null, connection = db) {
    try {
      let query = 'SELECT * FROM invoices WHERE invoice_date = ?';
      const params = [invoiceDate];
      
      if (storeId) {
        query += ' AND store_id = ?';
        params.push(storeId);
      }
      
      const [rows] = await connection.execute(query, params);
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