const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { pool } = require('../db');

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
  const { title, description, price, type } = req.body;
  
  try {
    if (!title || !type || !req.file) {
      return res.render('admin/upload', { error: 'Missing required fields' });
    }
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price_cents = Math.round(parseFloat(price) * 100) || 0;
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
    
    res.redirect(`/shop/product/${result.rows[0].slug}`);
  } catch (err) {
    console.error(err);
    res.render('admin/upload', { error: 'Something went wrong: ' + err.message });
  }
});

module.exports = router;
