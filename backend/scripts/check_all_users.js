const db = require('../config/database');

async function checkAllUsers() {
  try {
    console.log('=== ALL USERS IN DATABASE ===\n');

    const [users] = await db.execute(
      'SELECT id, username, store_id, role FROM users ORDER BY id'
    );
    console.table(users);

    const [stores] = await db.execute(
      'SELECT id, store_code, store_name, status FROM stores ORDER BY id'
    );
    console.log('\n=== ALL STORES ===\n');
    console.table(stores);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllUsers();
