const axios = require('axios');

const ZAZZLE_API_URL = 'https://api.zazzle.com/v1';
const ZAZZLE_API_KEY = process.env.ZAZZLE_API_KEY;

if (!ZAZZLE_API_KEY) {
  console.warn('WARNING: ZAZZLE_API_KEY not set. Zazzle integration will not work.');
}

// Axios instance with Zazzle auth
const zazzleClient = axios.create({
  baseURL: ZAZZLE_API_URL,
  headers: {
    'Authorization': `Bearer ${ZAZZLE_API_KEY || ''}`,
    'Content-Type': 'application/json'
  }
});

// Zazzle product type mappings
const PRODUCT_CATEGORY_MAP = {
  't-shirts': 'basic_tshirt',
  'hoodies': 'hooded_sweatshirt',
  'mugs': 'mug_11oz',
  'hats': 'baseball_cap',
  'phone-cases': 'iphone_case',
  'pillows': 'throw_pillow',
  'blankets': 'woven_blanket',
  'stickers': 'sticker_4x4'
};

// Get available products from Zazzle
async function getProductCatalog() {
  try {
    const response = await zazzleClient.get('/products');
    return response.data.data || [];
  } catch (err) {
    console.error('Error fetching Zazzle products:', err.message);
    return [];
  }
}

// Get product details and variants
async function getProductVariants(productType) {
  try {
    const zazzleProductId = PRODUCT_CATEGORY_MAP[productType];
    if (!zazzleProductId) {
      throw new Error(`Unknown product type: ${productType}`);
    }

    const response = await zazzleClient.get(`/products/${zazzleProductId}`);
    const product = response.data.data;

    // Zazzle returns colors and sizes in the product details
    return {
      colors: product.colors || [],
      sizes: product.sizes || [],
      basePrice: product.basePrice,
      productId: zazzleProductId
    };
  } catch (err) {
    console.error(`Error fetching variants for ${productType}:`, err.message);
    return { colors: [], sizes: [], basePrice: 0, productId: null };
  }
}

// Create a design/product in Zazzle
async function createZazzleDesign(data) {
  try {
    const response = await zazzleClient.post('/designs', {
      external_id: data.external_id, // Link to our product ID
      name: data.name,
      description: data.description || '',
      productType: PRODUCT_CATEGORY_MAP[data.category],
      designUrl: data.design_url, // URL to uploaded design image
      colors: data.colors || [],
      sizes: data.sizes || []
    });
    return response.data.data;
  } catch (err) {
    console.error('Error creating Zazzle design:', err.message);
    throw err;
  }
}

// Create an order in Zazzle
async function createZazzleOrder(data) {
  try {
    const response = await zazzleClient.post('/orders', {
      external_id: data.external_id, // Link to our purchase/order ID
      designId: data.design_id,
      recipient: {
        name: data.customer_name,
        email: data.email,
        phone: data.phone || '',
        address: {
          line1: data.address_line1,
          line2: data.address_line2 || '',
          city: data.city,
          state: data.state,
          postalCode: data.postal_code,
          country: data.country
        }
      },
      items: data.items // Array of { quantity, size, color, etc }
    });
    return response.data.data;
  } catch (err) {
    console.error('Error creating Zazzle order:', err.message);
    throw err;
  }
}

// Get order status from Zazzle
async function getZazzleOrderStatus(zazzle_order_id) {
  try {
    const response = await zazzleClient.get(`/orders/${zazzle_order_id}`);
    return response.data.data;
  } catch (err) {
    console.error(`Error fetching Zazzle order ${zazzle_order_id}:`, err.message);
    return null;
  }
}

// Get shipping quote
async function estimateShipping(data) {
  try {
    const response = await zazzleClient.post('/shipping/estimate', {
      recipient: {
        country: data.country,
        state: data.state,
        postalCode: data.postal_code
      },
      items: data.items
    });
    return response.data.data;
  } catch (err) {
    console.error('Error estimating shipping:', err.message);
    return null;
  }
}

module.exports = {
  PRODUCT_CATEGORY_MAP,
  getProductCatalog,
  getProductVariants,
  createZazzleDesign,
  createZazzleOrder,
  getZazzleOrderStatus,
  estimateShipping
};

