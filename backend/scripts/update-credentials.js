// Script to update user credentials for multi-tenancy
const bcrypt = require('bcrypt');
const db = require('../config/database');

async function updateCredentials() {
  try {
    console.log('Starting credential update...');

    // First, check what users exist
    const [existingUsers] = await db.execute(
      `SELECT id, username, role, store_id FROM users`
    );

    console.log('Existing users:');
    console.table(existingUsers);

    // First, check if store_id column exists
    const [columns] = await db.execute(
      `SHOW COLUMNS FROM users LIKE 'store_id'`
    );

    if (columns.length === 0) {
      console.log('store_id column does not exist. Adding it...');
      await db.execute(
        `ALTER TABLE users 
         ADD COLUMN store_id INT NULL AFTER id,
         ADD INDEX idx_store_id (store_id)`
      );
      console.log('store_id column added');
    }

    // First, check if role column needs to be updated
    const [roleColumns] = await db.execute(
      `SHOW COLUMNS FROM users LIKE 'role'`
    );

    console.log('Current role column:', roleColumns[0]);

    // Update role column to support new roles if needed
    if (roleColumns[0].Type !== "enum('store_manager','area_manager','regional_manager','super_admin')") {
      console.log('Updating role column to support new roles...');
      
      // First, alter column to include both old and new values
      await db.execute(
        `ALTER TABLE users 
         MODIFY COLUMN role ENUM('staff','admin','store_manager','area_manager','regional_manager','super_admin') 
         DEFAULT 'store_manager'`
      );
      console.log('Role column expanded to include new roles');

      console.log('Updating existing users to compatible roles...');
      // Update existing users to have new role values
      await db.execute(
        `UPDATE users SET role = 'store_manager' WHERE role IN ('staff', 'admin')`
      );
      console.log('Existing users updated to store_manager');

      // Now remove old role values
      await db.execute(
        `ALTER TABLE users 
         MODIFY COLUMN role ENUM('store_manager','area_manager','regional_manager','super_admin') 
         DEFAULT 'store_manager'`
      );
      console.log('Old role values removed from column');
    }

    // Hash passwords
    const developerPassword = await bcrypt.hash('talreja4567', 10);
    const r3309Password = await bcrypt.hash('123456789', 10);

    console.log('Passwords hashed successfully');

    // Check if developer user already exists
    const developerExists = existingUsers.find(u => u.username === 'developer');
    const r3309Exists = existingUsers.find(u => u.username === 'R3309');
    const adminExists = existingUsers.find(u => u.username === 'admin');
    const oldR3309Exists = existingUsers.find(u => u.username === 'R3309');

    // Handle developer user
    if (developerExists) {
      console.log('Developer user already exists, updating...');
      await db.execute(
        `UPDATE users 
         SET role = 'super_admin', 
             password = ?,
             store_id = 1
         WHERE username = 'developer'`,
        [developerPassword]
      );
      console.log('Developer user updated');
    } else if (oldR3309Exists) {
      console.log('Updating R3309 to developer...');
      await db.execute(
        `UPDATE users 
         SET username = 'developer', 
             role = 'super_admin', 
             password = ?,
             store_id = 1
         WHERE username = 'R3309'`,
        [developerPassword]
      );
      console.log('R3309 updated to developer');
    }

    // Handle R3309 user
    if (r3309Exists) {
      console.log('R3309 user already exists, updating...');
      await db.execute(
        `UPDATE users 
         SET role = 'store_manager', 
             password = ?,
             store_id = 1
         WHERE username = 'R3309'`,
        [r3309Password]
      );
      console.log('R3309 user updated');
    } else if (adminExists) {
      console.log('Updating admin to R3309...');
      await db.execute(
        `UPDATE users 
         SET username = 'R3309', 
             role = 'store_manager', 
             password = ?,
             store_id = 1
         WHERE username = 'admin'`,
        [r3309Password]
      );
      console.log('Admin updated to R3309');
    }

    console.log('Credential update completed successfully!');

    // Verify updates
    const [users] = await db.execute(
      `SELECT id, username, role, store_id FROM users WHERE username IN ('developer', 'R3309')`
    );

    console.log('Final user state:');
    console.table(users);

    process.exit(0);
  } catch (error) {
    console.error('Error updating credentials:', error);
    process.exit(1);
  }
}

updateCredentials();
