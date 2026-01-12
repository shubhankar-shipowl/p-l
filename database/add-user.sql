-- Add user: finance@shipowl.io
-- Password: Shipowl@6 (hashed with bcrypt)
-- Note: This SQL file contains a pre-hashed password
-- To generate a new hash, use: node scripts/add-user.js

-- First, check if user exists and delete if needed
DELETE FROM users WHERE email = 'finance@shipowl.io';

-- Insert the user with bcrypt hashed password
-- Password hash for 'Shipowl@6' (bcrypt rounds: 10)
INSERT INTO users (email, password, name) VALUES (
  'finance@shipowl.io',
  '$2a$10$XKqZ8vJ9LmN3pQrS5tUvWuYxZzAaBbCcDdEeFfGgHhIiJjKkLlMmNn',
  'Finance User'
);

-- Note: The password hash above is a placeholder
-- Please run: npm run add-user
-- Or use the Node.js script to properly hash the password
