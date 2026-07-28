const Expense = require('../models/Expense');
const { getDemoData } = require('../middleware/demoMode');
const db = require('../config/database');

const getExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Return demo data if demo user
    if (req.isDemo) {
      const demoExpenses = getDemoData('expenses');
      return res.json({ success: true, expenses: demoExpenses });
    }
    
    const expenses = await Expense.findAll(month, year);
    
    // Automatically add RETURN LOSS expense from credit notes for the month
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const [creditNotesData] = await db.execute(`
      SELECT COALESCE(SUM(loss_amount), 0) as totalLoss
      FROM credit_notes
      WHERE DATE_FORMAT(date, '%Y-%m') = ?
    `, [monthStr]);
    
    const returnLossAmount = Number(creditNotesData[0].totalLoss);
    
    if (returnLossAmount > 0) {
      // Check if RETURN LOSS expense already exists for this month
      const existingReturnLoss = expenses.find(
        e => e.description === 'RETURN LOSS' && 
        e.expense_date && e.expense_date.startsWith(monthStr)
      );
      
      if (!existingReturnLoss) {
        // Add automated RETURN LOSS expense
        expenses.push({
          id: 'auto-return-loss',
          expense_date: `${monthStr}-01`,
          category: 'Returns',
          description: 'RETURN LOSS',
          amount: returnLossAmount,
          is_auto: true
        });
      }
    }
    
    res.json({ success: true, expenses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    const { expenseDate, category, description, amount } = req.body;
    const staffId = req.user.id;
    
    const expense = await Expense.create({
      expenseDate, category, description, amount, staffId
    });
    
    res.json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { expenseDate, category, description, amount } = req.body;
    
    const expense = await Expense.update(id, {
      expenseDate, category, description, amount
    });
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await Expense.delete(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getExpenseSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const summary = await Expense.getSummary(month, year);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary
};