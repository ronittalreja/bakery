const db = require('../config/database');

class Damage {
  static async createGvnDamage(data) {
    await db.execute('INSERT INTO damages SET ?', [data]);
  }

  static async getGvnDamages(targetDate) {
    const [rows] = await db.execute(`
      SELECT d.*, p.name
      FROM damages d
      JOIN products p ON d.product_id = p.id
      WHERE d.damage_date = ?
    `, [targetDate]);
    return rows;
  }

  static async getGvnDamagesReport(startDate, endDate) {
    const [rows] = await db.execute(`
      SELECT * FROM damages
      WHERE damage_date BETWEEN ? AND ?
    `, [startDate, endDate]);
    return rows;
  }

  static async getGvnDamagesSummary(date) {
    const [rows] = await db.execute(`
      SELECT SUM(quantity * invoice_price) as total_loss
      FROM damages
      WHERE damage_date = ?
    `, [date]);
    return rows[0];
  }
}

module.exports = Damage;