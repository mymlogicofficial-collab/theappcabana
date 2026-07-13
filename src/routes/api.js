const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const router = express.Router();

router.post('/review/:product_id', async (req, res) => {
  const { rating, comment } = req.body;
  
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    await pool.query(`
      INSERT INTO reviews (product_id, user_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_id, user_id) 
      DO UPDATE SET rating = $3, comment = $4
    `, [req.params.product_id, req.session.user.id, rating, comment]);
    
    res.redirect(`/shop/product/${req.query.slug || ''}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

router.post('/download/:product_id', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  
  try {
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.product_id]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const p = product.rows[0];
    
    // Update download count
    await pool.query('UPDATE products SET download_count = download_count + 1 WHERE id = $1', [req.params.product_id]);
    
    // Stream the file
    const filePath = path.join(__dirname, '../public', p.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, `${p.slug}${path.extname(filePath)}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to download product' });
  }
});

router.post('/purchase/:product_id', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  
  try {
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.product_id]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const p = product.rows[0];
    
    // Check if user already purchased this product
    const existing = await pool.query(
      'SELECT id FROM purchases WHERE user_id = $1 AND product_id = $2',
      [req.session.user.id, req.params.product_id]
    );
    
    if (existing.rows.length > 0) {
      // Already purchased, allow direct download
      return res.redirect(`/api/download/${req.params.product_id}`);
    }
    
    // Create a purchase record (mark as not downloaded yet, no stripe_payment_intent_id for now)
    await pool.query(`
      INSERT INTO purchases (user_id, product_id, amount_paid_cents, stripe_payment_intent_id, downloaded)
      VALUES ($1, $2, $3, $4, false)
    `, [req.session.user.id, req.params.product_id, p.price_cents, null]);
    
    // Update download count
    await pool.query('UPDATE products SET download_count = download_count + 1 WHERE id = $1', [req.params.product_id]);
    
    // For now, trigger download immediately (TODO: integrate with Stripe)
    const filePath = path.join(__dirname, '../public', p.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, `${p.slug}${path.extname(filePath)}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to purchase product' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.display_name,
        COALESCE((SELECT AVG(rating) FROM reviews WHERE reviews.product_id = p.id), 0) as avg_rating
      FROM products p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.is_approved = true
      ORDER BY p.is_featured DESC, p.download_count DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

module.exports = router;

