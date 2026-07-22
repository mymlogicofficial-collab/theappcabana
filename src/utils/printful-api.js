const axios = require('axios');

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_API_BASE = 'https://api.printful.com';

// Product type mappings to Printful product IDs
const PRODUCT_MAPPING = {
  'sticker_3x3': { printful_id: 285, name: '3x3 Sticker' },
  'sticker_4x4': { printful_id: 286, name: '4x4 Sticker' },
  'sticker_5x5': { printful_id: 287, name: '5x5 Sticker' },
  'shirt': { printful_id: 1, name: 'T-Shirt' },
  'hat': { printful_id: 15, name: 'Trucker Hat' },
  'mug': { printful_id: 4, name: 'Mug' },
  'blanket': { printful_id: 73, name: 'Throw Blanket' },
  'sweater': { printful_id: 10, name: 'Sweatshirt' }
};

async function createPrintfulProduct(imageUrl, productType, productName) {
  try {
    const productInfo = PRODUCT_MAPPING[productType];
    if (!productInfo) {
      throw new Error(`Unknown product type: ${productType}`);
    }

    const payload = {
      external_id: `${productName}-${productType}-${Date.now()}`,
      name: `${productName} - ${productInfo.name}`,
      variants: [
        {
          name: productInfo.name,
          sku: `${productName}-${productType}`,
          product_id: productInfo.printful_id,
          print_areas: {
            front: {
              type: 'default',
              images: [
                {
                  url: imageUrl,
                  placement: 'front'
                }
              ]
            }
          }
        }
      ]
    };

    const response = await axios.post(`${PRINTFUL_API_BASE}/products`, payload, {
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.result;
  } catch (err) {
    console.error(`[Printful] Failed to create ${productType} product:`, err.response?.data || err.message);
    throw err;
  }
}

async function createPrintfulProductsForMerch(imageUrl, productName, baseUrl) {
  try {
    const results = {};
    
    // Create Printful product for each merch type
    for (const [key, info] of Object.entries(PRODUCT_MAPPING)) {
      try {
        // Use the resized image URL from your server
        const fullImageUrl = `${baseUrl}/uploads/merch/${productName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${key}.png`;
        
        const product = await createPrintfulProduct(fullImageUrl, key, productName);
        results[key] = {
          printful_id: product.id,
          name: product.name,
          url: `https://www.printful.com/dashboard/products/${product.id}`
        };
        console.log(`[Printful] Created ${key} product: ${product.id}`);
      } catch (err) {
        console.warn(`[Printful] Failed to create ${key} product:`, err.message);
      }
    }

    return results;
  } catch (err) {
    console.error('[Printful] Failed to create merch products:', err.message);
    return {}; // Return empty on complete failure, don't crash
  }
}

module.exports = { createPrintfulProduct, createPrintfulProductsForMerch };
