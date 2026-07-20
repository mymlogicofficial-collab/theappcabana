const express = require('express');
const { pool } = require('../db');
const zazzle = require('../services/zazzle');

const router = express.Router();

// Get Zazzle variants for a product category
router.get('/variants/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const variants = await zazzle.getProductVariants(category);

    if (!variants.productId) {
      return res.status(400).json({ error: 'Unknown product category' });
    }

    res.json({ 
      category, 
      colors: variants.colors,
      sizes: variants.sizes,
      basePrice: variants.basePrice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

// Sync design to Zazzle
router.post('/sync-design/:product_id', async (req, res) => {
  try {
    const { product_id } = req.params;
    const { category, colors, sizes, design_url } = req.body;

    if (!category || !design_url) {
      return res.status(400).json({ error: 'Missing category or design URL' });
    }

    // Get product details from our DB
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const p = product.rows[0];

    // Create design in Zazzle
    const zazzleDesign = await zazzle.createZazzleDesign({
      external_id: `cabana-product-${product_id}`,
      name: p.title,
      description: p.description,
      category: category,
      design_url: design_url,
      colors: colors || [],
      sizes: sizes || []
    });

    // Save Zazzle sync info to our DB
    await pool.query(`
      INSERT INTO physical_products (product_id, zazzle_design_id, zazzle_category, selected_variants, sync_status)
      VALUES ($1, $2, $3, $4, 'synced')
      ON CONFLICT (product_id) DO UPDATE SET
        zazzle_design_id = $2,
        zazzle_category = $3,
        selected_variants = $4,
        sync_status = 'synced'
    `, [product_id, zazzleDesign.id, category, JSON.stringify({ colors, sizes })]);

    res.json({ ok: true, zazzle_design_id: zazzleDesign.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync design to Zazzle' });
  }
});

// Get design sync status
router.get('/design-status/:product_id', async (req, res) => {
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

