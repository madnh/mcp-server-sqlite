-- Sample database schema and data for testing the SQLite MCP Server

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category_id INTEGER NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_available BOOLEAN DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert sample users
INSERT OR IGNORE INTO users (username, email, first_name, last_name) VALUES
    ('johndoe', 'john.doe@example.com', 'John', 'Doe'),
    ('janesmith', 'jane.smith@example.com', 'Jane', 'Smith'),
    ('bobwilson', 'bob.wilson@example.com', 'Bob', 'Wilson'),
    ('alicejohnson', 'alice.johnson@example.com', 'Alice', 'Johnson'),
    ('charliebrwn', 'charlie.brown@example.com', 'Charlie', 'Brown');

-- Insert sample categories
INSERT OR IGNORE INTO categories (name, description) VALUES
    ('Electronics', 'Electronic devices and accessories'),
    ('Books', 'Books and publications'),
    ('Clothing', 'Apparel and fashion items'),
    ('Home & Garden', 'Home improvement and garden supplies'),
    ('Sports', 'Sports equipment and accessories');

-- Insert subcategories
INSERT OR IGNORE INTO categories (name, description, parent_id) VALUES
    ('Smartphones', 'Mobile phones and accessories', 1),
    ('Laptops', 'Portable computers', 1),
    ('Fiction', 'Fiction books', 2),
    ('Non-Fiction', 'Non-fiction books', 2),
    ('Men''s Clothing', 'Clothing for men', 3),
    ('Women''s Clothing', 'Clothing for women', 3);

-- Insert sample products
INSERT OR IGNORE INTO products (name, description, price, category_id, stock_quantity) VALUES
    ('iPhone 15 Pro', 'Latest iPhone with advanced features', 1099.99, 6, 50),
    ('Samsung Galaxy S24', 'High-end Android smartphone', 899.99, 6, 30),
    ('MacBook Pro 16"', 'Professional laptop for creative work', 2399.99, 7, 15),
    ('Dell XPS 13', 'Compact and powerful ultrabook', 1299.99, 7, 25),
    ('The Great Gatsby', 'Classic American novel', 12.99, 8, 100),
    ('Sapiens', 'A Brief History of Humankind', 16.99, 9, 75),
    ('Men''s Cotton T-Shirt', 'Comfortable everyday wear', 19.99, 10, 200),
    ('Women''s Summer Dress', 'Lightweight dress for warm weather', 49.99, 11, 80),
    ('Garden Hose 50ft', 'Durable garden hose with nozzle', 39.99, 4, 40),
    ('Basketball', 'Official size basketball', 29.99, 5, 60);

-- Insert sample orders
INSERT OR IGNORE INTO orders (user_id, total_amount, status) VALUES
    (1, 1119.98, 'completed'),
    (2, 2399.99, 'pending'),
    (3, 29.98, 'completed'),
    (4, 66.98, 'shipped'),
    (5, 1299.99, 'processing');

-- Insert sample order items
INSERT OR IGNORE INTO order_items (order_id, product_id, quantity, price) VALUES
    (1, 1, 1, 1099.99),  -- John's iPhone
    (1, 7, 1, 19.99),    -- John's T-shirt
    (2, 3, 1, 2399.99),  -- Jane's MacBook
    (3, 10, 1, 29.99),   -- Bob's Basketball
    (4, 5, 1, 12.99),    -- Alice's book
    (4, 6, 1, 16.99),    -- Alice's other book
    (4, 9, 1, 39.99),    -- Alice's garden hose
    (5, 4, 1, 1299.99);  -- Charlie's Dell laptop

-- Create some useful indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Create a view for order summaries
CREATE VIEW IF NOT EXISTS order_summary AS
SELECT
    o.id as order_id,
    u.username,
    u.email,
    o.total_amount,
    o.status,
    o.created_at as order_date,
    COUNT(oi.id) as item_count
FROM orders o
JOIN users u ON o.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, u.username, u.email, o.total_amount, o.status, o.created_at;