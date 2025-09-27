// ...existing code...
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

// initial UI update for username
if (elUser) elUser.textContent = USERNAME ? `Hi, ${USERNAME}` : "";

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

const apiLogin = (username) => apiFetch("/login", { method: "POST", body: { username } });
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
  } catch (_) {}
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
  try {
    const data = await apiNewGame();
    gameId = data.gameId || data.id || null;
    state = data;
    showMsg("");
    if (elApp) elApp.classList.remove("flash-bad");
    render();
  } catch (e) {
    console.error(e);
    showMsg(e.message || "Backend not reachable. Is it running on :3001?", "bad");
  }
}

async function submitGuess(raw) {
  if (!gameId) return;
  const guess = String(raw ?? (elGuess ? elGuess.value : "")).trim().toLowerCase();
  if (!guess) return;

  const prevMasked = state.masked;
  const prevLives = state.lives;

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
  } catch (e) {
    console.error(e);
    showMsg(e.message || "Request failed", "bad");
  }
}

// --- wiring ---
if (btnGuess) btnGuess.addEventListener("click", () => submitGuess());
if (elGuess) elGuess.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submitGuess(); });
if (btnReset) btnReset.addEventListener("click", () => newGame());

// --- init ---
(async function init() {
  buildKeyboard();
  render();

  // check backend health
  try {
    await apiHealth();
  } catch (e) {
    console.warn("Backend health check failed:", e);
    showMsg("Backend not reachable (port 3001).", "bad");
    return;
  }

  // if there's a token, ensure TOKEN variable uses it
  if (!TOKEN) TOKEN = localStorage.getItem("hangman_token");

  // if logged in, immediately start a new game
  if (TOKEN) {
    try { await newGame(); } catch (_) {}
  } else {
    // if on root but no token, ensure redirect to login handled elsewhere
    showMsg("Please login to play", "bad");
  }
})();
// ...existing code...