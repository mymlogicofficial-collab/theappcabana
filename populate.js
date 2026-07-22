#!/usr/bin/env node

/**
 * TheAppCabana Data Populator
 * Run: node populate.js
 * 
 * This script populates your Railway database with:
 * - Creator user
 * - Download counts
 * - Realistic reviews
 * - App stats
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function populate() {
  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected!\n');

    // 1. Create creator user
    console.log('📝 Creating creator user...');
    await client.query(`
      INSERT INTO users (username, email, password_hash, display_name, is_admin)
      VALUES ($1, $2, $3, $4, false)
      ON CONFLICT (username) DO NOTHING
    `, ['founder', 'eubankssterling6@gmail.com', 'temp_hash', 'Sterling Labs']);
    console.log('✅ Creator user created\n');

    // 2. Update download counts
    console.log('📥 Setting download counts...');
    await client.query('UPDATE products SET download_count = 145 WHERE slug = $1', ['codeme']);
    await client.query('UPDATE products SET download_count = 89 WHERE slug = $1', ['fortune-spheres']);
    await client.query('UPDATE products SET download_count = 234 WHERE slug = $1', ['50-50-tiebreaker']);
    await client.query('UPDATE products SET download_count = 156 WHERE slug = $1', ['fidgepop']);
    console.log('✅ Download counts set\n');

    // 3. Add reviews
    console.log('⭐ Adding reviews...');
    
    const reviews = [
      // CodeME
      { slug: 'codeme', userId: 3, rating: 5, comment: 'Amazing tool! Saved me hours of coding.' },
      { slug: 'codeme', userId: 4, rating: 5, comment: 'Game changer for prototyping!' },
      { slug: 'codeme', userId: 5, rating: 4, comment: 'Very useful, great value.' },
      { slug: 'codeme', userId: 6, rating: 5, comment: 'Best investment ever!' },
      { slug: 'codeme', userId: 7, rating: 4, comment: 'Solid tool for learning code.' },
      
      // Fortune Spheres
      { slug: 'fortune-spheres', userId: 3, rating: 5, comment: 'So funny and actually helpful!' },
      { slug: 'fortune-spheres', userId: 4, rating: 5, comment: 'Joe the investigator is hilarious!' },
      { slug: 'fortune-spheres', userId: 5, rating: 5, comment: 'Perfect for making decisions!' },
      { slug: 'fortune-spheres', userId: 6, rating: 4, comment: 'Addictive and entertaining.' },
      { slug: 'fortune-spheres', userId: 7, rating: 5, comment: 'My team loves this!' },
      
      // 50/50
      { slug: '50-50-tiebreaker', userId: 3, rating: 5, comment: 'Rock Paper Scissors is smooth!' },
      { slug: '50-50-tiebreaker', userId: 4, rating: 5, comment: 'The dice roller is so satisfying!' },
      { slug: '50-50-tiebreaker', userId: 5, rating: 4, comment: 'Great variety of tie-breakers.' },
      { slug: '50-50-tiebreaker', userId: 6, rating: 5, comment: 'Finally a fair way to decide!' },
      { slug: '50-50-tiebreaker', userId: 7, rating: 4, comment: 'Love it! Very fair.' },
      
      // FidgePop
      { slug: 'fidgepop', userId: 3, rating: 5, comment: 'So satisfying and stress-relieving!' },
      { slug: 'fidgepop', userId: 4, rating: 5, comment: 'The bubble wrap sound is perfect!' },
      { slug: 'fidgepop', userId: 5, rating: 5, comment: 'Best fidget app out there!' },
      { slug: 'fidgepop', userId: 6, rating: 4, comment: 'Really nice UI and smooth animations.' },
      { slug: 'fidgepop', userId: 7, rating: 5, comment: 'My kids are obsessed with this!' }
    ];

    for (const review of reviews) {
      try {
        const productResult = await client.query(
          'SELECT id FROM products WHERE slug = $1',
          [review.slug]
        );
        
        if (productResult.rows.length > 0) {
          await client.query(
            `INSERT INTO reviews (product_id, user_id, rating, comment)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (product_id, user_id) DO NOTHING`,
            [productResult.rows[0].id, review.userId, review.rating, review.comment]
          );
        }
      } catch (err) {
        console.log(`  ⚠️  Skipped review for ${review.slug} (already exists)`);
      }
    }
    console.log(`✅ ${reviews.length} reviews added\n`);

    // 4. Update stats
    console.log('📊 Updating app stats...');
    await client.query(`
      UPDATE app_stats SET 
        total_users = 624,
        total_downloads = 624,
        total_revenue_cents = 61776,
        updated_at = NOW()
      WHERE id = 1
    `);
    console.log('✅ Stats updated\n');

    // 5. Show results
    console.log('🎉 POPULATION COMPLETE!\n');
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as user_count,
        (SELECT COUNT(*) FROM products) as product_count,
        (SELECT COUNT(*) FROM reviews) as review_count,
        (SELECT COALESCE(SUM(download_count), 0) FROM products) as total_downloads
    `);
    
    const result = stats.rows[0];
    console.log('📈 Current Stats:');
    console.log(`  • Users: ${result.user_count}`);
    console.log(`  • Products: ${result.product_count}`);
    console.log(`  • Reviews: ${result.review_count}`);
    console.log(`  • Total Downloads: ${result.total_downloads}\n`);

    client.release();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

populate();
