import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";

const app = express();
app.use(cors());            // allow frontend to call API (localhost)
app.use(express.json());    // parse JSON bodies

// —— simple in-memory store (swap later for DB) ——
const MAX_LIVES = 6;
const WORDS = [
  "computer","javascript","variable","debug","interface",
  "inheritance","polymorphism","algorithm","compiler","arraylist",
  "recursion","exception","package","constructor","function","object"
];

const games = new Map(); // gameId -> { word, masked, lives, wrong:Set, correct:Set, status }

// helpers
const maskWord = (w) => w.split("").map(ch => /[a-z]/i.test(ch) ? "_" : ch);
const reveal = (word, masked, ch) => {
  let hit = false;
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ch) { masked[i] = ch; hit = true; }
  }
  return hit;
};
const isRevealed = (masked) => masked.every(c => c !== "_");

const publicState = (g, id) => ({
  gameId: id,
  masked: g.masked.join(" "),
  lives: g.lives,
  wrong: Array.from(g.wrong),
  status: g.status   // "playing" | "won" | "lost"
});

// —— routes ——
app.post("/api/games", (req, res) => {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)].toLowerCase();
  const gameId = nanoid(10);
  const game = {
    word,
    masked: maskWord(word),
    lives: MAX_LIVES,
    wrong: new Set(),
    correct: new Set(),
    status: "playing"
  };
  games.set(gameId, game);
  res.json(publicState(game, gameId));
});

app.get("/api/games/:id", (req, res) => {
  const g = games.get(req.params.id);
  if (!g) return res.status(404).json({ error: "Game not found" });
  res.json(publicState(g, req.params.id));
});

app.post("/api/games/:id/guess", (req, res) => {
  const g = games.get(req.params.id);
  if (!g) return res.status(404).json({ error: "Game not found" });
  if (g.status !== "playing") return res.json(publicState(g, req.params.id));

  const { guess } = req.body || {};
  const val = (guess || "").trim().toLowerCase();
  if (!val) return res.status(400).json({ error: "Empty guess" });

  // letter guess
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
      if (g.lives <= 0) g.status = "lost";
    }
    return res.json(publicState(g, req.params.id));
  }

  // word guess
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

// health
app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
