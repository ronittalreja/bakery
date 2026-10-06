const db = require('../config/database');
const bcrypt = require('bcrypt');

async function createR3310() {
  try {
    console.log('=== CREATING R3310 STORE AND USER ===\n');

    // Create R3310 store
    const [storeResult] = await db.execute(
      `INSERT INTO stores (store_code, store_name, status) VALUES (?, ?, ?)`,
      ['R3310', 'R3310 Bakery', 'active']
    );
    const storeId = storeResult.insertId;
    console.log('✓ Created R3310 store with ID:', storeId);

    // Hash password for R3310
    const hashedPassword = await bcrypt.hash('R3310', 10);

    // Create R3310 user
    const [userResult] = await db.execute(
      `INSERT INTO users (username, password, store_id, role) VALUES (?, ?, ?, ?)`,
      ['R3310', hashedPassword, storeId, 'store_manager']
    );
    console.log('✓ Created R3310 user with ID:', userResult.insertId);

    // Verify
    const [users] = await db.execute('SELECT id, username, store_id, role FROM users ORDER BY id');
    console.log('\n=== ALL USERS AFTER CREATION ===\n');
    console.table(users);

    const [stores] = await db.execute('SELECT id, store_code, store_name, status FROM stores ORDER BY id');
    console.log('\n=== ALL STORES AFTER CREATION ===\n');
    console.table(stores);

    console.log('\n✅ R3310 store and user created successfully!');
    console.log('Login credentials: username=R3310, password=R3310');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createR3310();
