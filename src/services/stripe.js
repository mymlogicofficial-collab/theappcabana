const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe payment intent for a purchase
 */
async function createPaymentIntent(amount_cents, metadata = {}) {
  try {
    const intent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: 'usd',
      metadata: metadata
    });
    return intent;
  } catch (err) {
    console.error('Stripe createPaymentIntent error:', err.message);
    throw err;
  }
}

/**
 * Retrieve a payment intent
 */
async function getPaymentIntent(intentId) {
  try {
    const intent = await stripe.paymentIntents.retrieve(intentId);
    return intent;
  } catch (err) {
    console.error('Stripe getPaymentIntent error:', err.message);
    throw err;
  }
}

/**
 * Confirm a payment intent (for client confirmation)
 */
async function confirmPaymentIntent(intentId, paymentMethod) {
  try {
    const intent = await stripe.paymentIntents.confirm(intentId, {
      payment_method: paymentMethod
    });
    return intent;
  } catch (err) {
    console.error('Stripe confirmPaymentIntent error:', err.message);
    throw err;
  }
}

/**
 * Create a Stripe customer
 */
async function createCustomer(email, metadata = {}) {
  try {
    const customer = await stripe.customers.create({
      email: email,
      metadata: metadata
    });
    return customer;
  } catch (err) {
    console.error('Stripe createCustomer error:', err.message);
    throw err;
  }
}

/**
 * Get a Stripe customer
 */
async function getCustomer(customerId) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (err) {
    console.error('Stripe getCustomer error:', err.message);
    throw err;
  }
}

module.exports = {
  stripe,
  createPaymentIntent,
  getPaymentIntent,
  confirmPaymentIntent,
  createCustomer,
  getCustomer
};

