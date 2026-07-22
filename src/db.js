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

    // MAKE YOUR ACCOUNT ADMIN
    try {
      await pool.query(`
        UPDATE users SET is_admin = true WHERE email = 'eubankssterling6@gmail.com'
      `);
      console.log('[Setup] Made eubankssterling6@gmail.com an admin');
    } catch (err) {
      console.warn('Note: Admin user setup might have already run:', err.message);
    }

    // AUTO SEED DATA - Only runs if database is empty
    await seedTestData();

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database init error:', err.message);
  }
}

async function seedTestData() {
  try {
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    
    // Only seed if database is empty
    if (parseInt(userCount.rows[0].count) > 1) {
      console.log('[Seed] Database already has data, skipping seed');
      return;
    }

    console.log('[Seed] Populating test data...');

    // Create test users
    await pool.query(`
      INSERT INTO users (username, email, password_hash, display_name, is_admin, created_at)
      VALUES 
        ('dj_beats', 'dj@theappcabana.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'DJ Beats', false, NOW()),
        ('pixel_artist', 'pixel@theappcabana.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'Pixel Artist', false, NOW()),
        ('dev_studio', 'dev@theappcabana.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'Dev Studio', false, NOW()),
        ('ambient_sounds', 'ambient@theappcabana.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'Ambient Sounds', false, NOW())
      ON CONFLICT(email) DO NOTHING
    `);

    // Create products
    await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, preview_url, download_count, is_featured, is_approved, created_at)
      SELECT 
        (SELECT id FROM users WHERE email = 'dj@theappcabana.com'), 'music', 
        'Midnight Vibes - Lo-Fi Hip Hop', 'midnight-vibes-lofi-hiphop', 
        'Chill lo-fi hip hop beat perfect for studying or relaxing.', 
        99, '/uploads/midnight-vibes.mp3', '/uploads/midnight-vibes-cover.jpg', 
        '/uploads/preview-midnight-vibes.mp3', 127, true, true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'midnight-vibes-lofi-hiphop')
    `);

    await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, preview_url, download_count, is_featured, is_approved, created_at)
      SELECT 
        (SELECT id FROM users WHERE email = 'dj@theappcabana.com'), 'music', 
        'Neon Dreams - Synthwave', 'neon-dreams-synthwave', 
        'A synthwave masterpiece with 80s aesthetic and modern production.', 
        99, '/uploads/neon-dreams.mp3', '/uploads/neon-dreams-cover.jpg', 
        '/uploads/preview-neon-dreams.mp3', 89, true, true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'neon-dreams-synthwave')
    `);

    await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, preview_url, download_count, is_featured, is_approved, created_at)
      SELECT 
        (SELECT id FROM users WHERE email = 'ambient@theappcabana.com'), 'music', 
        'Forest Meditation - Ambient', 'forest-meditation-ambient', 
        'Peaceful ambient soundscape featuring natural forest sounds and gentle piano.', 
        99, '/uploads/forest-meditation.mp3', '/uploads/forest-meditation-cover.jpg', 
        '/uploads/preview-forest-meditation.mp3', 243, true, true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'forest-meditation-ambient')
    `);

    await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, download_count, is_featured, is_approved, created_at)
      SELECT 
        (SELECT id FROM users WHERE email = 'pixel@theappcabana.com'), 'art', 
        'Retro Pixel Art Bundle - 16 Assets', 'retro-pixel-art-bundle-16-assets', 
        'Complete set of retro pixel art assets for indie games and projects.', 
        1499, '/uploads/pixel-art-bundle.zip', '/uploads/pixel-art-thumb.jpg', 45, true, true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'retro-pixel-art-bundle-16-assets')
    `);

    await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, download_count, is_featured, is_approved, created_at)
      SELECT 
        (SELECT id FROM users WHERE email = 'pixel@theappcabana.com'), 'art', 
        'Abstract Watercolor Textures - 20 PNGs', 'abstract-watercolor-textures-20', 
        'High-resolution watercolor texture pack with 20 unique abstract backgrounds.', 
        899, '/uploads/watercolor-textures.zip', '/uploads/watercolor-thumb.jpg', 67, false, true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'abstract-watercolor-textures-20')
    `);

    await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, download_count, is_featured, is_approved, created_at)
      SELECT 
        (SELECT id FROM users WHERE email = 'pixel@theappcabana.com'), 'art', 
        'Cyberpunk UI Kit - Figma File', 'cyberpunk-ui-kit-figma', 
        'Complete UI kit with 150+ components. Fully editable in Figma.', 
        2499, '/uploads/cyberpunk-ui-kit.fig', '/uploads/cyberpunk-ui-thumb.jpg', 34, true, true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'cyberpunk-ui-kit-figma')
    `);

    await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, download_count, is_featured, is_approved, created_at)
      SELECT 
        (SELECT id FROM users WHERE email = 'dev@theappcabana.com'), 'app', 
        'Budget Tracker Pro - Windows', 'budget-tracker-pro-windows', 
        'Lightweight desktop app for managing your personal budget.', 
        1999, '/uploads/budget-tracker-pro.exe', '/uploads/budget-tracker-thumb.jpg', 156, true, true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'budget-tracker-pro-windows')
    `);

    await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, download_count, is_featured, is_approved, created_at)
      SELECT 
        (SELECT id FROM users WHERE email = 'dev@theappcabana.com'), 'app', 
        'Pomodoro Timer - Multi-Platform', 'pomodoro-timer-multi-platform', 
        'Simple and elegant Pomodoro timer for Windows, Mac, and Linux.', 
        99, '/uploads/pomodoro-timer.zip', '/uploads/pomodoro-thumb.jpg', 298, true, true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'pomodoro-timer-multi-platform')
    `);

    // Add reviews
    await pool.query(`
      INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
      SELECT p.id, 2, 5, 'Amazing lo-fi beats! Perfect for studying.', NOW() - interval '30 days'
      FROM products p WHERE p.slug = 'midnight-vibes-lofi-hiphop' 
      AND NOT EXISTS (SELECT 1 FROM reviews WHERE product_id = p.id AND user_id = 2)
    `);

    await pool.query(`
      INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
      SELECT p.id, 3, 5, 'Great quality, exactly what I was looking for!', NOW() - interval '25 days'
      FROM products p WHERE p.slug = 'midnight-vibes-lofi-hiphop'
      AND NOT EXISTS (SELECT 1 FROM reviews WHERE product_id = p.id AND user_id = 3)
    `);

    await pool.query(`
      INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
      SELECT p.id, 2, 5, 'Love this app! Makes budgeting so easy.', NOW() - interval '3 days'
      FROM products p WHERE p.slug = 'budget-tracker-pro-windows'
      AND NOT EXISTS (SELECT 1 FROM reviews WHERE product_id = p.id AND user_id = 2)
    `);

    await pool.query(`
      INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
      SELECT p.id, 3, 5, 'Pomodoro timer works perfectly!', NOW() - interval '2 days'
      FROM products p WHERE p.slug = 'pomodoro-timer-multi-platform'
      AND NOT EXISTS (SELECT 1 FROM reviews WHERE product_id = p.id AND user_id = 3)
    `);

    console.log('[Seed] Test data populated successfully!');
  } catch (err) {
    console.warn('[Seed] Seed data error (this is ok if data already exists):', err.message);
  }
}

module.exports = { pool, initDatabase };

