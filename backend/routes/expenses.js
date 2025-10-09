const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary } = require('../controllers/expensesController');

router.get('/', getExpenses); // ?month&year
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);
router.get('/summary', getExpenseSummary); // ?month&year

module.exports = router;