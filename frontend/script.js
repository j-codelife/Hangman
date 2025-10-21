/*
  Rewritten frontend script.js
  - Centralized API_BASE and apiFetch helper
  - Complete, defensive DOM wiring
  - Game flow: new game, guess, keyboard, render
  - Login/token handling and logout
*/
const API_BASE = (window.__HANGMAN_API_BASE__ = window.__HANGMAN_API_BASE__ || "http://localhost:3001/api");

let TOKEN = localStorage.getItem("hangman_token");
const USERNAME = localStorage.getItem("hangman_user");

// DOM refs (guarded)
const elUser      = document.getElementById("userName");
const btnLogout   = document.getElementById("btnLogout");
const elMasked    = document.getElementById("masked");
const elLives     = document.getElementById("lives");
const elWrong     = document.getElementById("wrong");
const elMsg       = document.getElementById("message");
const elGuess     = document.getElementById("guess");
const btnGuess    = document.getElementById("btnGuess");
const btnReset    = document.getElementById("btnReset");
const elGallows   = document.getElementById("gallows");
const elKeyboard  = document.getElementById("keyboard");
const elOverlay   = document.getElementById("overlay");
const elApp       = document.querySelector(".app");
const elConfetti  = document.getElementById("confetti");
const elLoading   = document.getElementById("loadingIndicator");
const elStatsGames = document.getElementById("statGames");
const elStatsWins  = document.getElementById("statWins");
const elStatsLosses = document.getElementById("statLosses");
const elStatsStreak = document.getElementById("statStreak");
const elStatsBest   = document.getElementById("statBest");
const elHistoryList = document.getElementById("historyList");

const HISTORY_PREFIX = "hangman_history_v1";
const historyKey = () => `${HISTORY_PREFIX}:${USERNAME || "guest"}`;

function loadHistory() {
  try {
    const raw = localStorage.getItem(historyKey());
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to parse history", err);
    return [];
  }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(historyKey(), JSON.stringify(entries));
  } catch (err) {
    console.warn("Failed to save history", err);
  }
}

let historyEntries = loadHistory();

function computeStats(entries) {
  const total = entries.length;
  const wins = entries.filter((entry) => entry.result === "win").length;

  let currentStreak = 0;
  for (const entry of entries) {
    if (entry.result === "win") currentStreak++;
    else break;
  }

  let bestStreak = 0;
  let running = 0;
  for (const entry of entries.slice().reverse()) {
    if (entry.result === "win") {
      running++;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }

  const losses = total - wins;

  return { total, wins, losses, currentStreak, bestStreak };
}

function renderHistory() {
  const stats = computeStats(historyEntries);
  if (elStatsGames) elStatsGames.textContent = String(stats.total);
  if (elStatsWins) elStatsWins.textContent = String(stats.wins);
  if (elStatsLosses) elStatsLosses.textContent = String(stats.losses);
  if (elStatsStreak) elStatsStreak.textContent = String(stats.currentStreak);
  if (elStatsBest) elStatsBest.textContent = String(stats.bestStreak);

  if (!elHistoryList) return;

  elHistoryList.innerHTML = "";
  if (!historyEntries.length) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Play a round to see your recent words.";
    elHistoryList.appendChild(empty);
    return;
  }
  historyEntries.slice(0, 8).forEach((entry) => {
    const li = document.createElement("li");
    li.className = `history-item ${entry.result}`;
    const wordSpan = document.createElement("span");
    wordSpan.className = "history-word";
    wordSpan.textContent = entry.word;
    wordSpan.setAttribute("aria-label", "Word");

    const resultSpan = document.createElement("span");
    resultSpan.className = "history-result";
    resultSpan.textContent = entry.result === "win" ? "Won" : "Lost";
    resultSpan.setAttribute("aria-label", "Result");

    const detailSpan = document.createElement("span");
    detailSpan.className = "history-detail";
    const wrongLabel = entry.wrongGuesses === 1 ? "1 wrong" : `${entry.wrongGuesses} wrong`;
    detailSpan.textContent = wrongLabel;
    detailSpan.setAttribute("aria-label", "Wrong guesses");

    const timeEl = document.createElement("time");
    timeEl.className = "history-time";
    timeEl.dateTime = new Date(entry.timestamp).toISOString();
    timeEl.textContent = new Date(entry.timestamp).toLocaleString();

    li.append(wordSpan, resultSpan, detailSpan, timeEl);
    elHistoryList.appendChild(li);
  });
}

