// File: backend/models/User.js
const db = require('../config/database');
const bcrypt = require('bcryptjs');

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

  static async createDemoUser(connection = db) {
    try {
      const hashedPassword = await bcrypt.hash('demo123', 10);
      const [result] = await connection.execute(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password = ?',
        ['demo', hashedPassword, 'staff', hashedPassword]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error in User.createDemoUser:', error);
      throw error;
    }
  }
}

module.exports = User;