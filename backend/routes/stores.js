// Store Routes
const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { requireRole } = require('../middleware/storeAccess');

// Get all stores (filtered by user role)
router.get('/', storeController.getAllStores);

// Get store by ID
router.get('/:id', storeController.getStoreById);

// Create new store (Super admin only)
router.post('/', storeController.createStore);

// Update store (Super admin only)
router.put('/:id', storeController.updateStore);

// Delete store (Super admin only)
router.delete('/:id', storeController.deleteStore);

// Get users for a store
router.get('/:storeId/users', storeController.getStoreUsers);

// Assign user to store
router.post('/assign-user', storeController.assignUserToStore);

module.exports = router;
