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
      created_by,
      store_id = 1
    } = creditNoteData;

    const [result] = await db.execute(
      `INSERT INTO credit_notes (
        credit_note_number, customer_name, customer_email, customer_phone, 
        amount, reason, status, notes, created_by, store_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        credit_note_number, customer_name, customer_email, customer_phone,
        amount, reason, status, notes, created_by, store_id
      ]
    );

    return result.insertId;
  }

  static async findById(id, storeId = null) {
    let query = 'SELECT * FROM credit_notes WHERE id = ?';
    const params = [id];
    
    if (storeId) {
      query += ' AND store_id = ?';
      params.push(storeId);
    }
    
    const [rows] = await db.execute(query, params);
    return rows[0];
  }

  static async findByMonth(month, year, storeId = null) {
    let query = 'SELECT * FROM credit_notes WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?';
    const params = [month, year];
    
    if (storeId) {
      query += ' AND store_id = ?';
      params.push(storeId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async updateStatus(id, status, storeId = null) {
    let query = 'UPDATE credit_notes SET status = ?, updated_at = NOW() WHERE id = ?';
    const params = [status, id];
    
    if (storeId) {
      query += ' AND store_id = ?';
      params.push(storeId);
    }
    
    const [result] = await db.execute(query, params);
    return result.affectedRows > 0;
  }

  static async delete(id, storeId = null) {
    let query = 'DELETE FROM credit_notes WHERE id = ?';
    const params = [id];
    
    if (storeId) {
      query += ' AND store_id = ?';
      params.push(storeId);
    }
    
    const [result] = await db.execute(query, params);
    return result.affectedRows > 0;
  }
}

module.exports = CreditNote;
