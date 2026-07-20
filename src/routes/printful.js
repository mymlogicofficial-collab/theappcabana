const express = require('express');
const { pool } = require('../db');
const printful = require('../services/printful');

const router = express.Router();

/**
 * GET /api/printful/variants/:category
 * Fetch available variants for a product type
 */
router.get('/variants/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const variants = await printful.getProductVariants(category);

    if (variants.length === 0) {
      return res.status(400).json({ error: 'Unknown product category or no variants available' });
    }

    res.json({ category, variants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

/**
 * POST /api/printful/sync-product/:product_id
 * Sync design/product to Printful catalog
 */
router.post('/sync-product/:product_id', async (req, res) => {
  try {
    const { product_id } = req.params;
    const { category, selected_variants } = req.body;

    if (!category || !selected_variants || selected_variants.length === 0) {
      return res.status(400).json({ error: 'Missing category or variants' });
    }

    // Get product details from our DB
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const p = product.rows[0];

    // Create product in Printful
    const printfulProduct = await printful.createPrintfulProduct({
      external_id: `cabana-product-${product_id}`,
      name: p.title,
      description: p.description,
      category: category,
      variants: selected_variants.map(v => parseInt(v))
    });

    // Save Printful sync info to our DB
    await pool.query(`
      INSERT INTO physical_products (product_id, printful_product_id, printful_category, selected_variants, design_file_url, sync_status)
      VALUES ($1, $2, $3, $4, $5, 'synced')
      ON CONFLICT (product_id) DO UPDATE SET
        printful_product_id = $2,
        printful_category = $3,
        selected_variants = $4,
        sync_status = 'synced'
    `, [product_id, printfulProduct.id, category, JSON.stringify(selected_variants), p.cover_url]);

    res.json({ ok: true, printful_product_id: printfulProduct.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync product to Printful' });
  }
});

/**
 * GET /api/printful/product-status/:product_id
 * Get product sync status
 */
router.get('/product-status/:product_id', async (req, res) => {
  try {
    const { product_id } = req.params;

    const result = await pool.query('SELECT * FROM physical_products WHERE product_id = $1', [product_id]);

    if (result.rows.length === 0) {
      return res.json({ synced: false });
    }

    res.json({ synced: true, ...result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

module.exports = router;

