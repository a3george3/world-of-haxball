require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// ====== POOL DB ======
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// ====== MIDDLEWARE GLOBAL ======
app.use(express.json());
app.use(cookieParser());

// Servim frontend-ul din folderul public
app.use(express.static(path.join(__dirname, 'public')));

// ====== MIDDLEWARE: AUTENTIFICARE ======
async function authRequired(req, res, next) {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: ... }
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// ====== HELPER DB QUERY ======
async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// =========================================
//              AUTH ROUTES
// =========================================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existing = await query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    await query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashed]
    );

    res.json({ message: 'User registered successfully.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const users = await query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: 'Logged in successfully.' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// LOGOUT
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out.' });
});

// INFO USER CURENT
app.get('/api/auth/me', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const users = await query(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(users[0]);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// =========================================
//              LEAGUE RANKING
// =========================================

app.get('/api/leagues/ranking', async (req, res) => {
  try {
    const rows = await query(
      `
      SELECT 
        l.id,
        l.name,
        l.region,
        l.map_name,
        l.discord_link,
        COUNT(v.id) AS votes_today
      FROM leagues l
      LEFT JOIN league_votes v
        ON l.id = v.league_id
       AND v.vote_date = CURDATE()
      GROUP BY l.id
      ORDER BY votes_today DESC, l.name ASC
      LIMIT 10
      `
    );

    res.json(rows);
  } catch (err) {
    console.error('Ranking error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// =========================================
//              VOTARE LIGĂ
// =========================================

app.post('/api/leagues/:leagueId/vote', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const leagueId = parseInt(req.params.leagueId, 10);

    if (Number.isNaN(leagueId)) {
      return res.status(400).json({ message: 'Invalid league id.' });
    }

    const leagues = await query(
      'SELECT id FROM leagues WHERE id = ?',
      [leagueId]
    );
    if (leagues.length === 0) {
      return res.status(404).json({ message: 'League not found.' });
    }

    try {
      await query(
        'INSERT INTO league_votes (user_id, league_id, vote_date) VALUES (?, ?, CURDATE())',
        [userId, leagueId]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          message: 'You already voted today. Come back tomorrow!'
        });
      }
      throw err;
    }

    res.json({ message: 'Vote recorded successfully.' });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// =========================================
//   FALLBACK: trimitem index.html pentru /
// =========================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================================
//              PORNIRE SERVER
// =========================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});