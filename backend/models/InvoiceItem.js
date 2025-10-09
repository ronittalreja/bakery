// File: backend/models/InvoiceItem.js
const db = require('../config/database');

class InvoiceItem {
  static async create(itemData, connection = db) {
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
          itemData.total
        ]
      );
    } catch (error) {
      console.error('Error in InvoiceItem.create:', error);
      throw error;
    }
  }
}

module.exports = InvoiceItem;