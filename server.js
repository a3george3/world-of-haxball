require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== POOL DB ======
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// ====== MIDDLEWARE GLOBAL ======
app.use(express.json());
app.use(cookieParser());

// Servim frontend-ul din folderul public
app.use(express.static(path.join(__dirname, "public")));

// ====== MIDDLEWARE: AUTENTIFICARE ======
async function authRequired(req, res, next) {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: ... }
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
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
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existing = await query(
      "SELECT id FROM users WHERE email = ? OR username = ?",
      [email, username],
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "User already exists." });
    }

    const hashed = await bcrypt.hash(password, 10);

    await query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashed],
    );

    res.json({ message: "User registered successfully." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const users = await query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { id: user.id, is_admin: !!user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: "Logged in successfully." });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// LOGOUT
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out." });
});

// INFO USER CURENT
app.get("/api/auth/me", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const users = await query(
      "SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?",
      [userId],
    );
    if (users.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json(users[0]);
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// =========================================
//              LEAGUE RANKING
// =========================================

// Top 5 – ALL-TIME votes (nu se mai resetează zilnic)
app.get("/api/leagues/ranking", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        l.id,
        l.name,
        l.region,
        l.map_name,
        l.discord_link,
        l.logo_url,
        COALESCE(COUNT(v.id), 0) AS votes_today
      FROM leagues l
      LEFT JOIN league_votes v 
        ON v.league_id = l.id
      GROUP BY l.id
      ORDER BY votes_today DESC, l.created_at DESC
      LIMIT 5
      `,
    );

    res.json(rows);
  } catch (err) {
    console.error("Error loading ranking:", err);
    res.status(500).json({ message: "Error loading ranking" });
  }
});

// Full ranking – ALL-TIME votes
app.get("/api/leagues/ranking/full", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        l.id,
        l.name,
        l.region,
        l.map_name,
        l.discord_link,
        l.logo_url,
        COALESCE(COUNT(v.id), 0) AS votes_today
      FROM leagues l
      LEFT JOIN league_votes v 
        ON v.league_id = l.id
      GROUP BY l.id
      ORDER BY votes_today DESC, l.created_at DESC
      `,
    );

    res.json(rows);
  } catch (err) {
    console.error("Error loading full ranking:", err);
    res.status(500).json({ message: "Error loading full ranking" });
  }
});

// GET /api/leagues/ranking/full
app.get("/api/leagues/ranking/full", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        l.id,
        l.name,
        l.region,
        l.map_name,
        l.discord_link,
        l.logo_url,
        COALESCE(COUNT(v.id), 0) AS votes_today
      FROM leagues l
      LEFT JOIN league_votes v 
        ON v.league_id = l.id
        AND DATE(v.vote_date) = CURDATE()
      GROUP BY l.id
      ORDER BY votes_today DESC, l.created_at DESC
      `,
    );

    res.json(rows);
  } catch (err) {
    console.error("Error loading full ranking:", err);
    res.status(500).json({ message: "Error loading full ranking" });
  }
});

// =========================================
//              VOTARE LIGĂ
// =========================================

app.post("/api/leagues/:leagueId/vote", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const leagueId = parseInt(req.params.leagueId, 10);

    if (Number.isNaN(leagueId)) {
      return res.status(400).json({ message: "Invalid league id." });
    }

    const leagues = await query("SELECT id FROM leagues WHERE id = ?", [
      leagueId,
    ]);
    if (leagues.length === 0) {
      return res.status(404).json({ message: "League not found." });
    }

    try {
      await query(
        "INSERT INTO league_votes (user_id, league_id, vote_date) VALUES (?, ?, CURDATE())",
        [userId, leagueId],
      );
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({
          message: "You already voted today. Come back tomorrow!",
        });
      }
      throw err;
    }

    res.json({ message: "Vote recorded successfully." });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// =========================================
//              FORUM: THREADS
// =========================================

// GET /api/forum/threads  -> listă discuții (cu paginare)
app.get("/api/forum/threads", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;

    // protecție mică – nu lăsăm limit uriaș
    const pageSize = Math.min(Math.max(limit, 1), 50);
    const offset = (page - 1) * pageSize;

    // total threads (fără join-uri)
    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM forum_threads",
    );
    const total = countRows[0]?.total || 0;

    const [rows] = await pool.query(
      `
      SELECT 
        t.id,
        t.title,
        t.body,
        t.reply_count,
        t.is_pinned,
        t.is_locked,
        t.created_at,
        u.username AS author,
        lr_info.last_reply_at,
        lr.username AS last_reply_author
      FROM forum_threads t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN (
        SELECT 
          fr.thread_id,
          fr.user_id,
          fr.created_at AS last_reply_at
        FROM forum_replies fr
        INNER JOIN (
          SELECT thread_id, MAX(created_at) AS max_created_at
          FROM forum_replies
          GROUP BY thread_id
        ) frmax
          ON fr.thread_id = frmax.thread_id
         AND fr.created_at = frmax.max_created_at
      ) AS lr_info
        ON lr_info.thread_id = t.id
      LEFT JOIN users lr
        ON lr.id = lr_info.user_id
      ORDER BY
        t.is_pinned DESC,
        COALESCE(lr_info.last_reply_at, t.created_at) DESC
      LIMIT ? OFFSET ?
      `,
      [pageSize, offset],
    );

    res.json({
      threads: rows,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("Error loading forum threads:", err);
    res.status(500).json({ message: "Error loading forum threads" });
  }
});

// POST /api/forum/threads  -> creează un thread nou (doar logat)
app.post("/api/forum/threads", authRequired, async (req, res) => {
  const { title, body } = req.body;
  const userId = req.user.id;

  const cleanTitle = (title || "").trim();
  const cleanBody = (body || "").trim();

  if (!cleanTitle || !cleanBody) {
    return res.status(400).json({ message: "Title and body are required" });
  }

  // 🔒 limită titlu: max 80 caractere
  if (cleanTitle.length > 80) {
    return res
      .status(400)
      .json({ message: "Title must be at most 80 characters." });
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO forum_threads (user_id, title, body)
      VALUES (?, ?, ?)
      `,
      [userId, cleanTitle, cleanBody],
    );

    res.status(201).json({
      ok: true,
      id: result.insertId,
      message: "Thread created successfully",
    });
  } catch (err) {
    console.error("Error creating thread:", err);
    res.status(500).json({ message: "Error creating thread" });
  }
});

