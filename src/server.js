const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const { pool, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shop');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const printfulRoutes = require('./routes/printful');

app.use('/auth', authRoutes);
app.use('/shop', shopRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/api/printful', printfulRoutes);

// Homepage
app.get('/', async (req, res) => {
  try {
    const featured = await pool.query(`
      SELECT * FROM products 
      WHERE is_approved = true 
      ORDER BY is_featured DESC, download_count DESC 
      LIMIT 12
    `);
    
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM products WHERE is_approved = true) as total_products,
        (SELECT COALESCE(SUM(download_count), 0) FROM products) as total_downloads,
        (SELECT COUNT(*) FROM users) as total_creators
    `);
    
    res.render('index', {
      products: featured.rows,
      stats: stats.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong' });
  }
});

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

async function start() {
  try {
    await initDatabase();
    console.log('Database ready, starting server...');
  } catch (err) {
    console.error('Failed to initialize database, aborting startup:', err);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TheAppCabana] Running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});

module.exports = app;

