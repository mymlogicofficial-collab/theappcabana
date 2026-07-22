const https = require('https');

const PRINTFUL_API_URL = 'https://api.printful.com';
const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;

if (!PRINTFUL_API_KEY) {
  console.warn('WARNING: PRINTFUL_API_KEY not set. Printful integration will not work.');
}

// Helper to make HTTPS requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PRINTFUL_API_URL);
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`Printful API error: ${res.statusCode} ${JSON.stringify(result)}`));
          } else {
            resolve(result);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Printful product ID mappings (catalog products)
const PRODUCT_TYPE_MAP = {
  't-shirts': 1,
  'hoodies': 18,
  'sweatshirts': 28,
  'mugs': 10,
  'hats': 33,
  'beanies': 34,
  'phone-cases': 46,
  'pillows': 48,
  'blankets': 47,
  'stickers': 36,
  'tote-bags': 49
};

/**
 * Get all available products from Printful catalog
 */
async function getProductCatalog() {
  try {
    const response = await makeRequest('GET', '/catalog/products');
    return response.result || [];
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

    const response = await makeRequest('GET', `/catalog/products/${productId}`);
    const product = response.result;

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
 * Create a product in your Printful store (simple version - just create product without variants)
 */
async function createPrintfulProduct(data) {
  try {
    const productId = PRODUCT_TYPE_MAP[data.category];
    if (!productId) {
      throw new Error(`Unknown product category: ${data.category}`);
    }

    console.log(`[Printful] Creating product: ${data.name} (catalog product ${productId})`);

    // For now, just create a simple store product
    // In a real implementation, you'd add the image to Printful first
    // and then create a product with it
    const response = await makeRequest('POST', '/store/products', {
      external_id: data.external_id,
      name: data.name,
      description: data.description || ''
    });

    console.log(`[Printful] Product created with ID: ${response.result.id}`);
    return response.result;
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
    const response = await makeRequest('GET', `/store/products/${printfulProductId}`);
    return response.result;
  } catch (err) {
    console.error(`Error fetching Printful product ${printfulProductId}:`, err.message);
    return null;
  }
}

/**
 * Create an order in Printful
 */
async function createPrintfulOrder(data) {
  try {
    const response = await makeRequest('POST', '/orders', {
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

    return response.result;
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
    const response = await makeRequest('GET', `/orders/${printfulOrderId}`);
    return response.result;
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
    const response = await makeRequest('POST', '/shipping/rates', {
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

    return response.result;
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
    const response = await makeRequest('POST', `/orders/${printfulOrderId}/confirm`);
    return response.result;
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
  createPrintfulOrder,
  getPrintfulOrderStatus,
  estimateShipping,
  confirmOrder
};

