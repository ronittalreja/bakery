const express = require('express');
const router = express.Router();
const { getAllProducts, getProduct, createProduct, updateProduct, deleteProduct, getProductByItemCode } = require('../controllers/productsController');

router.get('/', getAllProducts);
router.get('/search/:itemCode', getProductByItemCode);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
