-- Create database
CREATE DATABASE IF NOT EXISTS profit_loss_db;
USE profit_loss_db;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel VARCHAR(100),
    order_date DATE NOT NULL,
    fulfilled_by VARCHAR(100),
    delivered_date DATE,
    product_name VARCHAR(255),
    order_amount DECIMAL(10, 2),
    pickup_warehouse VARCHAR(255),
    order_account VARCHAR(255),
    waybill_number VARCHAR(255),
    product_value DECIMAL(10, 2),
    mode VARCHAR(100),
    status ENUM('pending', 'shipped', 'delivered', 'cancelled') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_date (order_date),
    INDEX idx_status (status)
);

-- Price list table
CREATE TABLE IF NOT EXISTS price_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) UNIQUE,
    cost_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping costs table
CREATE TABLE IF NOT EXISTS shipping_costs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    region VARCHAR(100),
    weight_range VARCHAR(50),
    shipping_cost DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketing spend table
CREATE TABLE IF NOT EXISTS marketing_spend (
    id INT AUTO_INCREMENT PRIMARY KEY,
    spend_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    channel VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_spend_date (spend_date)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    emailVerified DATETIME,
    password VARCHAR(255) NOT NULL,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);

-- NextAuth sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sessionToken VARCHAR(255) UNIQUE NOT NULL,
    userId INT NOT NULL,
    expires DATETIME NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessionToken (sessionToken),
    INDEX idx_userId (userId)
);

-- NextAuth accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    providerAccountId VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INT,
    token_type VARCHAR(255),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY provider_providerAccountId (provider, providerAccountId),
    INDEX idx_userId (userId)
);

-- NextAuth verification tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires DATETIME NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Price entries table (Price & HSN Management)
CREATE TABLE IF NOT EXISTS price_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    price_before_gst DECIMAL(10, 2) DEFAULT 0,
    gst_rate DECIMAL(5, 2) DEFAULT 0.00,
    price_after_gst DECIMAL(10, 2) DEFAULT 0,
    hsn_code VARCHAR(50) DEFAULT '',
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    INDEX idx_supplier_id (supplier_id),
    INDEX idx_product_name (product_name),
    INDEX idx_effective_from (effective_from),
    INDEX idx_effective_to (effective_to)
);

