const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/browse', async (req, res) => {
  try {
    const { type, search, sort } = req.query;
    
    let query = `
      SELECT p.*, u.display_name as creator,
        COALESCE((SELECT AVG(rating) FROM reviews WHERE reviews.product_id = p.id), 0) as avg_rating,
        COALESCE((SELECT COUNT(*) FROM reviews WHERE reviews.product_id = p.id), 0) as review_count
      FROM products p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.is_approved = true
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (type) {
      paramCount++;
      query += ` AND p.type = $${paramCount}`;
      params.push(type);
    }
    
    if (search) {
      paramCount++;
      query += ` AND p.title ILIKE $${paramCount}`;
      params.push(`%${search}%`);
    }
    
    switch (sort) {
      case 'newest': query += ' ORDER BY p.created_at DESC'; break;
      case 'popular': query += ' ORDER BY p.download_count DESC'; break;
      case 'rating': query += ' ORDER BY avg_rating DESC'; break;
      default: query += ' ORDER BY p.is_featured DESC, p.download_count DESC';
    }
    
    const result = await pool.query(query, params);
    
    // Convert avg_rating to number for all products
    result.rows.forEach(product => {
      product.avg_rating = parseFloat(product.avg_rating) || 0;
      product.review_count = parseInt(product.review_count) || 0;
    });
    
    res.render('shop/browse', {
      products: result.rows,
      filters: { type, search, sort }
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

router.get('/product/:slug', async (req, res) => {
  try {
    const product = await pool.query(`
      SELECT p.*, u.display_name as creator, u.username,
        COALESCE((SELECT AVG(rating) FROM reviews WHERE reviews.product_id = p.id), 0) as avg_rating,
        COALESCE((SELECT COUNT(*) FROM reviews WHERE reviews.product_id = p.id), 0) as review_count
      FROM products p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.slug = $1 AND p.is_approved = true
    `, [req.params.slug]);
    
    if (product.rows.length === 0) {
      return res.status(404).render('error', { message: 'Product not found' });
    }
    
    // Convert avg_rating to number
    product.rows[0].avg_rating = parseFloat(product.rows[0].avg_rating) || 0;
    product.rows[0].review_count = parseInt(product.rows[0].review_count) || 0;
    
    const reviews = await pool.query(`
      SELECT r.*, u.display_name FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = $1
      ORDER BY r.created_at DESC
    `, [product.rows[0].id]);
    
    res.render('shop/product', {
      product: product.rows[0],
      reviews: reviews.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

module.exports = router;

