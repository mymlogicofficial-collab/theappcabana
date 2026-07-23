const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

// Browse all products
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

// View product details by slug
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
      reviews: reviews.rows,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

// Merch request - customer requests merch, you fulfill manually
router.post('/merch-request', async (req, res) => {
  try {
    const { product_id, category, variant, product_title, product_slug, image_url } = req.body;

    // Store request in DB with image URL and product title
    const userId = req.session?.user?.id || null;
    await pool.query(`
      INSERT INTO merch_requests (product_id, user_id, category, variant, product_title, image_url, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
    `, [product_id, userId, category, variant, product_title, image_url]);

    console.log(`[MERCH] Request: ${product_title} - ${category}/${variant} - ${image_url}`);
    res.json({ success: true, message: 'Request submitted' });
  } catch (err) {
    console.error('[MERCH] Error:', err.message);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// Checkout page - choose digital or merch
router.get('/checkout/:product_id', requireAuth, async (req, res) => {
  try {
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [req.params.product_id]
    );
    
    if (product.rows.length === 0) {
      return res.status(404).render('error', { message: 'Product not found' });
    }

    res.render('shop/checkout', { 
      product: product.rows[0],
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

// Create Stripe session for digital download
router.post('/checkout/digital/:product_id', requireAuth, async (req, res) => {
  try {
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [req.params.product_id]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const p = product.rows[0];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: p.title,
              description: p.description
            },
            unit_amount: p.price_cents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/shop/product/${p.slug}`,
      client_reference_id: `${req.session.user.id}-${p.id}-digital`,
      metadata: {
        user_id: req.session.user.id,
        product_id: p.id,
        type: 'digital'
      }
    });

    res.json({ sessionId: session.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Handle successful payment
router.get('/success', requireAuth, async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).render('error', { message: 'No session ID provided' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(400).render('error', { message: 'Payment not completed' });
    }

    const [userId, productId, type] = session.client_reference_id.split('-');

    // Record purchase
    await pool.query(`
      INSERT INTO purchases (user_id, product_id, amount_paid_cents, stripe_payment_intent_id, downloaded)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, product_id) DO UPDATE SET 
        amount_paid_cents = $3,
        stripe_payment_intent_id = $4
    `, [userId, productId, session.amount_total, session.payment_intent, type === 'digital']);

    // Increment download count
    await pool.query(
      'UPDATE products SET download_count = download_count + 1 WHERE id = $1',
      [productId]
    );

    const product = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);

    res.render('shop/success', { 
      product: product.rows[0],
      type: type
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

// Download purchased product
router.get('/download/:product_id', requireAuth, async (req, res) => {
  try {
    const purchase = await pool.query(`
      SELECT p.* FROM products p
      INNER JOIN purchases pu ON p.id = pu.product_id
      WHERE p.id = $1 AND pu.user_id = $2
    `, [req.params.product_id, req.session.user.id]);

    if (purchase.rows.length === 0) {
      return res.status(403).json({ error: 'You have not purchased this product' });
    }

    const product = purchase.rows[0];
    res.download(product.file_path, product.title);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to download' });
  }
});

module.exports = router;
