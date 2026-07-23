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
        preview_url TEXT,
        cover_url TEXT,
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
        created_at TIMESTAMP DEFAULT NOW()
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

    // Merch requests from customers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS merch_requests (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        product_title VARCHAR(255),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        category VARCHAR(50) NOT NULL,
        variant VARCHAR(100) NOT NULL,
        image_url TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Donations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS donations (
        id SERIAL PRIMARY KEY,
        cause VARCHAR(50) NOT NULL,
        amount_cents INTEGER NOT NULL,
        donor_name VARCHAR(200),
        donor_email VARCHAR(255),
        is_anonymous BOOLEAN DEFAULT false,
        stripe_payment_intent_id TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
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

    // Ensure purchases table has product_id column
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

    // Add amount_paid_cents to purchases table if needed
    try {
      await pool.query(`
        ALTER TABLE purchases ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0
      `);
      console.log('Added amount_paid_cents column to purchases table');
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.warn('Warning adding amount_paid_cents to purchases:', err.message);
      }
    }

    // Add printful_category to products table if needed
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

    // Add image_url and product_title to merch_requests if needed
    try {
      await pool.query(`
        ALTER TABLE merch_requests ADD COLUMN image_url TEXT
      `);
      console.log('Added image_url to merch_requests');
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.warn('Warning adding image_url:', err.message);
      }
    }

    try {
      await pool.query(`
        ALTER TABLE merch_requests ADD COLUMN product_title VARCHAR(255)
      `);
      console.log('Added product_title to merch_requests');
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.warn('Warning adding product_title:', err.message);
      }
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database init error:', err.message);
  }
}

module.exports = { pool, initDatabase };
