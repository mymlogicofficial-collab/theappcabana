const axios = require('axios');

const PRINTFUL_API_URL = 'https://api.printful.com';
const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;

if (!PRINTFUL_API_KEY) {
  console.warn('WARNING: PRINTFUL_API_KEY not set. Printful integration will not work.');
}

// Axios instance with Printful private token auth
const printfulClient = axios.create({
  baseURL: PRINTFUL_API_URL,
  headers: {
    'Authorization': `Bearer ${PRINTFUL_API_KEY || ''}`,
    'Content-Type': 'application/json'
  }
});

// Printful product ID mappings (catalog products)
const PRODUCT_TYPE_MAP = {
  't-shirts': 1,
  'hoodies': 18,
  'mugs': 10,
  'hats': 33,
  'phone-cases': 46,
  'pillows': 48,
  'blankets': 47,
  'stickers': 36
};

/**
 * Get all available products from Printful catalog
 */
async function getProductCatalog() {
  try {
    const response = await printfulClient.get('/catalog/products');
    return response.data.result || [];
  } catch (err) {
    console.error('Error fetching Printful catalog:', err.message);
    return [];
  }
}

/**
 * Get product variants (sizes, colors, prices) for a product type
 */
async function getProductVariants(productType) {
  try {
    const productId = PRODUCT_TYPE_MAP[productType];
    if (!productId) {
      throw new Error(`Unknown product type: ${productType}`);
    }

    const response = await printfulClient.get(`/catalog/products/${productId}`);
    const product = response.data.result;

    // Extract variants with names and prices
    const variants = product.variants.map(v => ({
      id: v.id,
      name: `${v.name} - $${(v.price / 100).toFixed(2)}`,
      size: v.size,
      color: v.color,
      price: v.price,
      in_stock: v.in_stock
    }));

    return variants;
  } catch (err) {
    console.error(`Error fetching variants for ${productType}:`, err.message);
    return [];
  }
}

/**
 * Create a product in your Printful store
 */
async function createPrintfulProduct(data) {
  try {
    const productId = PRODUCT_TYPE_MAP[data.category];
    if (!productId) {
      throw new Error(`Unknown product category: ${data.category}`);
    }

    // Create product in your store with selected variants
    const response = await printfulClient.post('/products', {
      external_id: data.external_id, // Link to our product ID
      name: data.name,
      description: data.description || '',
      variants: data.variants.map(variantId => ({
        id: variantId,
        external_id: `${data.external_id}-${variantId}`
      }))
    });

    return response.data.result;
  } catch (err) {
    console.error('Error creating Printful product:', err.message);
    throw err;
  }
}

/**
 * Get a product from your Printful store
 */
async function getPrintfulProduct(printfulProductId) {
  try {
    const response = await printfulClient.get(`/products/${printfulProductId}`);
    return response.data.result;
  } catch (err) {
    console.error(`Error fetching Printful product ${printfulProductId}:`, err.message);
    return null;
  }
}

/**
 * Upload a file to Printful (for designs)
 */
async function uploadFile(fileData) {
  try {
    const formData = new FormData();
    formData.append('file', fileData);

    const response = await printfulClient.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data.result;
  } catch (err) {
    console.error('Error uploading file to Printful:', err.message);
    throw err;
  }
}

/**
 * Create an order in Printful
 */
async function createPrintfulOrder(data) {
  try {
    const response = await printfulClient.post('/orders', {
      external_id: data.external_id, // Link to our purchase/order ID
      shipping: data.shipping_method || 'STANDARD',
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
      items: data.items // [{ product_id, variant_id, quantity }, ...]
    });

    return response.data.result;
  } catch (err) {
    console.error('Error creating Printful order:', err.message);
    throw err;
  }
}

/**
 * Get order status from Printful
 */
async function getPrintfulOrderStatus(printfulOrderId) {
  try {
    const response = await printfulClient.get(`/orders/${printfulOrderId}`);
    return response.data.result;
  } catch (err) {
    console.error(`Error fetching Printful order ${printfulOrderId}:`, err.message);
    return null;
  }
}

/**
 * Estimate shipping costs for an order
 */
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

/**
 * Confirm a pending order with Printful
 */
async function confirmOrder(printfulOrderId) {
  try {
    const response = await printfulClient.post(`/orders/${printfulOrderId}/confirm`);
    return response.data.result;
  } catch (err) {
    console.error(`Error confirming Printful order ${printfulOrderId}:`, err.message);
    throw err;
  }
}

module.exports = {
  PRODUCT_TYPE_MAP,
  getProductCatalog,
  getProductVariants,
  createPrintfulProduct,
  getPrintfulProduct,
  uploadFile,
  createPrintfulOrder,
  getPrintfulOrderStatus,
  estimateShipping,
  confirmOrder
};

