// Setup Tomorrow AI Database Tables
// This script creates the separate Tomorrow AI tables without modifying existing tables

const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function setupTomorrowAI() {
  try {
    console.log('Starting Tomorrow AI database setup...');
    
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '../database/tomorrow_ai_schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.execute(statement);
        console.log('Executed:', statement.substring(0, 50) + '...');
      }
    }
    
    console.log('✓ Tomorrow AI database tables created successfully');
    console.log('Tables created:');
    console.log('  - tomorrow_ai_product_master');
    console.log('  - tomorrow_ai_product_aliases');
    console.log('  - tomorrow_ai_events');
    console.log('  - tomorrow_ai_daily_sales');
    console.log('  - tomorrow_ai_predictions');
    console.log('  - tomorrow_ai_sync_log');
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting up Tomorrow AI database:', error);
    process.exit(1);
  }
}

setupTomorrowAI();
