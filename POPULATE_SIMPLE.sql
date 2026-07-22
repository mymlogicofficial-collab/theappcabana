-- EASY STEPS TO POPULATE THEAPPCABANA

-- Step 1: Create creator user (run this first)
INSERT INTO users (username, email, password_hash, display_name, is_admin)
VALUES ('founder', 'eubankssterling6@gmail.com', 'temp_hash', 'Sterling Labs', false)
ON CONFLICT DO NOTHING;

-- Step 2: Update download counts
UPDATE products SET download_count = 145 WHERE slug = 'codeme';
UPDATE products SET download_count = 89 WHERE slug = 'fortune-spheres';
UPDATE products SET download_count = 234 WHERE slug = '50-50-tiebreaker';
UPDATE products SET download_count = 156 WHERE slug = 'fidgepop';

-- Step 3: Add reviews for CodeME (copy-paste this block 5 times with different user_id 3-7)
INSERT INTO reviews (product_id, user_id, rating, comment) 
SELECT (SELECT id FROM products WHERE slug = 'codeme'), 3, 5, 'Amazing tool! Saved me hours of coding.';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'codeme'), 4, 5, 'Game changer for prototyping!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'codeme'), 5, 4, 'Very useful, great value.';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'codeme'), 6, 5, 'Best investment ever!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'codeme'), 7, 4, 'Solid tool for learning code.';

-- Step 4: Add reviews for Fortune Spheres
INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fortune-spheres'), 3, 5, 'So funny and actually helpful!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fortune-spheres'), 4, 5, 'Joe the investigator is hilarious!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fortune-spheres'), 5, 5, 'Perfect for making decisions!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fortune-spheres'), 6, 4, 'Addictive and entertaining.';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fortune-spheres'), 7, 5, 'My team loves this for settling debates!';

-- Step 5: Add reviews for 50/50
INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 3, 5, 'Rock Paper Scissors is smooth!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 4, 5, 'The dice roller is so satisfying!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 5, 4, 'Great variety of tie-breakers.';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 6, 5, 'Finally a fair way to decide!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = '50-50-tiebreaker'), 7, 4, 'Love it! Very fair for team decisions.';

-- Step 6: Add reviews for FidgePop
INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fidgepop'), 3, 5, 'So satisfying and stress-relieving!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fidgepop'), 4, 5, 'The bubble wrap sound is perfect!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fidgepop'), 5, 5, 'Best fidget app out there!';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fidgepop'), 6, 4, 'Really nice UI and smooth animations.';

INSERT INTO reviews (product_id, user_id, rating, comment)
SELECT (SELECT id FROM products WHERE slug = 'fidgepop'), 7, 5, 'My kids are obsessed with this!';

-- Step 7: Update stats
UPDATE app_stats SET total_users = 624, total_downloads = 624 WHERE id = 1;

-- DONE! All apps now have reviews and downloads populated.
