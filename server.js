const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database initialization
const dbPath = path.join(__dirname, 'data', 'pos_system.db');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database');
});

// Initialize database schema
const initDB = () => {
  db.serialize(() => {
    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )`);

    // Suppliers table
    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Purchase Orders table
    db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL,
      order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_delivery DATETIME,
      status TEXT DEFAULT 'Pending',
      total_amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
    )`);

    // Purchase Order Items table
    db.run(`CREATE TABLE IF NOT EXISTS po_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY(po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    // Customers table
    db.run(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      loyalty_points INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'Bronze',
      total_purchases REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Sales transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      total_amount REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      final_amount REAL NOT NULL,
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    )`);

    // Transaction Items table
    db.run(`CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    // Inventory movements table
    db.run(`CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    // Expenses table
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'Cashier',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Notifications table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('Database tables initialized');
  });
};

initDB();

// Seed initial data
const seedData = () => {
  // Check if data exists
  db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
    if (row.count === 0) {
      const categories = ['Chicken', 'Eggs', 'Feed', 'Supplies', 'Equipment'];
      categories.forEach(cat => {
        db.run('INSERT INTO categories (name) VALUES (?)', [cat]);
      });

      const products = [
        { name: 'Broiler Chicken (1kg)', category: 1, sku: 'BR001', price: 320, cost: 180, stock: 50 },
        { name: 'Layer Chicken (1kg)', category: 1, sku: 'LY001', price: 350, cost: 200, stock: 45 },
        { name: 'Brown Eggs (1 dozen)', category: 2, sku: 'BE001', price: 85, cost: 45, stock: 150 },
        { name: 'White Eggs (1 dozen)', category: 2, sku: 'WE001', price: 75, cost: 40, stock: 120 },
        { name: 'Layer Pellets (25kg)', category: 3, sku: 'LP001', price: 680, cost: 520, stock: 30 },
        { name: 'Broiler Starter (25kg)', category: 3, sku: 'BS001', price: 750, cost: 580, stock: 25 },
        { name: 'Vitamin Supplement', category: 4, sku: 'VS001', price: 450, cost: 250, stock: 60 },
        { name: 'Feeding Trough', category: 5, sku: 'FT001', price: 1200, cost: 800, stock: 15 },
      ];

      products.forEach(p => {
        db.run('INSERT INTO products (name, category_id, sku, price, cost, stock) VALUES (?, ?, ?, ?, ?, ?)',
          [p.name, p.category, p.sku, p.price, p.cost, p.stock]);
      });

      const suppliers = [
        { name: 'Premium Feeds Inc', contact: 'Juan Santos', phone: '0917-123-4567', email: 'juan@premiumfeeds.com', address: 'Manila' },
        { name: 'Poultry World', contact: 'Maria Cruz', phone: '0918-234-5678', email: 'maria@poultryworld.com', address: 'Bulacan' },
        { name: 'Equipment Solutions', contact: 'Pedro Reyes', phone: '0919-345-6789', email: 'pedro@equipsol.com', address: 'Laguna' },
      ];

      suppliers.forEach(s => {
        db.run('INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
          [s.name, s.contact, s.phone, s.email, s.address]);
      });

      console.log('Initial data seeded');
    }
  });
};

seedData();

// ==================== API ENDPOINTS ====================

// DASHBOARD
app.get('/api/dashboard/stats', (req, res) => {
  const stats = {};
  
  Promise.all([
    new Promise((resolve) => {
      db.get('SELECT SUM(final_amount) as total_sales FROM transactions WHERE DATE(created_at) = DATE("now")', 
        (err, row) => resolve({ daily_sales: row?.total_sales || 0 }));
    }),
    new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM transactions WHERE DATE(created_at) = DATE("now")', 
        (err, row) => resolve({ transactions_today: row?.count || 0 }));
    }),
    new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM products WHERE stock < reorder_level', 
        (err, row) => resolve({ low_stock: row?.count || 0 }));
    }),
    new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM customers', 
        (err, row) => resolve({ total_customers: row?.count || 0 }));
    })
  ]).then(results => {
    results.forEach(r => Object.assign(stats, r));
    res.json(stats);
  });
});

