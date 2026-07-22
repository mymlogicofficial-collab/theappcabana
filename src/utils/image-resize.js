const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Optimal DPI and dimensions for Printful products
const MERCH_SPECS = {
  sticker_3x3: { width: 900, height: 900, dpi: 300, name: '3x3 Sticker' },
  sticker_4x4: { width: 1200, height: 1200, dpi: 300, name: '4x4 Sticker' },
  sticker_5x5: { width: 1500, height: 1500, dpi: 300, name: '5x5 Sticker' },
  shirt: { width: 1200, height: 1500, dpi: 300, name: 'Shirt Print' },
  hat: { width: 1000, height: 800, dpi: 300, name: 'Hat Print' },
  mug: { width: 1500, height: 1200, dpi: 300, name: 'Mug Wrap' },
  blanket: { width: 2400, height: 3200, dpi: 300, name: 'Throw Blanket' },
};

async function resizeForMerch(inputPath, productType = 'shirt') {
  try {
    const specs = MERCH_SPECS[productType] || MERCH_SPECS.shirt;
    const outputDir = path.join(__dirname, '../public/uploads/merch');
    
    // Create merch directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(outputDir, `${filename}-${productType}.png`);
    
    // Resize image to optimal dimensions with padding if needed
    await sharp(inputPath)
      .resize(specs.width, specs.height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }, // White background for padding
      })
      .png({ quality: 95 })
      .toFile(outputPath);
    
    return `/uploads/merch/${path.basename(outputPath)}`;
  } catch (err) {
    console.error(`[ImageResize] Failed to resize for ${productType}:`, err.message);
    throw err;
  }
}

async function resizeAllMerchVariants(inputPath, excludeTypes = []) {
  try {
    const variants = {};
    
    for (const [key, specs] of Object.entries(MERCH_SPECS)) {
      if (excludeTypes.includes(key)) continue;
      
      const outputDir = path.join(__dirname, '../public/uploads/merch');
      await fs.mkdir(outputDir, { recursive: true });
      
      const filename = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(outputDir, `${filename}-${key}.png`);
      
      await sharp(inputPath)
        .resize(specs.width, specs.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png({ quality: 95 })
        .toFile(outputPath);
      
      variants[key] = `/uploads/merch/${path.basename(outputPath)}`;
    }
    
    return variants;
  } catch (err) {
    console.error('[ImageResize] Failed to resize all variants:', err.message);
    throw err;
  }
}

module.exports = { resizeForMerch, resizeAllMerchVariants, MERCH_SPECS };
