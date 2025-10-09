// File: backend/routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password are required" });
    }
    const user = await User.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "365d" } // 1 year for persistent sessions
    );
    res.json({ success: true, token, role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

router.get("/validate", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    res.json({ success: true, id: decoded.id, username: decoded.username, role: decoded.role });
  } catch (err) {
    console.error("Token validation error:", err);
    res.status(401).json({ success: false, error: "Invalid token" });
  }
});

router.put("/staff/password", async (req, res) => {
  const { newPassword } = req.body;
  try {
    if (!newPassword) {
      return res.status(400).json({ success: false, error: "New password is required" });
    }
    await User.updatePassword("R3309", newPassword);
    res.json({ success: true, message: "Staff password updated" });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ success: false, error: "Failed to update password" });
  }
});

module.exports = router;