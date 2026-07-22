const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { execSync } = require('child_process');
const { pool } = require('../db');
const printful = require('../services/printful');

const router = express.Router();

// Set FFmpeg path for Alpine Linux
try {
  ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
  ffmpeg.setFfprobePath('/usr/bin/ffprobe');
} catch (err) {
  console.warn('FFmpeg binaries not found at default Alpine paths');
}

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

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).render('error', { message: 'Admin access required' });
  }
  next();
}

// Helper: Generate music preview using FFmpeg
async function generateMusicPreview(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.error('FFprobe error:', err.message);
          return reject(err);
        }

        const duration = Math.floor(metadata.format.duration || 180);
        const startTime = Math.max(0, Math.floor(duration / 2) - 10);
        
        console.log(`[FFmpeg] Song duration: ${duration}s, extracting from ${startTime}s for 20s preview`);

        ffmpeg(inputPath)
          .setStartTime(startTime)
          .setDuration(20)
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .output(outputPath)
          .on('start', (cmd) => {
            console.log(`[FFmpeg] Starting preview generation: ${cmd}`);
          })
          .on('progress', (progress) => {
            console.log(`[FFmpeg] Processing... ${Math.round(progress.percent || 0)}% complete`);
          })
          .on('end', () => {
            console.log(`[FFmpeg] Preview successfully created: ${outputPath}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`[FFmpeg] Error generating preview:`, err.message);
            reject(err);
          })
          .run();
      });
    } catch (err) {
      console.error('[FFmpeg] Unexpected error:', err.message);
      reject(err);
    }
  });
}

// CREATOR DASHBOARD - See their own products (approved or pending)
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

// ADMIN VETTING QUEUE - See all pending products
router.get('/vetting-queue', requireAdmin, async (req, res) => {
  try {
    const pending = await pool.query(`
      SELECT p.*, u.display_name, u.email
      FROM products p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_approved = false
      ORDER BY p.created_at DESC
    `);

    const approved = await pool.query(`
      SELECT COUNT(*) as count FROM products WHERE is_approved = true
    `);

    res.render('admin/vetting-queue', { 
      pending: pending.rows,
      approvedCount: approved.rows[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

// APPROVE PRODUCT
router.post('/approve/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'UPDATE products SET is_approved = true, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    
    console.log(`[Admin] Product approved: ID ${req.params.id}`);
    res.json({ success: true, message: 'Product approved!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// REJECT PRODUCT
router.post('/reject/:id', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    // We could store rejection reason in a separate table later
    // For now, just delete the product
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    
    if (product.rows.length > 0) {
      // Delete the uploaded files
      const p = product.rows[0];
      if (p.file_path) {
        const filePath = path.join(__dirname, '../public', p.file_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      if (p.preview_url) {
        const previewPath = path.join(__dirname, '../public', p.preview_url);
        if (fs.existsSync(previewPath)) fs.unlinkSync(previewPath);
      }
      if (p.cover_url) {
        const coverPath = path.join(__dirname, '../public', p.cover_url);
        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
      }
    }

    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    
    console.log(`[Admin] Product rejected: ID ${req.params.id}, Reason: ${reason}`);
    res.json({ success: true, message: 'Product rejected and deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/upload', requireAuth, (req, res) => {
  res.render('admin/upload', { error: null });
});

// Digital product upload - START UNAPPROVED
router.post('/upload', requireAuth, upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'file', maxCount: 1 }]), async (req, res) => {
  const { title, description, price, type } = req.body;
  
  try {
    if (!title || !type || !req.files.file || !req.files.cover) {
      return res.render('admin/upload', { error: 'Missing required fields (cover image and product file required)' });
    }
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
    const fileUrl = `/uploads/${req.files.file[0].filename}`;
    const coverUrl = `/uploads/${req.files.cover[0].filename}`;
    const filePath = path.join(__dirname, '../public/uploads', req.files.file[0].filename);
    
    let previewUrl = null;

    // Generate 20-second preview from middle of song for music files
    if (type === 'music' && (req.files.file[0].mimetype.includes('audio') || req.files.file[0].originalname.match(/\.(mp3|wav|flac|m4a|aac)$/i))) {
      const previewFilename = `preview-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
      const previewPath = path.join(__dirname, '../public/uploads', previewFilename);
      previewUrl = `/uploads/${previewFilename}`;

      try {
        console.log(`[Upload] Generating preview for music file: ${req.files.file[0].filename}`);
        await generateMusicPreview(filePath, previewPath);
        console.log(`[Upload] Preview generated successfully at: ${previewUrl}`);
      } catch (ffmpegErr) {
        console.error(`[Upload] Failed to generate preview:`, ffmpegErr.message);
        previewUrl = null;
      }
    }
    
    const result = await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, preview_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
      RETURNING id, slug
    `, [req.session.user.id, type, title, slug, description, price_cents, fileUrl, coverUrl, previewUrl]);
    
    console.log(`[Upload] Product created (PENDING APPROVAL): ID ${result.rows[0].id}`);
    res.render('admin/upload', { success: 'Product uploaded! Waiting for approval from our team.' });
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
router.post('/edit/:id', requireAuth, upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'file', maxCount: 1 }]), async (req, res) => {
  const { title, description, price, type, is_featured } = req.body;

  try {
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
    let fileUrl = p.file_path;
    let previewUrl = p.preview_url;

    if (req.files.cover) {
      coverUrl = `/uploads/${req.files.cover[0].filename}`;
    }

    if (req.files.file && type === 'music') {
      fileUrl = `/uploads/${req.files.file[0].filename}`;
      const filePath = path.join(__dirname, '../public/uploads', req.files.file[0].filename);
      
      try {
        console.log(`[Edit] Regenerating preview for updated music file: ${req.files.file[0].filename}`);
        
        const previewFilename = `preview-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
        const previewPath = path.join(__dirname, '../public/uploads', previewFilename);
        previewUrl = `/uploads/${previewFilename}`;
        
        await generateMusicPreview(filePath, previewPath);
        console.log(`[Edit] Preview regenerated successfully at: ${previewUrl}`);
        
        if (p.preview_url) {
          const oldPreviewPath = path.join(__dirname, '../public/uploads', p.preview_url.split('/').pop());
          if (fs.existsSync(oldPreviewPath)) {
            fs.unlinkSync(oldPreviewPath);
            console.log(`[Edit] Deleted old preview: ${oldPreviewPath}`);
          }
        }
      } catch (ffmpegErr) {
        console.error(`[Edit] Failed to regenerate preview:`, ffmpegErr.message);
        previewUrl = p.preview_url;
      }
    }

    await pool.query(`
      UPDATE products 
      SET title = $1, description = $2, price_cents = $3, type = $4, cover_url = $5, file_path = $6, preview_url = $7, is_featured = $8, updated_at = NOW()
      WHERE id = $9
    `, [title, description, price_cents, type, coverUrl, fileUrl, previewUrl, is_featured === 'true', req.params.id]);

    console.log(`[Edit] Product updated: ID ${req.params.id}`);
    res.redirect(`/shop/product/${p.slug}`);
  } catch (err) {
    console.error(err);
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.user.id]
    );
    res.render('admin/edit', { product: product.rows[0], error: 'Failed to update product: ' + err.message });
  }
});

