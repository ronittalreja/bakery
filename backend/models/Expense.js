// File: backend/models/Expense.js
const db = require('../config/database');

class Expense {
  static async findAll(month, year) {
    let query = 'SELECT * FROM expenses';
    const params = [];
    if (month && year) {
      query += ' WHERE MONTH(expense_date) = ? AND YEAR(expense_date) = ?';
      params.push(parseInt(month), parseInt(year));
    }
    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async create(data) {
    const [result] = await db.execute(
      'INSERT INTO expenses (expense_date, category, description, amount, staff_id) VALUES (?, ?, ?, ?, ?)',
      [data.expenseDate, data.category, data.description, data.amount, data.staffId]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const [result] = await db.execute(
      'UPDATE expenses SET expense_date = ?, category = ?, description = ?, amount = ? WHERE id = ?',
      [data.expenseDate, data.category, data.description, data.amount, id]
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.execute('DELETE FROM expenses WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getSummary(month, year) {
    let query = 'SELECT category, SUM(amount) as total FROM expenses';
    const params = [];
    if (month && year) {
      query += ' WHERE MONTH(expense_date) = ? AND YEAR(expense_date) = ?';
      params.push(parseInt(month), parseInt(year));
    }
    query += ' GROUP BY category';
    const [rows] = await db.execute(query, params);
    return rows;
  }
}

module.exports = Expense;