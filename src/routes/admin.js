const express = require('express');
const multer = require('multer');
const path = require('path');
const { pool } = require('../db');
const printful = require('../services/printful');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).render('error', { message: 'Admin access required' });
  }
  next();
}

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const products = await pool.query(
      'SELECT * FROM products WHERE user_id = $1 ORDER BY created_at DESC',
      [req.session.user.id]
    );
    
    res.render('admin/dashboard', { products: products.rows });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

router.get('/upload', requireAuth, (req, res) => {
  res.render('admin/upload', { error: null });
});

// Digital product upload
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const { title, description, price, type } = req.body;
  
  try {
    if (!title || !type || !req.file) {
      return res.render('admin/upload', { error: 'Missing required fields' });
    }
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
    const fileUrl = `/uploads/${req.file.filename}`;
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const isImage = imageExtensions.includes(fileExt);
    
    const cover_url = isImage ? fileUrl : null;
    
    const result = await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, slug
    `, [req.session.user.id, type, title, slug, description, price_cents, fileUrl, cover_url]);
    
    res.redirect(`/shop/product/${result.rows[0].slug}`);
  } catch (err) {
    console.error(err);
    res.render('admin/upload', { error: 'Something went wrong' });
  }
});

// Physical product upload page
router.get('/upload-physical', requireAuth, (req, res) => {
  res.render('admin/upload-physical', { error: null });
});

// Physical product upload handler
router.post('/upload-physical', requireAuth, upload.single('design'), async (req, res) => {
  const { title, description, price, category } = req.body;
  let variants = req.body.variants || [];
  
  // Ensure variants is an array
  if (typeof variants === 'string') {
    variants = [variants];
  }
  
  try {
    if (!title || !category || !req.file || variants.length === 0) {
      return res.render('admin/upload-physical', { 
        error: 'Missing required fields or no variants selected' 
      });
    }
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
    const designUrl = `/uploads/${req.file.filename}`;
    
    // Create product in our DB (marked as physical)
    const result = await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, printful_category, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING id, slug
    `, [req.session.user.id, 'physical', title, slug, description, price_cents, designUrl, designUrl, category]);
    
    const productId = result.rows[0].id;
    
    // Sync to Printful
    try {
      const CATEGORY_TO_PRINTFUL = {
        't-shirts': 1,
        'hoodies': 18,
        'mugs': 10,
        'hats': 33,
        'phone-cases': 46,
        'pillows': 48,
        'blankets': 47,
        'stickers': 36
      };

      const printfulProductId = CATEGORY_TO_PRINTFUL[category];
      if (!printfulProductId) {
        throw new Error('Unknown product category');
      }

      const printfulProduct = await printful.createPrintfulProduct({
        external_id: `cabana-product-${productId}`,
        name: title,
        description: description || '',
        category: category,
        variants: variants.map(v => parseInt(v))
      });

      // Save Printful sync info
      await pool.query(`
        INSERT INTO physical_products (product_id, printful_product_id, printful_category, selected_variants, design_file_url, sync_status)
        VALUES ($1, $2, $3, $4, $5, 'synced')
      `, [productId, printfulProduct.id, category, JSON.stringify(variants), designUrl]);

      res.redirect(`/shop/product/${result.rows[0].slug}`);
    } catch (printfulErr) {
      console.error('Printful sync error:', printfulErr.message);
      // Still save the product but mark sync as failed
      await pool.query(`
        INSERT INTO physical_products (product_id, printful_category, selected_variants, design_file_url, sync_status)
        VALUES ($1, $2, $3, $4, 'failed')
      `, [productId, category, JSON.stringify(variants), designUrl]);

      res.render('admin/upload-physical', { 
        error: `Product created but failed to sync to Printful: ${printfulErr.message}` 
      });
    }
  } catch (err) {
    console.error(err);
    res.render('admin/upload-physical', { error: 'Something went wrong' });
  }
});

module.exports = router;

