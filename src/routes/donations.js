const express = require('express');
const { pool } = require('../db');
const stripeService = require('../services/stripe');

const router = express.Router();

/**
 * GET /donations
 * Donations page with both causes
 */
router.get('/', async (req, res) => {
  try {
    // Get donation stats
    const stats = await pool.query(`
      SELECT 
        cause,
        COUNT(*) as total_donors,
        COALESCE(SUM(amount_cents), 0) as total_raised
      FROM donations
      WHERE status = 'completed'
      GROUP BY cause
    `);

    const causeStats = {
      'pencil-7': { total_donors: 0, total_raised: 0 },
      'app-cabana': { total_donors: 0, total_raised: 0 }
    };

    stats.rows.forEach(row => {
      causeStats[row.cause] = {
        total_donors: parseInt(row.total_donors),
        total_raised: parseInt(row.total_raised)
      };
    });

    res.render('donations/index', { causeStats });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

/**
 * POST /donations/create-intent
 * Create a payment intent for a donation
 */
router.post('/create-intent', async (req, res) => {
  const { cause, amount } = req.body;

  try {
    if (!cause || !amount) {
      return res.status(400).json({ error: 'Missing cause or amount' });
    }

    if (!['pencil-7', 'app-cabana'].includes(cause)) {
      return res.status(400).json({ error: 'Invalid cause' });
    }

    const amount_cents = Math.round(parseFloat(amount) * 100);
    if (amount_cents < 100) {
      return res.status(400).json({ error: 'Minimum donation is $1' });
    }
    if (amount_cents > 1000000) {
      return res.status(400).json({ error: 'Maximum donation is $10,000' });
    }

    // Create payment intent
    const intent = await stripeService.createPaymentIntent(amount_cents, {
      cause: cause,
      type: 'donation'
    });

    res.json({
      clientSecret: intent.client_secret,
      amount: amount_cents,
      cause: cause
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * POST /donations/confirm
 * Confirm donation and save to database
 */
router.post('/confirm', async (req, res) => {
  const { intentId, cause, amount, donor_name, donor_email, is_anonymous } = req.body;

  try {
    if (!intentId || !cause || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get payment intent status
    const intent = await stripeService.getPaymentIntent(intentId);

    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed', status: intent.status });
    }

    const amount_cents = Math.round(parseFloat(amount) * 100);

    // Save donation to database
    const donation = await pool.query(`
      INSERT INTO donations (cause, amount_cents, donor_name, donor_email, is_anonymous, stripe_payment_intent_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'completed')
      RETURNING id, created_at
    `, [cause, amount_cents, donor_name || 'Anonymous', donor_email || null, is_anonymous || false, intentId]);

    res.json({
      ok: true,
      donation_id: donation.rows[0].id,
      amount: amount,
      cause: cause
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete donation' });
  }
});

/**
 * GET /donations/intent/:intentId
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

