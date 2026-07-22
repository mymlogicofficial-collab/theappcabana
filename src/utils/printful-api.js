const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

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

async function uploadDesignToPrintful(imagePath, designName) {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));
    formData.append('filename', path.basename(imagePath));

    const response = await axios.post(`${PRINTFUL_API_BASE}/files`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`
      }
    });

    return response.data.result.id;
  } catch (err) {
    console.error('[Printful] Failed to upload design:', err.message);
    throw err;
  }
}

async function createPrintfulProduct(designFileId, productType, productName) {
  try {
    const productInfo = PRODUCT_MAPPING[productType];
    if (!productInfo) {
      throw new Error(`Unknown product type: ${productType}`);
    }

    const payload = {
      external_id: `${productName}-${productType}-${Date.now()}`,
      name: `${productName} - ${productInfo.name}`,
      product_id: productInfo.printful_id,
      variants: [
        {
          external_id: `${productType}-var-1`,
          product_id: productInfo.printful_id,
          files: [
            {
              type: 'default',
              url: designFileId // or upload_file_id if using file ID
            }
          ]
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
    console.error('[Printful] Failed to create product:', err.message);
    throw err;
  }
}

async function createPrintfulProductsForMerch(imagePath, productName) {
  try {
    const results = {};
    
    // Upload design once
    const designFileId = await uploadDesignToPrintful(imagePath, productName);
    console.log(`[Printful] Uploaded design: ${designFileId}`);

    // Create Printful product for each merch type
    for (const [key, info] of Object.entries(PRODUCT_MAPPING)) {
      try {
        const product = await createPrintfulProduct(designFileId, key, productName);
        results[key] = {
          printful_id: product.id,
          name: product.name,
          url: product.display_url || `https://www.printful.com/dashboard/products/${product.id}`
        };
        console.log(`[Printful] Created ${key} product: ${product.id}`);
      } catch (err) {
        console.warn(`[Printful] Failed to create ${key} product:`, err.message);
      }
    }

    return results;
  } catch (err) {
    console.error('[Printful] Failed to create merch products:', err.message);
    throw err;
  }
}

module.exports = { uploadDesignToPrintful, createPrintfulProduct, createPrintfulProductsForMerch };