// GET /api/forum/threads/:id  -> un thread + reply-urile lui
app.get("/api/forum/threads/:id", async (req, res) => {
  const threadId = req.params.id;

  try {
    const [threads] = await pool.query(
      `
      SELECT 
        t.id,
        t.title,
        t.body,
        t.reply_count,
        t.is_pinned,
        t.is_locked,
        t.created_at,
        u.username AS author
      FROM forum_threads t
      JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
      `,
      [threadId],
    );

    if (threads.length === 0) {
      return res.status(404).json({ message: "Thread not found" });
    }

    const [replies] = await pool.query(
      `
      SELECT 
        r.id,
        r.body,
        r.created_at,
        r.parent_reply_id,
        u.username AS author,
        pr.id AS parent_id,
        pr.body AS parent_body,
        up.username AS parent_author
      FROM forum_replies r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN forum_replies pr
        ON pr.id = r.parent_reply_id
      LEFT JOIN users up
        ON up.id = pr.user_id
      WHERE r.thread_id = ?
      ORDER BY r.created_at ASC
      `,
      [threadId],
    );

    res.json({
      thread: threads[0],
      replies,
    });
  } catch (err) {
    console.error("Error loading thread:", err);
    res.status(500).json({ message: "Error loading thread" });
  }
});

// POST /api/forum/threads/:id/replies  -> adaugă reply (doar logat)
app.post("/api/forum/threads/:id/replies", authRequired, async (req, res) => {
  const threadId = req.params.id;
  const userId = req.user.id;
  const { body, parentReplyId } = req.body;

  const cleanBody = (body || "").trim();
  if (!cleanBody) {
    return res.status(400).json({ message: "Reply body is required" });
  }

  // parentReplyId este opțional
  const parentId =
    parentReplyId && !Number.isNaN(Number(parentReplyId))
      ? Number(parentReplyId)
      : null;

  try {
    const [threads] = await pool.query(
      `SELECT id, is_locked FROM forum_threads WHERE id = ?`,
      [threadId],
    );
    if (threads.length === 0) {
      return res.status(404).json({ message: "Thread not found" });
    }
    if (threads[0].is_locked) {
      return res.status(403).json({ message: "Thread is locked" });
    }

    await pool.query(
      `
      INSERT INTO forum_replies (thread_id, parent_reply_id, user_id, body)
      VALUES (?, ?, ?, ?)
      `,
      [threadId, parentId, userId, cleanBody],
    );

    await pool.query(
      `
      UPDATE forum_threads
      SET reply_count = reply_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [threadId],
    );

    res.status(201).json({ ok: true, message: "Reply added successfully" });
  } catch (err) {
    console.error("Error adding reply:", err);
    res.status(500).json({ message: "Error adding reply" });
  }
});

// DELETE /api/forum/threads/:id  -> doar ADMIN
app.delete(
  "/api/forum/threads/:id",
  authRequired,
  adminRequired,
  async (req, res) => {
    const threadId = req.params.id;

    try {
      const [result] = await pool.query(
        `DELETE FROM forum_threads WHERE id = ?`,
        [threadId],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // replies se șterg automat (ON DELETE CASCADE)
      res.json({ ok: true, message: "Thread deleted successfully" });
    } catch (err) {
      console.error("Error deleting thread:", err);
      res.status(500).json({ message: "Error deleting thread" });
    }
  },
);

// =========================================
//      PLAYER COMPARISON: nik vs Levitan
// =========================================

const COMP_LEFT = "nik";
const COMP_RIGHT = "Levitan";

// GET /api/comparison/nik-levitan  -> sumar rezultate
app.get("/api/comparison/nik-levitan", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_votes,
        SUM(game_iq = ?)      AS game_iq_nik,
        SUM(game_iq = ?)      AS game_iq_levitan,
        SUM(skill = ?)        AS skill_nik,
        SUM(skill = ?)        AS skill_levitan,
        SUM(positioning = ?)  AS pos_nik,
        SUM(positioning = ?)  AS pos_levitan,
        SUM(finishing = ?)    AS fin_nik,
        SUM(finishing = ?)    AS fin_levitan,
        SUM(defending = ?)    AS def_nik,
        SUM(defending = ?)    AS def_levitan
      FROM comparison_votes
      `,
      [
        COMP_LEFT,
        COMP_RIGHT,
        COMP_LEFT,
        COMP_RIGHT,
        COMP_LEFT,
        COMP_RIGHT,
        COMP_LEFT,
        COMP_RIGHT,
        COMP_LEFT,
        COMP_RIGHT,
      ],
    );

    const r = rows[0] || {};
    const total = r.total_votes || 0;

    const cat = {
      game_iq: {
        nik: r.game_iq_nik || 0,
        Levitan: r.game_iq_levitan || 0,
      },
      skill: {
        nik: r.skill_nik || 0,
        Levitan: r.skill_levitan || 0,
      },
      positioning: {
        nik: r.pos_nik || 0,
        Levitan: r.pos_levitan || 0,
      },
      finishing: {
        nik: r.fin_nik || 0,
        Levitan: r.fin_levitan || 0,
      },
      defending: {
        nik: r.def_nik || 0,
        Levitan: r.def_levitan || 0,
      },
    };

    // calculăm scorul ca TOTAL BULLET-URI pentru fiecare jucător

// calculăm scorul ca TOTAL BULLET-URI pentru fiecare jucător
    const toInt = (v) => Number(v) || 0;

    const nikScore =
      toInt(r.game_iq_nik) +
      toInt(r.skill_nik) +
      toInt(r.pos_nik) +
      toInt(r.fin_nik) +
      toInt(r.def_nik);

    const levScore =
      toInt(r.game_iq_levitan) +
      toInt(r.skill_levitan) +
      toInt(r.pos_levitan) +
      toInt(r.fin_levitan) +
      toInt(r.def_levitan);

    res.json({
      leftName: COMP_LEFT,
      rightName: COMP_RIGHT,
      totalVotes: total,
      categories: cat,
      nikScore,
      levScore,
    });
  } catch (err) {
    console.error("Comparison summary error:", err);
    res.status(500).json({ message: "Error loading comparison summary" });
  }
});

