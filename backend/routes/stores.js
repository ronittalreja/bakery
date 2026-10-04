// Store Routes
const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/storeAccess');

// Get all stores (filtered by user role)
router.get('/', auth, storeController.getAllStores);

// Get store by ID
router.get('/:id', auth, storeController.getStoreById);

// Create new store (Super admin only)
router.post('/', auth, requireRole('super_admin'), storeController.createStore);

// Update store (Super admin only)
router.put('/:id', auth, requireRole('super_admin'), storeController.updateStore);

// Delete store (Super admin only)
router.delete('/:id', auth, requireRole('super_admin'), storeController.deleteStore);

// Get users for a store
router.get('/:storeId/users', auth, storeController.getStoreUsers);

// Assign user to store (Super admin only)
router.post('/assign-user', auth, requireRole('super_admin'), storeController.assignUserToStore);

module.exports = router;
