const axios = require('axios');

const PRINTFUL_API_URL = 'https://api.printful.com';
const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;

if (!PRINTFUL_API_KEY) {
  console.warn('WARNING: PRINTFUL_API_KEY not set. Printful integration will not work.');
}

// Axios instance with Printful auth
const printfulClient = axios.create({
  baseURL: PRINTFUL_API_URL,
  auth: {
    username: PRINTFUL_API_KEY || '',
    password: ''
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

// Get available product types from Printful
async function getProductCategories() {
  try {
    const response = await printfulClient.get('/catalog/categories');
    return response.data.result;
  } catch (err) {
    console.error('Error fetching Printful categories:', err.message);
    return [];
  }
}

// Get variants (sizes/colors) for a specific product
async function getProductVariants(productId) {
  try {
    const response = await printfulClient.get(`/catalog/products/${productId}`);
    return response.data.result.variants;
  } catch (err) {
    console.error(`Error fetching variants for product ${productId}:`, err.message);
    return [];
  }
}

// Create a product in Printful catalog
async function createPrintfulProduct(data) {
  try {
    const response = await printfulClient.post('/catalog/products', {
      external_id: data.external_id, // Link to our product ID
      name: data.name,
      description: data.description || '',
      category: data.category, // e.g., 'tshirts', 'hoodies', 'mugs'
      variants: data.variants // Array of variant IDs to include
    });
    return response.data.result;
  } catch (err) {
    console.error('Error creating Printful product:', err.message);
    throw err;
  }
}

// Create an order in Printful
async function createPrintfulOrder(data) {
  try {
    const response = await printfulClient.post('/orders', {
      external_id: data.external_id, // Link to our purchase/order ID
      shipping: 'STANDARD',
      recipient: {
        name: data.customer_name,
        address1: data.address_line1,
        address2: data.address_line2 || '',
        city: data.city,
        state_code: data.state,
        country_code: data.country,
        zip: data.postal_code,
        email: data.email,
        phone: data.phone || ''
      },
      items: data.items // Array of { product_id, quantity, variant_id }
    });
    return response.data.result;
  } catch (err) {
    console.error('Error creating Printful order:', err.message);
    throw err;
  }
}

// Get order status from Printful
async function getPrintfulOrderStatus(printful_order_id) {
  try {
    const response = await printfulClient.get(`/orders/${printful_order_id}`);
    return response.data.result;
  } catch (err) {
    console.error(`Error fetching Printful order ${printful_order_id}:`, err.message);
    return null;
  }
}

// Estimate shipping cost
async function estimateShipping(data) {
  try {
    const response = await printfulClient.post('/shipping/rates', {
      recipient: {
        address1: data.address_line1,
        address2: data.address_line2 || '',
        city: data.city,
        state_code: data.state,
        country_code: data.country,
        zip: data.postal_code
      },
      items: data.items
    });
    return response.data.result;
  } catch (err) {
    console.error('Error estimating shipping:', err.message);
    return null;
  }
}

module.exports = {
  getProductCategories,
  getProductVariants,
  createPrintfulProduct,
  createPrintfulOrder,
  getPrintfulOrderStatus,
  estimateShipping
};

