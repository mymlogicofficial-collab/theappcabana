const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

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

// Redirect to Printful for physical merch
router.get('/checkout/merch/:product_id', requireAuth, async (req, res) => {
  try {
    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [req.params.product_id]
    );

    if (product.rows.length === 0) {
      return res.status(404).render('error', { message: 'Product not found' });
    }

    const p = product.rows[0];

    // Redirect to your Printful store with product info
    // You'll need to set up Printful integration separately
    const printfulUrl = `${process.env.PRINTFUL_STORE_URL || 'https://your-store.printful.com'}?product=${encodeURIComponent(p.title)}&price=${p.price_cents / 100}`;
    
    res.redirect(printfulUrl);
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
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