function recordOutcome(gameState) {
  if (outcomeRecorded) return;
  if (!gameState || (gameState.status !== "won" && gameState.status !== "lost")) return;

  const word = (gameState.solution || (gameState.masked || "").replace(/\s+/g, "")).toUpperCase();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    word,
    result: gameState.status === "won" ? "win" : "loss",
    wrongGuesses: (gameState.wrong || []).length,
    livesRemaining: gameState.lives ?? 0,
    durationMs: gameStartedAt ? Date.now() - gameStartedAt : null,
    timestamp: Date.now()
  };

  historyEntries = [entry, ...historyEntries].slice(0, 50);
  saveHistory(historyEntries);
  renderHistory();
  outcomeRecorded = true;
}

let loadingCount = 0;
let loadingMessage = "";

function setLoading(active, message = "") {
  if (active) {
    loadingCount += 1;
    if (message) loadingMessage = message;
  } else {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0) loadingMessage = "";
  }

  const isActive = loadingCount > 0;
  if (elApp) {
    elApp.classList.toggle("is-loading", isActive);
    elApp.setAttribute("aria-busy", isActive ? "true" : "false");
  }
  if (elLoading) {
    if (isActive) {
      elLoading.hidden = false;
      elLoading.textContent = loadingMessage || "Loading…";
    } else {
      elLoading.hidden = true;
      elLoading.textContent = "";
    }
  }
}

async function withLoading(message, task) {
  setLoading(true, message);
  try {
    return await task();
  } finally {
    setLoading(false);
  }
}

// initial UI update for username
if (elUser) elUser.textContent = USERNAME ? `Hi, ${USERNAME}` : "";

renderHistory();

// Logout handler
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("hangman_token");
    localStorage.removeItem("hangman_user");
    TOKEN = null;
    window.location.href = "/login.html";
  });
}

// If no token and not on login page, redirect
if (!TOKEN && !location.pathname.endsWith("/login.html")) {
  location.href = "/login.html";
}

// --- state ---
let gameId = null;
let state = { masked: "", lives: 6, wrong: [], status: "playing" };
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
let gameStartedAt = null;
let outcomeRecorded = false;

// --- helpers ---
function safeText(el, txt = "") { if (el) el.textContent = txt; }
function showMsg(text = "", cls = "") { if (elMsg) { elMsg.className = `message ${cls}`; elMsg.textContent = text; } }

// simple gallows ascii
function gallowsFor(l = 6) {
  const stages = [
`  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      |
=========`,
`  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========`,
`  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========`,
`  +---+
  |   |
  O   |
 /|   |
      |
      |
=========`,
`  +---+
  |   |
  O   |
  |   |
      |
      |
=========`,
`  +---+
  |   |
  O   |
      |
      |
      |
=========`,
`  +---+
  |   |
      |
      |
      |
      |
=========`
  ];
  const idx = Math.max(0, Math.min(6, l));
  return stages[6 - idx];
}

// --- API helper ---
async function apiFetch(path, options = {}) {
  const base = API_BASE.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;

  const headers = Object.assign({}, options.headers || {});
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const token = TOKEN || localStorage.getItem("hangman_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const body = options.body && !(options.body instanceof FormData) && typeof options.body === "object"
    ? JSON.stringify(options.body)
    : options.body;

  const res = await fetch(url, Object.assign({}, options, { headers, body }));
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status}${txt ? `: ${txt}` : ""}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

const apiNewGame = () => apiFetch("/games", { method: "POST" });
const apiGuess = (id, guess) => apiFetch(`/games/${id}/guess`, { method: "POST", body: { guess } });
const apiHealth = () => apiFetch("/health", { method: "GET" });

// --- UI: keyboard, render ---
function buildKeyboard() {
  if (!elKeyboard) return;
  elKeyboard.innerHTML = "";
  LETTERS.forEach(ch => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "key";
    b.textContent = ch;
    b.dataset.key = ch;
     b.setAttribute("aria-label", `Guess letter ${ch.toUpperCase()}`);
     b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => submitGuess(ch));
    elKeyboard.appendChild(b);
  });
}

function updateKeyboard() {
  if (!elKeyboard) return;
  const gameOver = state.status !== "playing";
  const wrongSet = new Set(state.wrong || []);
  const revealed = new Set((state.masked || "").replace(/\s+/g, "").split("").filter(Boolean));
  elKeyboard.querySelectorAll(".key").forEach(b => {
    const ch = b.dataset.key;
    const used = wrongSet.has(ch) || revealed.has(ch);
    b.disabled = used || gameOver;
    b.classList.toggle("used", used);
    b.classList.toggle("ok", revealed.has(ch));
    b.classList.toggle("bad", wrongSet.has(ch));
    b.setAttribute("aria-pressed", used ? "true" : "false");
    b.setAttribute("aria-disabled", b.disabled ? "true" : "false");
  });
  if (elGuess) elGuess.disabled = gameOver;
  if (btnGuess) btnGuess.disabled = gameOver;
}

function render() {
  safeText(elMasked, state.masked || "");
  safeText(elLives, String(state.lives ?? ""));
  safeText(elWrong, (state.wrong || []).join(" "));
  safeText(elGallows, gallowsFor(state.lives));
  updateKeyboard();
}

