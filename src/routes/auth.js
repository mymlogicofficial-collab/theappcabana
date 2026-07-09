const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const router = express.Router();

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/register', { error: null });
});

router.post('/register', async (req, res) => {
  const { username, email, password, display_name } = req.body;
  
  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (existing.rows.length > 0) {
      return res.render('auth/register', { error: 'Username or email already taken' });
    }
    
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING id, username, email, display_name',
      [username, email, hash, display_name || username]
    );
    
    const user = result.rows[0];
    req.session.user = user;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('auth/register', { error: 'Something went wrong' });
  }
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.render('auth/login', { error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.render('auth/login', { error: 'Invalid email or password' });
    }
    
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      is_admin: user.is_admin
    };
    
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('auth/login', { error: 'Something went wrong' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
