// server.js (Node + Express backend for Hangman)
// Requires: express, cors, nanoid
// Run from backend folder: npm run dev

import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { pathToFileURL } from "url";

export const app = express();
app.use(cors());
app.use(express.json());

// ---- Game config ----
const MAX_LIVES = 6;
const WORDS = [
  "computer","javascript","variable","debug","interface",
  "inheritance","polymorphism","algorithm","compiler","arraylist",
  "recursion","exception","package","constructor","function","object"
];

// ---- In-memory store: id -> game ----
/**
 * Game shape:
 * {
 *   word: string,
 *   masked: string[] (characters),
 *   lives: number,
 *   wrong: Set<char>,
 *   correct: Set<char>,
 *   status: "playing" | "won" | "lost"
 * }
 */
const games = new Map();
export const gamesStore = games;
export function resetGames() {
  games.clear();
}

// ---- Helpers ----
const maskWord = (w) => w.split("").map(ch => /[a-z]/i.test(ch) ? "_" : ch);
const reveal = (word, masked, ch) => {
  let hit = false;
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ch) { masked[i] = ch; hit = true; }
  }
  return hit;
};
const isRevealed = (masked) => masked.every(c => c !== "_");

// Only include solution when game ended
const publicState = (g, id) => ({
  gameId: id,
  masked: g.masked.join(" "),         // spaced for easier display
  lives: g.lives,
  wrong: Array.from(g.wrong),
  status: g.status,                   // "playing" | "won" | "lost"
  ...(g.status !== "playing" ? { solution: g.word } : {})
});

// ---- Routes ----

// Start a new game
// simple login endpoint (dev only)
app.post('/api/login', (req, res) => {
  const { username } = req.body || {};
  if (!username || String(username).trim() === '') {
    return res.status(400).json({ error: 'username required' });
  }
  // very small dev token: base64 of username (do not use in production)
  const token = Buffer.from(String(username)).toString('base64');
  return res.json({ token, username: String(username) });
});

// Auth middleware for API routes (except login)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  if (req.path === '/api/login' || req.path === '/api/health') return next();
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    req.user = Buffer.from(token, 'base64').toString('utf8');
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  return next();
});

app.post("/api/games", (req, res) => {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)].toLowerCase();
  const id = nanoid(10);
  const game = {
    word,
    masked: maskWord(word),
    lives: MAX_LIVES,
    wrong: new Set(),
    correct: new Set(),
    status: "playing"
  };
  games.set(id, game);
  res.json(publicState(game, id));
});

// Get current game state
app.get("/api/games/:id", (req, res) => {
  const g = games.get(req.params.id);
  if (!g) return res.status(404).json({ error: "Game not found" });
  res.json(publicState(g, req.params.id));
});

// Submit a guess (letter or whole word)
app.post("/api/games/:id/guess", (req, res) => {
  const g = games.get(req.params.id);
  if (!g) return res.status(404).json({ error: "Game not found" });
  if (g.status !== "playing") return res.json(publicState(g, req.params.id));

  const val = String((req.body?.guess ?? "")).trim().toLowerCase();
  if (!val) return res.status(400).json({ error: "Empty guess" });

  // Single-letter guess
  if (/^[a-z]$/.test(val)) {
    if (g.correct.has(val) || g.wrong.has(val)) {
      return res.json({ ...publicState(g, req.params.id), message: "Duplicate guess" });
    }

    if (reveal(g.word, g.masked, val)) {
      g.correct.add(val);
      if (isRevealed(g.masked)) g.status = "won";
    } else {
      g.wrong.add(val);
      g.lives--;
      if (g.lives <= 0) {
        g.status = "lost";
        g.masked = g.word.split(""); // reveal solution on loss
      }
    }
    return res.json(publicState(g, req.params.id));
  }

  // Full-word guess
  if (!/^[a-z]+$/.test(val)) {
    return res.status(400).json({ error: "Letters only" });
  }

  if (val === g.word) {
    g.masked = g.word.split("");
    g.status = "won";
  } else {
    g.lives--;
    if (g.lives <= 0) {
      g.masked = g.word.split("");
      g.status = "lost";
    }
  }
  return res.json(publicState(g, req.params.id));
});

// Health check (accept both /health and /api/health for frontend probes)
app.get(["/health", "/api/health"], (_, res) => res.json({ ok: true }));

const PORT = parseInt(process.env.PORT, 10) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

const isMainModule = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

let server;

if (isMainModule) {
  server = app.listen(PORT, HOST, () => {
    console.log(`API on http://${HOST}:${PORT}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${PORT} is already in use. Stop the process using that port or set a different PORT (e.g. export PORT=3002).`);
      // Exit so nodemon doesn't keep trying to restart into the same error loop.
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  // graceful shutdown on Ctrl+C / termination
  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down server...`);
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
    // If it doesn't close within a short time, force exit
    setTimeout(() => {
      console.error('Forcing shutdown.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
