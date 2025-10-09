const express = require('express');
const router = express.Router();
const { getAllDecorations, getDecoration, createDecoration, updateDecoration, deleteDecoration, getDecorationBySkuOrName } = require('../controllers/decorationsController');

router.get('/', getAllDecorations);
router.get('/search/:identifier', getDecorationBySkuOrName);
router.get('/:id', getDecoration);
router.post('/', createDecoration);
router.put('/:id', updateDecoration);
router.delete('/:id', deleteDecoration);

module.exports = router;