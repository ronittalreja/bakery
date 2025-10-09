// File: backend/config/database.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'pass123',
  database: process.env.DB_NAME || 'monginis_db',
  connectionLimit: 10
});

module.exports = pool;