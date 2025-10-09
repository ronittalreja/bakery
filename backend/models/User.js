// File: backend/models/User.js
const db = require('../config/database');

class User {
  static async findByUsername(username, connection = db) {
    try {
      if (!username) {
        throw new Error('Username is required');
      }
      const [rows] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
      return rows[0];
    } catch (error) {
      console.error('Error in User.findByUsername:', error);
      throw error;
    }
  }
}

module.exports = User;