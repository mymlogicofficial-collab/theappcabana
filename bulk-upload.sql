-- TheAppCabana: Bulk Upload CodeME + Fortune Spheres
-- Run this SQL against your Railway PostgreSQL database

-- CodeME
INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, is_approved, download_count)
VALUES (
  1, 
  'app', 
  'CodeME',
  'codeme',
  'AI-powered code translator. Convert English to Code, Code to English explanations, get language recommendations, and test your generated code. Supports 25+ programming languages with real-time streaming and voice input.',
  1999,
  '/uploads/codeme-1.0.0.zip',
  true,
  0
)
ON CONFLICT (slug) DO NOTHING;

-- Fortune Spheres
INSERT INTO products (user_id, type, title, slug, description, price_cents, file_path, is_approved, download_count)
VALUES (
  1,
  'app',
  'Fortune Spheres',
  'fortune-spheres',
  'Eight mystical spheres with wildly different personalities. Becky the anxious worrier, Tiff the astro-fashion guru, Luna the mystic, Ziggy the chaos agent, Oracle the truthteller, Seth the chill stoner philosopher, Joe the source-obsessed investigator, and Jerri the complementary meh mystic. Ask questions and get responses from your chosen sphere. Auto-grab feature randomly picks a different sphere every ~9 questions. Bonus: 10% chance of detecting unexpected atmospheric phenomena. 20+ unique responses per personality.',
  999,
  '/uploads/fortune-spheres-1.0.0.zip',
  true,
  0
)
ON CONFLICT (slug) DO NOTHING;

-- Verify insertion
SELECT title, slug, price_cents, is_approved, file_path FROM products WHERE slug IN ('codeme', 'fortune-spheres');
