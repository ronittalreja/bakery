// Store Controller
// Manages store CRUD operations and user assignments

const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * Get all stores
 * - Super admins see all stores
 * - Area/Regional managers see their assigned stores
 * - Store managers see only their store
 */
const getAllStores = async (req, res) => {
  try {
    const user = req.user;
    let query = 'SELECT * FROM stores WHERE status = "active"';
    const params = [];

    // Filter based on user role
    if (user.role === 'store_manager') {
      query += ' AND id = ?';
      params.push(user.store_id);
    } else if (user.role === 'area_manager') {
      query += ' AND area_manager_id = ?';
      params.push(user.id);
    } else if (user.role === 'regional_manager') {
      query += ' AND regional_manager_id = ?';
      params.push(user.id);
    }

    query += ' ORDER BY store_name ASC';

    const [stores] = await db.execute(query, params);
    res.json({ success: true, stores });
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get store by ID
 */
const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const [stores] = await db.execute('SELECT * FROM stores WHERE id = ?', [id]);
    
    if (stores.length === 0) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    
    res.json({ success: true, store: stores[0] });
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create new store (Super admin only)
 */
const createStore = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      store_code,
      store_name,
      address,
      city,
      state,
      pincode,
      contact_person,
      contact_phone,
      contact_email,
      area_manager_id,
      regional_manager_id,
      username,
      password
    } = req.body;

    if (!store_code || !store_name) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Store code and name are required' });
    }

    // Insert store
    const [result] = await connection.execute(
      `INSERT INTO stores (store_code, store_name, address, city, state, pincode, contact_person, contact_phone, contact_email, area_manager_id, regional_manager_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [store_code, store_name, address, city, state, pincode, contact_person, contact_phone, contact_email, area_manager_id, regional_manager_id]
    );

    const storeId = result.insertId;

    // If username and password provided, create a user for this store
    if (username && password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await connection.execute(
        `INSERT INTO users (username, password, role, store_id)
         VALUES (?, ?, 'store_manager', ?)`,
        [username, hashedPassword, storeId]
      );
    }

    await connection.commit();

    const [newStore] = await db.execute('SELECT * FROM stores WHERE id = ?', [storeId]);
    
    let user = null;
    if (username && password) {
      const [users] = await db.execute('SELECT id, username, role, store_id FROM users WHERE username = ?', [username]);
      user = users[0] || null;
    }

    res.json({ success: true, store: newStore[0], user });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating store:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Store code or username already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * Update store (Super admin only)
 */
const updateStore = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { username, password, ...storeUpdates } = req.body;
    
    const updates = [];
    const values = [];

    const allowedFields = [
      'store_code', 'store_name', 'address', 'city', 'state', 'pincode',
      'contact_person', 'contact_phone', 'contact_email', 'area_manager_id',
      'regional_manager_id', 'status'
    ];

    allowedFields.forEach(field => {
      if (storeUpdates[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(storeUpdates[field]);
      }
    });

    if (updates.length > 0) {
      values.push(id);
      await connection.execute(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Update user credentials if provided
    if (username || password) {
      const [store] = await connection.execute('SELECT * FROM stores WHERE id = ?', [id]);
      if (store.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, error: 'Store not found' });
      }

      const userUpdates = [];
      const userValues = [];

      if (username) {
        userUpdates.push('username = ?');
        userValues.push(username);
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        userUpdates.push('password = ?');
        userValues.push(hashedPassword);
      }

      if (userUpdates.length > 0) {
        userValues.push(store[0].store_code); // Use store_code as username to find user
        await connection.execute(
          `UPDATE users SET ${userUpdates.join(', ')} WHERE username = ?`,
          userValues
        );
      }
    }

    await connection.commit();

    const [updatedStore] = await db.execute('SELECT * FROM stores WHERE id = ?', [id]);
    res.json({ success: true, store: updatedStore[0] });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating store:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * Delete store (Super admin only)
 */
const deleteStore = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    
    // Check if store exists
    const [store] = await connection.execute('SELECT * FROM stores WHERE id = ?', [id]);
    if (store.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    // Check if store has any data
    const [creditNotes] = await connection.execute('SELECT COUNT(*) as count FROM credit_notes WHERE store_id = ?', [id]);
    if (creditNotes[0].count > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Cannot delete store with existing credit notes' });
    }

    // Delete associated user
    await connection.execute('DELETE FROM users WHERE store_id = ?', [id]);

    // Deactivate store
    await connection.execute('UPDATE stores SET status = "inactive" WHERE id = ?', [id]);

    await connection.commit();
    res.json({ success: true, message: 'Store deactivated and user deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting store:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * Get users for a store
 */
const getStoreUsers = async (req, res) => {
  try {
    const { storeId } = req.params;
    const [users] = await db.execute(
      'SELECT id, username, role, store_id, created_at FROM users WHERE store_id = ?',
      [storeId]
    );
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching store users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Assign user to store
 */
const assignUserToStore = async (req, res) => {
  try {
    const { userId, storeId } = req.body;

    if (!userId || !storeId) {
      return res.status(400).json({ success: false, error: 'User ID and Store ID are required' });
    }

    await db.execute('UPDATE users SET store_id = ? WHERE id = ?', [storeId, userId]);
    res.json({ success: true, message: 'User assigned to store successfully' });
  } catch (error) {
    console.error('Error assigning user to store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getAllStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
  getStoreUsers,
  assignUserToStore
};