function handleGlobalKeyDown(ev) {
  if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const target = ev.target;
  const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
  const isEditable = target && (target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select");
  if (isEditable && target !== elGuess) return;

  if (/^[a-z]$/.test(ev.key) && state.status === "playing") {
    ev.preventDefault();
    submitGuess(ev.key.toLowerCase());
    return;
  }

  if (ev.key === "Enter" && state.status !== "playing") {
    ev.preventDefault();
    newGame();
    return;
  }
}

// sounds & confetti (kept simple)
let audioCtx;
function playTone(freq = 440, dur = 0.08) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.06;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); setTimeout(() => osc.stop(), dur * 1000);
  } catch {
    /* audio not supported */
  }
}
function emitConfetti(cnt = 24) {
  if (!elConfetti) return;
  const EMO = ["🎉","✨","⭐","🎈","💥","🟣","🟡","🟢","🔷","🔶"];
  for (let i = 0; i < cnt; i++) {
    const s = document.createElement("span");
    s.className = "conf";
    s.textContent = EMO[Math.floor(Math.random()*EMO.length)];
    s.style.left = Math.random() * window.innerWidth + "px";
    s.style.animationDuration = (700 + Math.random()*800) + "ms";
    elConfetti.appendChild(s);
    setTimeout(() => s.remove(), 1600);
  }
}

// --- Game actions ---
async function newGame() {
  return withLoading("Starting a new game…", async () => {
    try {
      const data = await apiNewGame();
      gameId = data.gameId || data.id || null;
      state = data;
      gameStartedAt = Date.now();
      outcomeRecorded = false;
      showMsg("");
      if (elApp) elApp.classList.remove("flash-bad");
      render();
    } catch (e) {
      console.error(e);
      showMsg(e.message || "Backend not reachable. Is it running on :3001?", "bad");
    }
  });
}

async function submitGuess(raw) {
  if (!gameId) return;
  const guess = String(raw ?? (elGuess ? elGuess.value : "")).trim().toLowerCase();
  if (!guess) return;

  const prevMasked = state.masked;
  const prevLives = state.lives;

  return withLoading("Checking guess…", async () => {
    try {
      const data = await apiGuess(gameId, guess);
      state = data;
      render();

      const improved = state.masked !== prevMasked;
      const lostLife = (state.lives ?? 0) < (prevLives ?? 0);

      if (state.status === "won") {
        showMsg("You got it!", "ok");
        emitConfetti();
        if (elOverlay) elOverlay.classList.add("show");
        setTimeout(() => { if (elOverlay) elOverlay.classList.remove("show"); }, 800);
        playTone(880, .1); setTimeout(() => playTone(1175, .12), 120);
      } else if (state.status === "lost") {
        const solution = state.solution || (state.masked || "").replace(/\s+/g,"");
        showMsg(`Out of lives! The word was "${solution}".`, "bad");
        if (elApp) elApp.classList.add("flash-bad");
        setTimeout(() => { if (elApp) elApp.classList.remove("flash-bad"); }, 400);
        playTone(130, .12);
      } else {
        if (improved) playTone(660, .06);
        else if (lostLife) { playTone(220, .08); if (elApp) { elApp.classList.add("flash-bad"); setTimeout(()=>elApp.classList.remove("flash-bad"),300);} }
        else playTone(440, .04);
      }

      if (elGuess) elGuess.value = "";
      updateKeyboard();
      recordOutcome(state);
    } catch (e) {
      console.error(e);
      showMsg(e.message || "Request failed", "bad");
    }
  });
}

// --- wiring ---
if (btnGuess) btnGuess.addEventListener("click", () => submitGuess());
if (elGuess) elGuess.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submitGuess(); });
if (btnReset) btnReset.addEventListener("click", () => newGame());
document.addEventListener("keydown", handleGlobalKeyDown);

// --- init ---
(async function init() {
  buildKeyboard();
  render();

  // check backend health
  try {
    setLoading(true, "Checking backend health…");
    await apiHealth();
  } catch (e) {
    console.warn("Backend health check failed:", e);
    showMsg("Backend not reachable (port 3001).", "bad");
    return;
  } finally {
    setLoading(false);
  }

  // if there's a token, ensure TOKEN variable uses it
  if (!TOKEN) TOKEN = localStorage.getItem("hangman_token");

  // if logged in, immediately start a new game
  if (TOKEN) {
    try {
      await newGame();
    } catch (err) {
      console.error("Failed to start a new game:", err);
      showMsg("Unable to start a new game right now", "bad");
    }
  } else {
    // if on root but no token, ensure redirect to login handled elsewhere
    showMsg("Please login to play", "bad");
  }
})();

// Theme handling lives in frontend/theme.js so standalone pages (login) can reuse it
