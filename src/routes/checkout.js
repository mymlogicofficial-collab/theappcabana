const express = require('express');
const { pool } = require('../db');
const stripeService = require('../services/stripe');
const printfulService = require('../services/printful');

const router = express.Router();

/**
 * POST /checkout/create-intent
 * Create a payment intent for a product purchase
 */
router.post('/create-intent', async (req, res) => {
  const { product_id, quantity = 1 } = req.body;

  try {
    if (!product_id) {
      return res.status(400).json({ error: 'Missing product_id' });
    }

    // Fetch product
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const p = product.rows[0];
    const amount_cents = p.price_cents * quantity;

    // Create payment intent
    const intent = await stripeService.createPaymentIntent(amount_cents, {
      product_id: product_id.toString(),
      product_slug: p.slug,
      quantity: quantity.toString()
    });

    res.json({
      clientSecret: intent.client_secret,
      amount: amount_cents,
      product: {
        id: p.id,
        title: p.title,
        price: (p.price_cents / 100).toFixed(2)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * POST /checkout/confirm
 * Confirm payment and create purchase record
 */
router.post('/confirm', async (req, res) => {
  const { intentId, product_id, quantity = 1 } = req.body;

  try {
    if (!intentId || !product_id) {
      return res.status(400).json({ error: 'Missing intentId or product_id' });
    }

    // Get payment intent status
    const intent = await stripeService.getPaymentIntent(intentId);

    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed', status: intent.status });
    }

    // Fetch product
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const p = product.rows[0];
    const amount_paid_cents = p.price_cents * quantity;

    // Create purchase record
    const purchase = await pool.query(`
      INSERT INTO purchases (user_id, product_id, amount_paid_cents, stripe_payment_intent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `, [req.session.user?.id || null, product_id, amount_paid_cents, intentId]);

    const purchaseId = purchase.rows[0].id;

    // If physical product, create Printful order
    if (p.type === 'physical') {
      const physicalProduct = await pool.query(`
        SELECT * FROM physical_products WHERE product_id = $1
      `, [product_id]);

      if (physicalProduct.rows.length > 0 && physicalProduct.rows[0].printful_product_id) {
        // Get customer info from request (should be passed in body)
        const { customer_name, email, address_line1, address_line2, city, state, country, postal_code, phone } = req.body;

        if (!customer_name || !email || !address_line1 || !city || !state || !country || !postal_code) {
          return res.status(400).json({ error: 'Missing shipping information' });
        }

        try {
          const printfulOrder = await printfulService.createPrintfulOrder({
            external_id: `cabana-purchase-${purchaseId}`,
            customer_name,
            email,
            address_line1,
            address_line2,
            city,
            state,
            country,
            postal_code,
            phone,
            items: [
              {
                product_id: physicalProduct.rows[0].printful_product_id,
                quantity: quantity
              }
            ]
          });

          // Save order to DB
          await pool.query(`
            INSERT INTO physical_orders (purchase_id, printful_order_id, order_status)
            VALUES ($1, $2, $3)
          `, [purchaseId, printfulOrder.id, 'pending']);

          res.json({
            ok: true,
            purchase_id: purchaseId,
            type: 'physical',
            printful_order_id: printfulOrder.id,
            order_status: 'pending'
          });
        } catch (printfulErr) {
          console.error('Printful order creation failed:', printfulErr.message);
          // Still mark purchase as successful, but note Printful sync failed
          res.json({
            ok: true,
            purchase_id: purchaseId,
            type: 'physical',
            warning: 'Purchase recorded but Printful order creation failed. Will retry.'
          });
        }
      } else {
        res.json({ ok: true, purchase_id: purchaseId, type: 'physical' });
      }
    } else {
      // Digital product - just confirm purchase
      res.json({ ok: true, purchase_id: purchaseId, type: 'digital' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to confirm purchase' });
  }
});

/**
 * GET /checkout/intent/:intentId
 * Get payment intent status
 */
router.get('/intent/:intentId', async (req, res) => {
  try {
    const intent = await stripeService.getPaymentIntent(req.params.intentId);
    res.json({
      id: intent.id,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch intent' });
  }
});

module.exports = router;

