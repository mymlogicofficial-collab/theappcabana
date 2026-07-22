-- The App Cabana - Complete Seed Data
-- Populates the database with realistic test data

-- Clear existing data
TRUNCATE TABLE reviews CASCADE;
TRUNCATE TABLE purchases CASCADE;
TRUNCATE TABLE physical_orders CASCADE;
TRUNCATE TABLE physical_products CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE users CASCADE;

-- Create test users (sellers)
INSERT INTO users (username, email, password_hash, display_name, is_admin, created_at)
VALUES 
  ('sterling', 'eubankssterling6@gmail.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'Sterling Eubanks', true, NOW()),
  ('dj_beats', 'dj@theappcabana.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'DJ Beats', false, NOW()),
  ('pixel_artist', 'pixel@theappcabana.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'Pixel Artist', false, NOW()),
  ('dev_studio', 'dev@theappcabana.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'Dev Studio', false, NOW()),
  ('ambient_sounds', 'ambient@theappcabana.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YGIOQYs8dHha', 'Ambient Sounds', false, NOW());

-- Create digital products (Music) - APPROVED
INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, preview_url, download_count, is_featured, is_approved, created_at)
VALUES 
  (2, 'music', 'Midnight Vibes - Lo-Fi Hip Hop', 'midnight-vibes-lofi-hiphop', 'Chill lo-fi hip hop beat perfect for studying or relaxing. 5-minute track with mellow vibes and smooth instrumentation.', 99, '/uploads/midnight-vibes.mp3', '/uploads/midnight-vibes-cover.jpg', '/uploads/preview-midnight-vibes.mp3', 127, true, true, NOW()),
  (2, 'music', 'Neon Dreams - Synthwave', 'neon-dreams-synthwave', 'A synthwave masterpiece with 80s aesthetic and modern production. Perfect for gaming, streaming, or just vibing out.', 99, '/uploads/neon-dreams.mp3', '/uploads/neon-dreams-cover.jpg', '/uploads/preview-neon-dreams.mp3', 89, true, true, NOW()),
  (5, 'music', 'Forest Meditation - Ambient', 'forest-meditation-ambient', 'Peaceful ambient soundscape featuring natural forest sounds, gentle piano, and soothing textures. Great for meditation and focus.', 99, '/uploads/forest-meditation.mp3', '/uploads/forest-meditation-cover.jpg', '/uploads/preview-forest-meditation.mp3', 243, true, true, NOW());

-- Create digital products (Art) - APPROVED
INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, download_count, is_featured, is_approved, created_at)
VALUES 
  (3, 'art', 'Retro Pixel Art Bundle - 16 Assets', 'retro-pixel-art-bundle-16-assets', 'Complete set of retro pixel art assets including characters, tiles, and UI elements. Perfect for indie games and pixel art projects.', 1499, '/uploads/pixel-art-bundle.zip', '/uploads/pixel-art-thumb.jpg', 45, true, true, NOW()),
  (3, 'art', 'Abstract Watercolor Textures - 20 PNGs', 'abstract-watercolor-textures-20', 'High-resolution watercolor texture pack with 20 unique abstract backgrounds. Great for design projects, presentations, and digital art.', 899, '/uploads/watercolor-textures.zip', '/uploads/watercolor-thumb.jpg', 67, false, true, NOW()),
  (3, 'art', 'Cyberpunk UI Kit - Figma File', 'cyberpunk-ui-kit-figma', 'Complete UI kit with 150+ components designed for cyberpunk-themed applications. Includes buttons, cards, modals, and more. Fully editable in Figma.', 2499, '/uploads/cyberpunk-ui-kit.fig', '/uploads/cyberpunk-ui-thumb.jpg', 34, true, true, NOW());

-- Create digital products (Apps) - APPROVED
INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, download_count, is_featured, is_approved, created_at)
VALUES 
  (4, 'app', 'Budget Tracker Pro - Windows', 'budget-tracker-pro-windows', 'Lightweight desktop app for managing your personal budget. Track expenses, set goals, and visualize spending patterns. Windows only, single license.', 1999, '/uploads/budget-tracker-pro.exe', '/uploads/budget-tracker-thumb.jpg', 156, true, true, NOW()),
  (4, 'app', 'Pomodoro Timer - Multi-Platform', 'pomodoro-timer-multi-platform', 'Simple and elegant Pomodoro timer for Windows, Mac, and Linux. Boost productivity with customizable work/break intervals and notifications.', 99, '/uploads/pomodoro-timer.zip', '/uploads/pomodoro-thumb.jpg', 298, true, true, NOW());

-- Create physical products - APPROVED
INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, cover_url, printful_category, is_featured, is_approved, created_at)
VALUES 
  (3, 'physical', 'Pixel Art Design - T-Shirt', 'pixel-art-design-tshirt', 'High-quality printed t-shirt featuring retro pixel art design. Available in multiple sizes and colors. Printed on demand via Printful.', 1999, '/uploads/pixel-art-design.png', '/uploads/pixel-art-design.png', 't-shirts', true, true, NOW()),
  (2, 'physical', 'DJ Beats Logo - Baseball Cap', 'dj-beats-logo-baseball-cap', 'Classic baseball cap with embroidered DJ Beats logo. Perfect for music lovers and festival-goers. Adjustable fit, high-quality stitching.', 1499, '/uploads/dj-beats-logo.png', '/uploads/dj-beats-logo.png', 'hats', true, true, NOW()),
  (2, 'physical', 'Midnight Vibes - Coffee Mug', 'midnight-vibes-coffee-mug', 'Beautiful ceramic mug with Midnight Vibes album artwork. Perfect for your morning coffee while listening to lo-fi beats. Microwave and dishwasher safe.', 999, '/uploads/midnight-vibes-mug.png', '/uploads/midnight-vibes-mug.png', 'mugs', false, true, NOW());