// POST /api/comparison/nik-levitan/vote  -> doar logat, o singură dată
app.post(
  "/api/comparison/nik-levitan/vote",
  authRequired,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        game_iq,
        skill,
        positioning,
        finishing,
        defending,
      } = req.body || {};

      const choices = { game_iq, skill, positioning, finishing, defending };

      // verificăm că toate cele 5 sunt prezente
      for (const [key, value] of Object.entries(choices)) {
        if (!value) {
          return res
            .status(400)
            .json({ message: `Please vote in ${key}.` });
        }
        if (value !== COMP_LEFT && value !== COMP_RIGHT) {
          return res.status(400).json({ message: "Invalid vote value." });
        }
      }

      try {
        await pool.query(
          `
          INSERT INTO comparison_votes
            (user_id, game_iq, skill, positioning, finishing, defending)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            userId,
            game_iq,
            skill,
            positioning,
            finishing,
            defending,
          ],
        );
      } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res
            .status(400)
            .json({ message: "You already voted in this comparison." });
        }
        throw err;
      }

      res.status(201).json({ message: "Vote recorded successfully." });
    } catch (err) {
      console.error("Comparison vote error:", err);
      res.status(500).json({ message: "Server error while voting." });
    }
  },
);


// =========================================
//   FALLBACK: trimitem index.html pentru /
// =========================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =========================================
//              PORNIRE SERVER
// =========================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