// Physical product upload page
router.get('/upload-physical', requireAuth, (req, res) => {
  res.render('admin/upload-physical', { error: null, success: null });
});

// Physical product upload - START UNAPPROVED
router.post('/upload-physical', requireAuth, upload.fields([{ name: 'design', maxCount: 1 }]), async (req, res) => {
  const { title, description, price, category } = req.body;
  let variants = req.body.variants || [];
  
  if (typeof variants === 'string') {
    variants = [variants];
  }
  
  try {
    if (!title || !category || !req.files.design || variants.length === 0) {
      return res.render('admin/upload-physical', { 
        error: 'Missing required fields or no variants selected', success: null 
      });
    }
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
    const designUrl = `/uploads/${req.files.design[0].filename}`;
    
    const result = await pool.query(`
      INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, printful_category, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
      RETURNING id, slug
    `, [req.session.user.id, 'physical', title, slug, description, price_cents, designUrl, designUrl, category]);
    
    const productId = result.rows[0].id;
    
    try {
      const printfulProduct = await printful.createPrintfulProduct({
        external_id: `cabana-product-${productId}`,
        name: title,
        description: description || '',
        category: category,
        variants: []
      });

      await pool.query(`
        INSERT INTO physical_products (product_id, printful_product_id, printful_category, selected_variants, design_file_url, sync_status)
        VALUES ($1, $2, $3, $4, $5, 'synced')
      `, [productId, printfulProduct.id, category, JSON.stringify(variants), designUrl]);

      console.log(`[Upload] Physical product created (PENDING APPROVAL): ID ${productId}`);
      res.render('admin/upload-physical', { 
        success: 'Physical product uploaded! Waiting for approval. Once approved, customers can order from Printful.', 
        error: null
      });
    } catch (printfulErr) {
      console.error('Printful sync error:', printfulErr.message);
      await pool.query(`
        INSERT INTO physical_products (product_id, printful_category, selected_variants, design_file_url, sync_status)
        VALUES ($1, $2, $3, $4, 'failed')
      `, [productId, category, JSON.stringify(variants), designUrl]);

      res.render('admin/upload-physical', { 
        success: 'Physical product uploaded and pending approval. Printful sync will retry after approval.', 
        error: null
      });
    }
  } catch (err) {
    console.error(err);
    res.render('admin/upload-physical', { error: 'Something went wrong', success: null });
  }
});

// Bulk upload UI
router.get('/bulk/upload-ui', requireAuth, (req, res) => {
  res.render('admin/bulk-upload', { error: null, success: null });
});

// Bulk upload - START UNAPPROVED
router.post('/bulk/upload-manual', requireAuth, upload.any(), async (req, res) => {
  try {
    const products = req.body.products || {};
    const fileMap = {};
    
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
        const coverUrl = files[0];

        await pool.query(`
          INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
          RETURNING id
        `, [req.session.user.id, productData.type, productData.title, slug, productData.description || '', price_cents, fileUrl, coverUrl]);

        uploadedCount++;
      } catch (err) {
        console.error(err);
        errors.push(`Product ${parseInt(idx) + 1}: ${err.message}`);
      }
    }

    const message = uploadedCount > 0 
      ? `✓ Successfully uploaded ${uploadedCount} product${uploadedCount !== 1 ? 's' : ''} - All pending approval`
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

