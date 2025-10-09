const db = require('../config/database');

class CreditNote {
  static async create(creditNoteData) {
    const {
      credit_note_number,
      customer_name,
      customer_email,
      customer_phone,
      amount,
      reason,
      status = 'active',
      notes = '',
      created_by
    } = creditNoteData;

    const [result] = await db.execute(
      `INSERT INTO credit_notes (
        credit_note_number, customer_name, customer_email, customer_phone, 
        amount, reason, status, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        credit_note_number, customer_name, customer_email, customer_phone,
        amount, reason, status, notes, created_by
      ]
    );

    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM credit_notes WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async findByMonth(month, year) {
    const [rows] = await db.execute(
      'SELECT * FROM credit_notes WHERE MONTH(created_at) = ? AND YEAR(created_at) = ? ORDER BY created_at DESC',
      [month, year]
    );
    return rows;
  }

  static async updateStatus(id, status) {
    const [result] = await db.execute(
      'UPDATE credit_notes SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.execute(
      'DELETE FROM credit_notes WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = CreditNote;
