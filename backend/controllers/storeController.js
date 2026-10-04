// Store Controller
// Manages store CRUD operations and user assignments

const db = require('../config/database');

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
  try {
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
      regional_manager_id
    } = req.body;

    if (!store_code || !store_name) {
      return res.status(400).json({ success: false, error: 'Store code and name are required' });
    }

    const [result] = await db.execute(
      `INSERT INTO stores (store_code, store_name, address, city, state, pincode, contact_person, contact_phone, contact_email, area_manager_id, regional_manager_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [store_code, store_name, address, city, state, pincode, contact_person, contact_phone, contact_email, area_manager_id, regional_manager_id]
    );

    const [newStore] = await db.execute('SELECT * FROM stores WHERE id = ?', [result.insertId]);
    res.json({ success: true, store: newStore[0] });
  } catch (error) {
    console.error('Error creating store:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Store code already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update store (Super admin only)
 */
const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];

    const allowedFields = [
      'store_code', 'store_name', 'address', 'city', 'state', 'pincode',
      'contact_person', 'contact_phone', 'contact_email', 'area_manager_id',
      'regional_manager_id', 'status'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);
    await db.execute(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updatedStore] = await db.execute('SELECT * FROM stores WHERE id = ?', [id]);
    res.json({ success: true, store: updatedStore[0] });
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete store (Super admin only)
 */
const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if store has any data
    const [creditNotes] = await db.execute('SELECT COUNT(*) as count FROM credit_notes WHERE store_id = ?', [id]);
    if (creditNotes[0].count > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete store with existing credit notes' });
    }

    await db.execute('UPDATE stores SET status = "inactive" WHERE id = ?', [id]);
    res.json({ success: true, message: 'Store deactivated successfully' });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ success: false, error: error.message });
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
