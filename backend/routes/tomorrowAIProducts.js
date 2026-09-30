// Tomorrow AI Product Management Routes
// API endpoints for ML group mapping and product classification

const express = require('express');
const router = express.Router();
const {
  getProducts,
  updateProductMLGroup,
  updateProductItemType,
  getProductAliases,
  addProductAlias,
  deleteProductAlias,
  getMLGroupSummary,
  getValidationReport,
  approveProduct,
  markNotForUse,
  addAliasAndApprove
} = require('../controllers/tomorrowAIProductController');

// Get all products with ML group info
// GET /api/tomorrow-ai/products
router.get('/', getProducts);

// Update product ML group ID
// PUT /api/tomorrow-ai/products/ml-group
router.put('/ml-group', updateProductMLGroup);

// Update product item type
// PUT /api/tomorrow-ai/products/item-type
router.put('/item-type', updateProductItemType);

// Get product aliases
// GET /api/tomorrow-ai/products/:productId/aliases
router.get('/:productId/aliases', getProductAliases);

// Add product alias
// POST /api/tomorrow-ai/products/aliases
router.post('/aliases', addProductAlias);

// Delete product alias
// DELETE /api/tomorrow-ai/products/aliases/:aliasId
router.delete('/aliases/:aliasId', deleteProductAlias);

// Get ML group summary (products sharing same ML group)
// GET /api/tomorrow-ai/products/ml-group-summary
router.get('/ml-group-summary', getMLGroupSummary);

// Get validation report (unmapped items, conflicts, ML stats)
// GET /api/tomorrow-ai/products/validation-report
router.get('/validation-report', getValidationReport);

// Approve product mapping
// POST /api/tomorrow-ai/products/approve
router.post('/approve', approveProduct);

// Mark product as not for use
// POST /api/tomorrow-ai/products/notforuse
router.post('/notforuse', markNotForUse);

// Add alias and approve both products
// POST /api/tomorrow-ai/products/alias-approve
router.post('/alias-approve', addAliasAndApprove);

module.exports = router;
