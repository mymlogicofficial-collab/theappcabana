const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { pool } = require('../db');
const printful = require('../services/printful');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 500 * 1024 * 1024 },
  fields: [
    { name: 'cover', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'design', maxCount: 1 }
  ]
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
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
router.post('/upload', requireAuth, upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'file', maxCount: 1 }]), async (req, res) => {
  const { title, description, price, type } = req.body;
  
  try {
    if (!title || !type || !req.files.file || !req.files.cover) {
      return res.render('admin/upload', { error: 'Missing required fields (cover image and product file required)' });
    }
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
<<<<<<< HEAD
    const filePath = `/uploads/${req.file.filename}`;
    let previewUrl = null;

    // Generate 20-second preview for music files
    if (type === 'music' && (req.file.mimetype.includes('audio') || req.file.originalname.endsWith('.mp3'))) {
      const previewFilename = `preview-${Date.now()}.mp3`;
      const previewPath = path.join(__dirname, '../public/uploads', previewFilename);
      previewUrl = `/uploads/${previewFilename}`;

      await new Promise((resolve, reject) => {
        ffmpeg(req.file.path)
          .setDuration(20)
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .output(previewPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    }

    const result = await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, preview_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, slug
    `, [req.session.user.id, type, title, slug, description, price_cents, filePath, previewUrl]);
=======
    const fileUrl = `/uploads/${req.files.file[0].filename}`;
    const coverUrl = `/uploads/${req.files.cover[0].filename}`;
    
    const result = await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, slug
    `, [req.session.user.id, type, title, slug, description, price_cents, fileUrl, coverUrl]);
>>>>>>> 801ef7421025811f5af2e4d09bc3f32db41a3ead
    
    res.redirect(`/shop/product/${result.rows[0].slug}`);
  } catch (err) {
    console.error(err);
    res.render('admin/upload', { error: 'Something went wrong: ' + err.message });
  }
});

// Edit product page
router.get('/edit/:id', requireAuth, async (req, res) => {
  try {
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.user.id]
    );

    if (product.rows.length === 0) {
      return res.status(404).render('error', { message: 'Product not found' });
    }

    res.render('admin/edit', { product: product.rows[0], error: null });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

// Update product
router.post('/edit/:id', requireAuth, upload.fields([{ name: 'cover', maxCount: 1 }]), async (req, res) => {
  const { title, description, price, type, is_featured } = req.body;

  try {
    // Verify ownership
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.user.id]
    );

    if (product.rows.length === 0) {
      return res.status(404).render('error', { message: 'Product not found' });
    }

    const p = product.rows[0];
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
    let coverUrl = p.cover_url;

    // Update cover if new one uploaded
    if (req.files.cover) {
      coverUrl = `/uploads/${req.files.cover[0].filename}`;
    }

    await pool.query(`
      UPDATE products 
      SET title = $1, description = $2, price_cents = $3, type = $4, cover_url = $5, is_featured = $6, updated_at = NOW()
      WHERE id = $7
    `, [title, description, price_cents, type, coverUrl, is_featured === 'true', req.params.id]);

    res.redirect(`/shop/product/${p.slug}`);
  } catch (err) {
    console.error(err);
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.user.id]
    );
    res.render('admin/edit', { product: product.rows[0], error: 'Failed to update product' });
  }
});

// Physical product upload page
router.get('/upload-physical', requireAuth, (req, res) => {
  res.render('admin/upload-physical', { error: null });
});

// Physical product upload handler
router.post('/upload-physical', requireAuth, upload.fields([{ name: 'design', maxCount: 1 }]), async (req, res) => {
  const { title, description, price, category } = req.body;
  let variants = req.body.variants || [];
  
  // Ensure variants is an array
  if (typeof variants === 'string') {
    variants = [variants];
  }
  
  try {
    if (!title || !category || !req.files.design || variants.length === 0) {
      return res.render('admin/upload-physical', { 
        error: 'Missing required fields or no variants selected' 
      });
    }
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
    const designUrl = `/uploads/${req.files.design[0].filename}`;
    
    // Create product in our DB (marked as physical)
    const result = await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, printful_category, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING id, slug
    `, [req.session.user.id, 'physical', title, slug, description, price_cents, designUrl, designUrl, category]);
    
    const productId = result.rows[0].id;
    
    // Sync to Printful
    try {
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
        error: `Product created but failed to sync to Printful: ${printfulErr.message}. Retry sync manually later.` 
      });
    }
  } catch (err) {
    console.error(err);
    res.render('admin/upload-physical', { error: 'Something went wrong' });
  }
});

// Bulk upload UI
router.get('/bulk/upload-ui', requireAuth, (req, res) => {
  res.render('admin/bulk-upload', { error: null, success: null });
});

// Bulk upload - manual entry
router.post('/bulk/upload-manual', requireAuth, upload.any(), async (req, res) => {
  try {
    const products = req.body.products || {};
    const fileMap = {};
    
    // Build file map from uploads
    if (req.files) {
      req.files.forEach(file => {
        const match = file.fieldname.match(/products\[(\d+)\]\[files\]/);
        if (match) {
          const idx = match[1];
          if (!fileMap[idx]) fileMap[idx] = [];
          fileMap[idx].push(`/uploads/${file.filename}`);
        }
      });
    }

    let uploadedCount = 0;
    const errors = [];

    // Process each product
    for (const [idx, productData] of Object.entries(products)) {
      try {
        if (!productData.title || !productData.type) {
          errors.push(`Product ${parseInt(idx) + 1}: Missing title or type`);
          continue;
        }

        const slug = productData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const price_cents = Math.round(parseFloat(productData.price) * 100) || 0;
        const files = fileMap[idx] || [];
        
        if (files.length === 0) {
          errors.push(`Product ${parseInt(idx) + 1}: No files uploaded`);
          continue;
        }

        const fileUrl = files[0];
        const coverUrl = files[0]; // Use first file as cover

        await pool.query(`
          INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
          RETURNING id
        `, [req.session.user.id, productData.type, productData.title, slug, productData.description || '', price_cents, fileUrl, coverUrl]);

        uploadedCount++;
      } catch (err) {
        console.error(err);
        errors.push(`Product ${parseInt(idx) + 1}: ${err.message}`);
      }
    }

    const message = uploadedCount > 0 
      ? `✓ Successfully uploaded ${uploadedCount} product${uploadedCount !== 1 ? 's' : ''}`
      : 'No products uploaded';

    res.render('admin/bulk-upload', { 
      success: uploadedCount > 0 ? message : null,
      error: errors.length > 0 ? errors.join('; ') : null 
    });
  } catch (err) {
    console.error(err);
    res.render('admin/bulk-upload', { error: 'Something went wrong during bulk upload' });
  }
});

module.exports = router;

