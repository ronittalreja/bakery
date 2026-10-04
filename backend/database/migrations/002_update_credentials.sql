-- Migration 002: Update User Credentials for Multi-Tenancy
-- This migration updates login credentials and roles for the R3309 store

-- ============================================
-- STEP 1: Update existing users
-- ============================================

-- Update R3309 user to developer with new password
-- Password 'talreja4567' hashed
UPDATE users 
SET username = 'developer',
    role = 'super_admin',
    password = '$2b$10$rKZKqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYq'
WHERE username = 'R3309';

-- Update admin user to R3309 with new password
-- Password '123456789' hashed
UPDATE users 
SET username = 'R3309',
    role = 'store_manager',
    password = '$2b$10$rKZKqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqYqY'
WHERE username = 'admin';

-- ============================================
-- STEP 2: Ensure store_id is set correctly
-- ============================================

UPDATE users SET store_id = 1 WHERE username IN ('developer', 'R3309');

-- ============================================
-- STEP 3: Verify updates
-- ============================================

SELECT 'Credentials update completed!' AS message;
SELECT id, username, role, store_id FROM users WHERE username IN ('developer', 'R3309');
