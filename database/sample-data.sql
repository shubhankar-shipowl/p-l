-- Sample data for testing
USE profit_loss_db;

-- Sample orders
INSERT INTO orders (channel, order_date, product_name, product_amount, shipping_price, status) VALUES
('Amazon', '2024-01-15', 'Widget A', 29.99, 5.99, 'delivered'),
('Shopify', '2024-01-16', 'Widget B', 49.99, 7.99, 'shipped'),
('eBay', '2024-01-17', 'Widget C', 19.99, 4.99, 'delivered'),
('Amazon', '2024-01-18', 'Widget A', 29.99, 5.99, 'delivered'),
('Shopify', '2024-01-19', 'Widget B', 49.99, 7.99, 'delivered'),
('eBay', '2024-01-20', 'Widget C', 19.99, 4.99, 'pending');

-- Sample price list
INSERT INTO price_list (product_name, cost_price, selling_price) VALUES
('Widget A', 15.00, 29.99),
('Widget B', 25.00, 49.99),
('Widget C', 10.00, 19.99)
ON DUPLICATE KEY UPDATE
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price);

-- Sample shipping costs
INSERT INTO shipping_costs (region, weight_range, shipping_cost) VALUES
('US-East', '0-1kg', 5.99),
('US-West', '0-1kg', 7.99),
('International', '0-1kg', 15.99);

-- Sample marketing spend
INSERT INTO marketing_spend (spend_date, amount, channel, notes) VALUES
('2024-01-15', 100.00, 'Google Ads', 'Q1 Campaign'),
('2024-01-16', 150.00, 'Facebook Ads', 'Product Launch'),
('2024-01-17', 75.00, 'Amazon Ads', 'Promotion');

