// File: backend/models/Return.js
const db = require('../config/database');

class Return {
  static async createGrmReturn(data, connection = db) {
    try {
      const [result] = await connection.execute(
        'INSERT INTO returns (return_date, type, product_id, batch_id, quantity, invoice_price, loss_amount, staff_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          data.returnDate,
          'GRM',
          data.productId,
          data.batchId,
          data.quantity,
          data.invoicePrice,
          data.lossAmount,
          data.staffId
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error in Return.createGrmReturn:', error);
      throw error;
    }
  }

  static async createGvnDamage(data, connection = db) {
    try {
      const [result] = await connection.execute(
        'INSERT INTO returns (return_date, type, product_id, batch_id, quantity, invoice_price, loss_amount, staff_id) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
        [
          data.damageDate,
          'GVN',
          data.productId,
          data.batchId,
          data.quantity,
          data.invoicePrice,
          data.staffId
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error in Return.createGvnDamage:', error);
      throw error;
    }
  }

  static async getGrmReturns(targetDate, connection = db) {
    try {
      const yesterday = new Date(targetDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const [rows] = await connection.execute(
        `
        SELECT r.*, p.name, p.item_code, p.invoice_price
        FROM returns r
        JOIN products p ON r.product_id = p.id
        JOIN stock_batches sb ON r.batch_id = sb.id
        WHERE r.type = 'GRM' AND r.return_date = ? AND sb.quantity > 0 AND sb.expiry_date = ?
        `,
        [targetDate, yesterdayStr]
      );
      return rows;
    } catch (error) {
      console.error('Error in Return.getGrmReturns:', error);
      throw error;
    }
  }

  static async getGvnDamages(targetDate, connection = db) {
    try {
      const [rows] = await connection.execute(
        `
        SELECT r.*, p.name, p.item_code, p.invoice_price
        FROM returns r
        JOIN products p ON r.product_id = p.id
        WHERE r.type = 'GVN' AND r.return_date = ?
        `,
        [targetDate]
      );
      return rows;
    } catch (error) {
      console.error('Error in Return.getGvnDamages:', error);
      throw error;
    }
  }

  static async getGrmReturnsSummary(date, connection = db) {
    try {
      const [rows] = await connection.execute(
        `
        SELECT COUNT(*) AS totalReturns, SUM(quantity) AS totalQuantity, SUM(loss_amount) AS totalLoss
        FROM returns
        WHERE type = 'GRM' AND return_date = ?
        `,
        [date]
      );
      return {
        totalReturns: Number(rows[0].totalReturns) || 0,
        totalQuantity: Number(rows[0].totalQuantity) || 0,
        totalLoss: Number(rows[0].totalLoss) || 0
      };
    } catch (error) {
      console.error('Error in Return.getGrmReturnsSummary:', error);
      throw error;
    }
  }

  static async getGvnDamagesSummary(date, connection = db) {
    try {
      const [rows] = await connection.execute(
        `
        SELECT COUNT(*) AS totalDamages, SUM(quantity) AS totalQuantity
        FROM returns
        WHERE type = 'GVN' AND return_date = ?
        `,
        [date]
      );
      return {
        totalDamages: Number(rows[0].totalDamages) || 0,
        totalQuantity: Number(rows[0].totalQuantity) || 0
      };
    } catch (error) {
      console.error('Error in Return.getGvnDamagesSummary:', error);
      throw error;
    }
  }
}

module.exports = Return;