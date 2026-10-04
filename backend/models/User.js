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

  static async findById(id, connection = db) {
    try {
      const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      console.error('Error in User.findById:', error);
      throw error;
    }
  }

  static async findByStoreId(storeId, connection = db) {
    try {
      const [rows] = await connection.execute('SELECT * FROM users WHERE store_id = ?', [storeId]);
      return rows;
    } catch (error) {
      console.error('Error in User.findByStoreId:', error);
      throw error;
    }
  }

  static async create(data, connection = db) {
    try {
      const { username, password, role = 'store_manager', store_id } = data;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const [result] = await connection.execute(
        'INSERT INTO users (username, password, role, store_id) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, role, store_id]
      );
      
      return this.findById(result.insertId, connection);
    } catch (error) {
      console.error('Error in User.create:', error);
      throw error;
    }
  }

  static async update(id, data, connection = db) {
    try {
      const { username, role, store_id } = data;
      const updates = [];
      const values = [];
      
      if (username) {
        updates.push('username = ?');
        values.push(username);
      }
      if (role) {
        updates.push('role = ?');
        values.push(role);
      }
      if (store_id !== undefined) {
        updates.push('store_id = ?');
        values.push(store_id);
      }
      
      if (updates.length === 0) {
        return this.findById(id, connection);
      }
      
      values.push(id);
      await connection.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      return this.findById(id, connection);
    } catch (error) {
      console.error('Error in User.update:', error);
      throw error;
    }
  }

  static async createDemoUser(connection = db) {
    try {
      const hashedPassword = await bcrypt.hash('demo123', 10);
      const [result] = await connection.execute(
        'INSERT INTO users (username, password, role, store_id) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE password = ?',
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