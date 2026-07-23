const axios = require('axios');

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_API_BASE = 'https://api.printful.com';

// Simple product type mappings
const PRODUCT_MAPPING = {
  'sticker_3x3': 285,
  'sticker_4x4': 286,
  'sticker_5x5': 287,
  'shirt': 1,
  'hat': 15,
  'mug': 4,
  'blanket': 73,
  'sweater': 10
};

async function createPrintfulProduct(imageUrl, productType, productName) {
  try {
    const productId = PRODUCT_MAPPING[productType];
    if (!productId) {
      throw new Error(`Unknown product type: ${productType}`);
    }

    // Minimal payload - just product + variant with image URL
    const payload = {
      external_id: `${productName.replace(/\s+/g, '-')}-${productType}-${Date.now()}`,
      name: `${productName} - ${productType}`,
      variants: [
        {
          external_id: `var-${productType}`,
          product_id: productId,
          files: [
            {
              type: 'default',
              url: imageUrl
            }
          ]
        }
      ]
    };

    const response = await axios.post(`${PRINTFUL_API_BASE}/products`, payload, {
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data.result && response.data.result.id) {
      return {
        printful_id: response.data.result.id,
        url: `https://www.printful.com/dashboard/products/${response.data.result.id}`
      };
    }
    throw new Error('No product ID in response');
  } catch (err) {
    console.error(`[Printful] Error creating ${productType}:`, err.response?.data?.error || err.message);
    return null;
  }
}

async function createPrintfulProductsForMerch(imageUrl, productName) {
  try {
    const results = {};
    
    for (const [key] of Object.entries(PRODUCT_MAPPING)) {
      try {
        const product = await createPrintfulProduct(imageUrl, key, productName);
        if (product) {
          results[key] = product;
          console.log(`[Printful] ✓ Created ${key} product: ${product.printful_id}`);
        }
      } catch (err) {
        console.warn(`[Printful] ✗ Skipped ${key}:`, err.message);
      }
    }

    return results;
  } catch (err) {
    console.error('[Printful] Fatal error:', err.message);
    return {};
  }
}

module.exports = { createPrintfulProductsForMerch };
