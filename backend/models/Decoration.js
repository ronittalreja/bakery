const db = require('../config/database');

class Decoration {
  static async findAll() {
    const [rows] = await db.execute('SELECT * FROM decorations WHERE is_active = 1');
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM decorations WHERE id = ?', [id]);
    return rows[0];
  }

  static async create(data) {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const [result] = await db.execute(`INSERT INTO decorations (${fields}) VALUES (${placeholders})`, values);
    return { id: result.insertId, ...data };
  }

  static async update(id, data) {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    await db.execute(`UPDATE decorations SET ${fields} WHERE id = ?`, [...values, id]);
    return this.findById(id);
  }

  static async delete(id) {
    await db.execute('UPDATE decorations SET is_active = 0 WHERE id = ?', [id]);
    return true;
  }

  static async findBySkuOrName(sku, name) {
    const [rows] = await db.execute('SELECT * FROM decorations WHERE (sku = ? OR name = ?) AND is_active = 1', [sku, name]);
    return rows[0];
  }
}

module.exports = Decoration;