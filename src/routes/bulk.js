const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parse/sync');
const { pool } = require('../db');

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
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET bulk upload page
router.get('/upload-ui', requireAuth, requireAdmin, (req, res) => {
  res.render('admin/bulk-upload', { message: null, error: null });
});

// POST bulk upload via CSV
router.post('/csv', requireAuth, requireAdmin, upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV is empty' });
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const record of records) {
      try {
        const { title, description, price, type, file_url } = record;

        if (!title || !type) {
          results.failed++;
          results.errors.push(`Row skipped: missing title or type`);
          continue;
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const price_cents = Math.round(parseFloat(price || 0) * 100);

        await pool.query(`
          INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          ON CONFLICT (slug) DO NOTHING
        `, [req.session.user.id, type, title, slug, description || '', price_cents, file_url || '']);

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Row error: ${err.message}`);
      }
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST bulk upload via JSON
router.post('/json', requireAuth, requireAdmin, upload.single('json'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No JSON file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const records = JSON.parse(fileContent);

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'JSON must be an array of products' });
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const record of records) {
      try {
        const { title, description, price, type, file_url } = record;

        if (!title || !type) {
          results.failed++;
          results.errors.push(`Product skipped: missing title or type`);
          continue;
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const price_cents = Math.round(parseFloat(price || 0) * 100);

        await pool.query(`
          INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          ON CONFLICT (slug) DO NOTHING
        `, [req.session.user.id, type, title, slug, description || '', price_cents, file_url || '']);

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Product error: ${err.message}`);
      }
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST bulk upload with file attachments (multipart form data)
router.post('/files', requireAuth, requireAdmin, upload.array('files', 100), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { products } = req.body; // JSON string of product metadata
    let productMetadata = [];
    
    try {
      productMetadata = JSON.parse(products || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid product metadata JSON' });
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (let i = 0; i < req.files.length; i++) {
      try {
        const file = req.files[i];
        const meta = productMetadata[i] || {};
        const { title, description, price, type } = meta;

        if (!title || !type) {
          results.failed++;
          results.errors.push(`File ${file.originalname} skipped: missing metadata`);
          continue;
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const price_cents = Math.round(parseFloat(price || 0) * 100);

        await pool.query(`
          INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          ON CONFLICT (slug) DO NOTHING
        `, [req.session.user.id, type, title, slug, description || '', price_cents, `/uploads/${file.filename}`]);

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`File error: ${err.message}`);
      }
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
