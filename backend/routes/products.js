const express = require('express');
const router = express.Router();
const { getAllProducts, getMasterProducts, getProduct, createProduct, updateProduct, deleteProduct, getProductByItemCode, syncUnmappedProduct, syncAllUnmappedProducts } = require('../controllers/productsController');

router.get('/', getAllProducts);
router.get('/master', getMasterProducts);
router.get('/search/:itemCode', getProductByItemCode);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/sync-unmapped', syncUnmappedProduct);
router.post('/sync-all-unmapped', syncAllUnmappedProducts);

module.exports = router;