app.get('/api/dashboard/weekly-sales', (req, res) => {
  db.all(`
    SELECT 
      strftime('%w', created_at) as day_num,
      strftime('%A', created_at) as day_name,
      SUM(final_amount) as total
    FROM transactions
    WHERE created_at >= datetime('now', '-6 days')
    GROUP BY DATE(created_at)
    ORDER BY created_at
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/dashboard/category-sales', (req, res) => {
  db.all(`
    SELECT 
      c.name,
      SUM(ti.subtotal) as total
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    LEFT JOIN transaction_items ti ON p.id = ti.product_id
    GROUP BY c.id, c.name
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/dashboard/recent-transactions', (req, res) => {
  db.all(`
    SELECT 
      t.id,
      t.transaction_id,
      t.final_amount,
      t.payment_method,
      t.created_at,
      COALESCE(c.name, 'Walk-in') as customer
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    ORDER BY t.created_at DESC
    LIMIT 10
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/dashboard/best-sellers', (req, res) => {
  db.all(`
    SELECT 
      p.name,
      SUM(ti.quantity) as total_sold,
      SUM(ti.subtotal) as revenue
    FROM products p
    LEFT JOIN transaction_items ti ON p.id = ti.product_id
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT 5
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

// PRODUCTS
app.get('/api/products', (req, res) => {
  const category = req.query.category;
  const query = category ? 
    `SELECT p.*, c.name as category_name FROM products p 
     JOIN categories c ON p.category_id = c.id 
     WHERE p.category_id = ? 
     ORDER BY p.name` :
    `SELECT p.*, c.name as category_name FROM products p 
     JOIN categories c ON p.category_id = c.id 
     ORDER BY p.name`;
  
  const params = category ? [category] : [];
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row || {});
  });
});

app.post('/api/products', (req, res) => {
  const { name, category_id, sku, price, cost, stock } = req.body;
  db.run(
    'INSERT INTO products (name, category_id, sku, price, cost, stock) VALUES (?, ?, ?, ?, ?, ?)',
    [name, category_id, sku, price, cost, stock],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID, name, category_id, sku, price, cost, stock });
    }
  );
});

app.put('/api/products/:id', (req, res) => {
  const { name, category_id, sku, price, cost, stock } = req.body;
  db.run(
    'UPDATE products SET name = ?, category_id = ?, sku = ?, price = ?, cost = ?, stock = ? WHERE id = ?',
    [name, category_id, sku, price, cost, stock, req.params.id],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: req.params.id, name, category_id, sku, price, cost, stock });
    }
  );
});

app.delete('/api/products/:id', (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], (err) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
  });
});

// CATEGORIES
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

// TRANSACTIONS (POS)
app.post('/api/transactions', (req, res) => {
  const { customer_id, items, total_amount, discount_amount, final_amount, payment_method } = req.body;
  const transaction_id = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  db.run(
    'INSERT INTO transactions (transaction_id, customer_id, total_amount, discount_amount, final_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?)',
    [transaction_id, customer_id, total_amount, discount_amount, final_amount, payment_method],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Insert transaction items and update stock
      let completed = 0;
      items.forEach(item => {
        db.run(
          'INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
          [transaction_id, item.product_id, item.quantity, item.unit_price, item.subtotal],
          (err) => {
            if (!err) {
              db.run(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.product_id]
              );
              db.run(
                'INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id) VALUES (?, ?, ?, ?, ?)',
                [item.product_id, 'Sale', -item.quantity, 'Transaction', transaction_id]
              );
            }
            completed++;
            if (completed === items.length) {
              res.json({ transaction_id, success: true });
            }
          }
        );
      });
    }
  );
});

app.get('/api/transactions', (req, res) => {
  db.all(`
    SELECT 
      t.*,
      COALESCE(c.name, 'Walk-in') as customer
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    ORDER BY t.created_at DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/transactions/:transaction_id', (req, res) => {
  db.all(
    'SELECT * FROM transaction_items WHERE transaction_id = ?',
    [req.params.transaction_id],
    (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows || []);
    }
  );
});

// INVENTORY
app.get('/api/inventory', (req, res) => {
  db.all(`
    SELECT 
      p.*,
      c.name as category_name,
      CASE 
        WHEN p.stock <= p.reorder_level THEN 'Low Stock'
        WHEN p.stock = 0 THEN 'Out of Stock'
        ELSE 'In Stock'
      END as status
    FROM products p
    JOIN categories c ON p.category_id = c.id
    ORDER BY p.name
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.post('/api/inventory/stock-in', (req, res) => {
  const { product_id, quantity, reference_type, reference_id, notes } = req.body;
  
  db.run(
    'UPDATE products SET stock = stock + ? WHERE id = ?',
    [quantity, product_id],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.run(
        'INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [product_id, 'Stock-In', quantity, reference_type, reference_id, notes],
        (err) => {
          if (err) res.status(500).json({ error: err.message });
          else res.json({ success: true });
        }
      );
    }
  );
});

app.get('/api/inventory/movements/:product_id', (req, res) => {
  db.all(
    'SELECT * FROM inventory_movements WHERE product_id = ? ORDER BY created_at DESC',
    [req.params.product_id],
    (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows || []);
    }
  );
});

// SUPPLIERS
app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY name', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.post('/api/suppliers', (req, res) => {
  const { name, contact_person, phone, email, address } = req.body;
  db.run(
    'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
    [name, contact_person, phone, email, address],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID, name, contact_person, phone, email, address });
    }
  );
});

