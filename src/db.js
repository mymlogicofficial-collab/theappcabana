const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => console.error('Unexpected error on idle client', err));

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        avatar_url TEXT,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(200) UNIQUE NOT NULL,
        description TEXT,
        price_cents INTEGER NOT NULL,
        file_path TEXT,
        cover_url TEXT,
        preview_url TEXT,
        download_count INTEGER DEFAULT 0,
        is_featured BOOLEAN DEFAULT false,
        is_approved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        amount_paid_cents INTEGER NOT NULL,
        stripe_payment_intent_id TEXT,
        downloaded BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id, user_id)
      )
    `);

    // Physical product tracking (Printful integration)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS physical_products (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        printful_product_id INTEGER,
        printful_category VARCHAR(100),
        selected_variants TEXT,
        design_file_url TEXT,
        sync_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id)
      )
    `);

    // Order tracking for physical products
    await pool.query(`
      CREATE TABLE IF NOT EXISTS physical_orders (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        printful_order_id INTEGER,
        order_status VARCHAR(50) DEFAULT 'pending',
        shipping_cost_cents INTEGER,
        tracking_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Migrations for existing tables
    try {
      await pool.query(`
        ALTER TABLE reviews ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE CASCADE
      `);
      console.log('Added product_id column to reviews table');
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.warn('Warning adding product_id to reviews:', err.message);
      }
    }

    try {
      await pool.query(`
        ALTER TABLE purchases ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE CASCADE
      `);
      console.log('Added product_id column to purchases table');
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.warn('Warning adding product_id to purchases:', err.message);
      }
    }

    // Add printful fields to products table if needed
    try {
      await pool.query(`
        ALTER TABLE products ADD COLUMN printful_category VARCHAR(100)
      `);
      console.log('Added printful_category to products table');
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.warn('Warning adding printful_category:', err.message);
      }
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database init error:', err.message);
    throw err;
  }
}

module.exports = { pool, initDatabase };

