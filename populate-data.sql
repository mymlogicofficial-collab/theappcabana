-- Populate TheAppCabana with realistic data

-- 1. Create a creator user
INSERT INTO users (username, email, password_hash, display_name, is_admin)
VALUES (
  'founder',
  'eubankssterling6@gmail.com',
  '$2b$10$xyz...', -- dummy hash
  'Sterling Labs',
  false
)
ON CONFLICT (username) DO NOTHING;

-- Get the user ID (should be 2 if it's the second user)
-- For this script, we'll assume user_id = 2

-- 2. Add realistic download counts to products
UPDATE products SET download_count = 145 WHERE slug = 'codeme';
UPDATE products SET download_count = 89 WHERE slug = 'fortune-spheres';
UPDATE products SET download_count = 234 WHERE slug = '50-50-tiebreaker';
UPDATE products SET download_count = 156 WHERE slug = 'fidgepop';

-- 3. Add purchases with reviews
INSERT INTO purchases (user_id, product_id, amount_paid_cents, stripe_payment_intent_id, downloaded, created_at)
SELECT 
  (row_number() % 5) + 3,
  p.id,
  99,
  'pi_test_' || p.id || '_' || (row_number()),
  true,
  NOW() - INTERVAL '1 day' * (row_number() % 14)
FROM products p, 
LATERAL generate_series(1, CASE WHEN p.slug = 'codeme' THEN 145 WHEN p.slug = 'fortune-spheres' THEN 89 WHEN p.slug = '50-50-tiebreaker' THEN 234 ELSE 156 END) AS gs(row_number)
ON CONFLICT (user_id, product_id) DO NOTHING;

-- 4. Add diverse reviews for each product
INSERT INTO reviews (product_id, user_id, rating, comment, created_at) VALUES
-- CodeME reviews
((SELECT id FROM products WHERE slug = 'codeme'), 3, 5, 'Amazing! Turned my idea into working code in minutes.', NOW() - INTERVAL '5 days'),
((SELECT id FROM products WHERE slug = 'codeme'), 4, 5, 'This is a game changer for prototyping. Love it!', NOW() - INTERVAL '4 days'),
((SELECT id FROM products WHERE slug = 'codeme'), 5, 4, 'Very useful. Sometimes the code needs tweaking but overall solid.', NOW() - INTERVAL '3 days'),
((SELECT id FROM products WHERE slug = 'codeme'), 6, 5, 'Best $0.99 I ever spent. Actually works with Python!', NOW() - INTERVAL '2 days'),
((SELECT id FROM products WHERE slug = 'codeme'), 7, 4, 'Great tool, learning a lot from the generated code.', NOW() - INTERVAL '1 day'),

-- Fortune Spheres reviews  
((SELECT id FROM products WHERE slug = 'fortune-spheres'), 3, 5, 'The personalities are hilarious! Jerri''s meh vibes are perfect.', NOW() - INTERVAL '6 days'),
((SELECT id FROM products WHERE slug = 'fortune-spheres'), 4, 5, 'Joe the investigator had me dying. Need more personality types!', NOW() - INTERVAL '5 days'),
((SELECT id FROM products WHERE slug = 'fortune-spheres'), 5, 5, 'Actually helpful for making decisions. And entertainment value 10/10', NOW() - INTERVAL '4 days'),
((SELECT id FROM products WHERE slug = 'fortune-spheres'), 6, 4, 'Fun app, though sometimes answers repeat. Still worth it!', NOW() - INTERVAL '3 days'),
((SELECT id FROM products WHERE slug = 'fortune-spheres'), 7, 5, 'My coworkers are obsessed. We settle all debates with the spheres now.', NOW() - INTERVAL '2 days'),

-- 50/50 reviews
((SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 3, 5, 'Rock Paper Scissors is smooth! Perfect for settling work bets.', NOW() - INTERVAL '7 days'),
((SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 4, 5, 'The dice roller is so satisfying. Graphics are clean.', NOW() - INTERVAL '6 days'),
((SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 5, 4, 'Good variety of tie-breakers. The number picker is addictive.', NOW() - INTERVAL '5 days'),
((SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 6, 5, 'Finally a fair way to make decisions with my team!', NOW() - INTERVAL '4 days'),
((SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 7, 4, 'Love it, though coin flip could have more animations.', NOW() - INTERVAL '3 days'),

-- FidgePop reviews
((SELECT id FROM products WHERE slug = 'fidgepop'), 3, 5, 'So satisfying! Perfect stress relief app.', NOW() - INTERVAL '8 days'),
((SELECT id FROM products WHERE slug = 'fidgepop'), 4, 5, 'The bubble wrap sound is *chef''s kiss*. Addictive!', NOW() - INTERVAL '7 days'),
((SELECT id FROM products WHERE slug = 'fidgepop'), 5, 5, 'Best fidget app I''ve tried. No lag, smooth animations.', NOW() - INTERVAL '6 days'),
((SELECT id FROM products WHERE slug = 'fidgepop'), 6, 4, 'Really nice UI. Would love more fidget types though.', NOW() - INTERVAL '5 days'),
((SELECT id FROM products WHERE slug = 'fidgepop'), 7, 5, 'My kids love this more than actual fidgets!', NOW() - INTERVAL '4 days')

ON CONFLICT (product_id, user_id) DO NOTHING;

-- 5. Update app_stats with realistic numbers
UPDATE app_stats SET 
  total_users = 624,
  total_downloads = 624,
  total_revenue_cents = 61776,
  updated_at = NOW()
WHERE id = 1;

-- Verify
SELECT 'Users' as metric, COUNT(*) as count FROM users
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'Reviews', COUNT(*) FROM reviews;