app.put('/api/suppliers/:id', (req, res) => {
  const { name, contact_person, phone, email, address } = req.body;
  db.run(
    'UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ? WHERE id = ?',
    [name, contact_person, phone, email, address, req.params.id],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true });
    }
  );
});

// PURCHASE ORDERS
app.get('/api/purchase-orders', (req, res) => {
  db.all(`
    SELECT 
      po.*,
      s.name as supplier_name
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    ORDER BY po.order_date DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.post('/api/purchase-orders', (req, res) => {
  const { supplier_id, expected_delivery, items } = req.body;
  const po_number = 'PO-' + moment().format('YYYYMMDD') + '-' + Math.random().toString(36).substr(2, 5);
  const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  
  db.run(
    'INSERT INTO purchase_orders (po_number, supplier_id, expected_delivery, total_amount, status) VALUES (?, ?, ?, ?, ?)',
    [po_number, supplier_id, expected_delivery, total_amount, 'Pending'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const po_id = this.lastID;
      let completed = 0;
      
      items.forEach(item => {
        db.run(
          'INSERT INTO po_items (po_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          [po_id, item.product_id, item.quantity, item.unit_price],
          () => {
            completed++;
            if (completed === items.length) {
              res.json({ po_number, success: true });
            }
          }
        );
      });
    }
  );
});

app.put('/api/purchase-orders/:id/status', (req, res) => {
  const { status } = req.body;
  db.run(
    'UPDATE purchase_orders SET status = ? WHERE id = ?',
    [status, req.params.id],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true });
    }
  );
});

// CUSTOMERS
app.get('/api/customers', (req, res) => {
  db.all('SELECT * FROM customers ORDER BY name', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.post('/api/customers', (req, res) => {
  const { name, phone, email } = req.body;
  db.run(
    'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
    [name, phone, email],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID, name, phone, email, loyalty_points: 0, tier: 'Bronze' });
    }
  );
});

// EXPENSES
app.get('/api/expenses', (req, res) => {
  db.all('SELECT * FROM expenses ORDER BY created_at DESC', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.post('/api/expenses', (req, res) => {
  const { category, amount, description } = req.body;
  db.run(
    'INSERT INTO expenses (category, amount, description) VALUES (?, ?, ?)',
    [category, amount, description],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID, category, amount, description });
    }
  );
});

// NOTIFICATIONS
app.get('/api/notifications', (req, res) => {
  db.all('SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

// REPORTS
app.get('/api/reports/sales-trend', (req, res) => {
  db.all(`
    SELECT 
      DATE(created_at) as date,
      SUM(final_amount) as total_sales,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/reports/inventory-value', (req, res) => {
  db.all(`
    SELECT 
      c.name as category,
      SUM(p.stock * p.cost) as total_value,
      SUM(p.stock) as total_items
    FROM products p
    JOIN categories c ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY total_value DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/reports/financial-summary', (req, res) => {
  Promise.all([
    new Promise((resolve) => {
      db.get('SELECT SUM(final_amount) as total_sales FROM transactions', (err, row) => 
        resolve({ total_sales: row?.total_sales || 0 }));
    }),
    new Promise((resolve) => {
      db.get(`SELECT SUM(p.stock * p.cost) as total_inventory FROM products p`, (err, row) => 
        resolve({ total_inventory_value: row?.total_inventory || 0 }));
    }),
    new Promise((resolve) => {
      db.get('SELECT SUM(amount) as total_expenses FROM expenses', (err, row) => 
        resolve({ total_expenses: row?.total_expenses || 0 }));
    })
  ]).then(results => {
    const summary = {};
    results.forEach(r => Object.assign(summary, r));
    summary.net_profit = (summary.total_sales || 0) - (summary.total_expenses || 0);
    res.json(summary);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Chicken & Egg POS System running on http://localhost:${PORT}`);
});
