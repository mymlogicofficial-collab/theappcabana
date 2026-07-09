const express = require('express');
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
    
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.display_name,
        COALESCE((SELECT AVG(rating) FROM reviews WHERE product_id = p.id), 0) as avg_rating
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
