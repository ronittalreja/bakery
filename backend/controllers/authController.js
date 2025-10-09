const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const router = express.Router();

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', { username });

    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = users[0];
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '365d' } // 1 year for persistent sessions
    );

    const response = {
      token,
      role: user.role
    };
    console.log('Login response:', response);
    res.json(response);
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { staffId, currentPassword, newPassword } = req.body;
    console.log('Password change requested for staff ID:', staffId);

    if (!staffId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Staff ID, current password and new password are required' });
    }

    // Get user details
    const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [staffId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedNewPassword, staffId]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// Routes
router.post('/login', login);
router.post('/change-password', changePassword);

module.exports = { router, login, changePassword };