-- Create sample reviews
INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
VALUES 
  (1, 2, 5, 'Amazing lo-fi beats! Perfect for studying. Will definitely buy more from this artist.', NOW() - interval '30 days'),
  (1, 3, 5, 'Great quality, exactly what I was looking for. Highly recommended!', NOW() - interval '25 days'),
  (2, 2, 4, 'Really nice synthwave vibes, though a bit short. Would love an extended version.', NOW() - interval '20 days'),
  (3, 3, 5, 'Perfect for meditation and relaxation. Very calming and professional production.', NOW() - interval '15 days'),
  (4, 1, 5, 'Excellent pixel art pack! Great for game development. Good value for money.', NOW() - interval '10 days'),
  (5, 1, 4, 'Nice watercolor textures, very useful for my design projects.', NOW() - interval '8 days'),
  (6, 4, 5, 'This UI kit saved me so much time! Highly detailed and well organized.', NOW() - interval '5 days'),
  (7, 2, 5, 'Love this app! Makes budgeting so easy and the interface is clean.', NOW() - interval '3 days'),
  (8, 1, 5, 'Pomodoro timer works perfectly. Simple, effective, no bloatware.', NOW() - interval '2 days'),
  (1, 4, 5, 'Best purchase ever! Using it every day while working.', NOW()),
  (2, 5, 4, 'Great synthwave production. Love the retro feel!', NOW()),
  (3, 2, 5, 'This ambient music is my new favorite for focus sessions.', NOW()),
  (7, 3, 5, 'Budget tracker is a lifesaver. Finally understand my spending!', NOW()),
  (8, 4, 4, 'Good timer app. Does exactly what it should.', NOW());

-- Summary
SELECT 
  'TEST DATA CREATED:' as section,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM products WHERE is_approved = true) as approved_products,
  (SELECT COUNT(*) FROM products WHERE is_approved = false) as pending_products,
  (SELECT COUNT(*) FROM reviews) as total_reviews,
  (SELECT SUM(download_count) FROM products) as total_downloads;

