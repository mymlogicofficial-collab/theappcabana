const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { pool } = require('../db');
const { resizeAllMerchVariants } = require('../utils/image-resize');

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

const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

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

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const { title, description, price, type, add_to_physical } = req.body;
  
  try {
    if (!title || !type || !req.file) {
      return res.render('admin/upload', { error: 'Missing required fields' });
    }
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
    const filePath = `/uploads/${req.file.filename}`;
    let previewUrl = null;
    let coverUrl = null;

    // For images (art), use as cover
    if (type === 'art' || req.file.mimetype.includes('image')) {
      coverUrl = filePath;
    }

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

    // Create product
    const result = await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, preview_url, cover_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING id, slug
    `, [req.session.user.id, type, title, slug, description, price_cents, filePath, previewUrl, coverUrl]);
    
    const productId = result.rows[0].id;

    // Auto-resize and sync to physical inventory if requested and image type
    if (add_to_physical === 'on' && (type === 'art' || req.file.mimetype.includes('image'))) {
      try {
        const merchVariants = await resizeAllMerchVariants(req.file.path);
        
        await pool.query(`
          INSERT INTO physical_products (product_id, selected_variants, sync_status)
          VALUES ($1, $2, $3)
          ON CONFLICT (product_id) DO UPDATE SET selected_variants = $2, sync_status = $3
        `, [
          productId,
          JSON.stringify(merchVariants),
          'ready'
        ]);
        
        console.log(`[ADMIN] Physical inventory created for product ${productId}`);
      } catch (err) {
        console.error(`[ADMIN] Failed to create physical variants:`, err.message);
      }
    }

    res.redirect(`/shop/product/${result.rows[0].slug}`);
  } catch (err) {
    console.error(err);
    res.render('admin/upload', { error: 'Something went wrong: ' + err.message });
  }
});

// Edit product
router.get('/edit/:product_id', requireAuth, async (req, res) => {
  try {
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2',
      [req.params.product_id, req.session.user.id]
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

router.post('/edit/:product_id', requireAuth, upload.single('file'), async (req, res) => {
  const { title, description, price } = req.body;
  
  try {
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2',
      [req.params.product_id, req.session.user.id]
    );
    
    if (product.rows.length === 0) {
      return res.status(404).render('error', { message: 'Product not found' });
    }
    
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
    let filePath = product.rows[0].file_path;
    let coverUrl = product.rows[0].cover_url;
    
    if (req.file) {
      filePath = `/uploads/${req.file.filename}`;
      coverUrl = filePath;
    }
    
    await pool.query(`
      UPDATE products SET title = $1, description = $2, price_cents = $3, file_path = $4, cover_url = $5, updated_at = NOW()
      WHERE id = $6 AND user_id = $7
    `, [title, description, price_cents, filePath, coverUrl, req.params.product_id, req.session.user.id]);
    
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to update product' });
  }
});

module.exports = router;
