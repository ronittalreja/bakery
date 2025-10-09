// const db = require('../config/database');

// class Sale {
//   static async create(data) {
//     const [result] = await db.execute('INSERT INTO sales SET ?', [data]);
//     return { id: result.insertId, ...data };
//   }

//   static async addSaleItem(data) {
//     await db.execute('INSERT INTO sale_items SET ?', [data]);
//   }

//   static async findByDate(date) {
//     const [rows] = await db.execute('SELECT * FROM sales WHERE sale_date = ?', [date]);
//     return rows;
//   }

//   static async getSaleItems(saleId) {
//     const [rows] = await db.execute('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
//     return rows;
//   }

//   static async getSalesSummary(date) {
//     const [rows] = await db.execute(`
//       SELECT payment_type, SUM(total_amount) as total
//       FROM sales
//       WHERE sale_date = ?
//       GROUP BY payment_type
//     `, [date]);
//     return rows;
//   }

//   static async getSalesReport(startDate, endDate) {
//     const [rows] = await db.execute(`
//       SELECT * FROM sales
//       WHERE sale_date BETWEEN ? AND ?
//     `, [startDate, endDate]);
//     return rows;
//   }

//   static async getProductSalesReport(startDate, endDate) {
//     const [rows] = await db.execute(`
//       SELECT p.name, SUM(si.quantity) as quantity, SUM(si.total_price) as total
//       FROM sale_items si
//       JOIN products p ON si.product_id = p.id
//       JOIN sales s ON si.sale_id = s.id
//       WHERE s.sale_date BETWEEN ? AND ?
//       GROUP BY p.id
//     `, [startDate, endDate]);
//     return rows;
//   }
// }

// module.exports = Sale;


// File: backend/models/Sale.js
const db = require('../config/database');

class Sale {
  static async create(saleData, connection = db) {
    try {
      const [result] = await connection.execute(
        'INSERT INTO sales (sale_date, total_amount, payment_type, staff_id) VALUES (?, ?, ?, ?)',
        [saleData.saleDate, saleData.totalAmount, saleData.paymentType, saleData.staffId || 0]
      );
      return { saleId: result.insertId };
    } catch (error) {
      console.error('Error in Sale.create:', error);
      throw error;
    }
  }

  static async createSaleItem(itemData, connection = db) {
    try {
      await connection.execute(
        'INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price, name) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          itemData.saleId,
          itemData.productId,
          itemData.batchId,
          itemData.quantity,
          itemData.unitPrice,
          itemData.totalPrice,
          itemData.name
        ]
      );
    } catch (error) {
      console.error('Error in Sale.createSaleItem:', error);
      throw error;
    }
  }

  static async getByDate(date, connection = db) {
    

  const [rows] = await connection.execute(
    'SELECT * FROM sales WHERE sale_date = ?',
    [date]
  );
  return rows;
}





}

module.exports = Sale;