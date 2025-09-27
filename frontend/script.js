// script.js — Frontend wired to backend API with neon UI, keyboard, sounds, confetti
// Make sure your HTML has elements with IDs referenced below.

// prefer explicit backend URL to avoid relative-path/proxy issues during development
const API_BASE = (() => {
  const rawOverride = window.__HANGMAN_API_BASE__ || localStorage.getItem('hangman_api_base');
  if (rawOverride) return rawOverride.replace(/\/+$/, '') || '/api';

  const origin = window.location && window.location.origin ? window.location.origin : '';
  if (!origin || origin === 'null') return 'http://localhost:3001/api';

  const normalizedOrigin = origin.replace(/\/+$/, '');
  if (/localhost:\d+$/.test(normalizedOrigin) && !normalizedOrigin.endsWith(':3001')) {
    return 'http://localhost:3001/api';
  }
  return `${normalizedOrigin}/api`;
})();

// basic auth token (stored by login page)
let TOKEN = localStorage.getItem('hangman_token');
const USERNAME = localStorage.getItem('hangman_user');
// show username if present
const elUser = document.getElementById('userName');
if (elUser) elUser.textContent = USERNAME ? `Hi, ${USERNAME}` : '';

// logout button
const btnLogoutEl = document.getElementById('btnLogout');
if (btnLogoutEl) btnLogoutEl.addEventListener('click', () => {
  localStorage.removeItem('hangman_token');
  localStorage.removeItem('hangman_user');
  TOKEN = null;
  window.location.href = '/login.html';
});

if (!TOKEN) {
  // redirect to a simple login page
  if (!location.pathname.endsWith('/login.html')) {
    location.href = '/login.html';
  }
}

// --- Element refs ---
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
const elMaskedBox = document.querySelector(".masked");
const elApp       = document.querySelector(".app");
const elConfetti  = document.getElementById("confetti");

// --- State ---
let gameId = null;
let state = { masked: "", lives: 6, wrong: [], status: "playing" };
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

// --- UI helpers ---
function showMsg(text = "", cls = "") {
  elMsg.className = `message ${cls}`;
  elMsg.textContent = text;
}

function gallowsFor(l) {
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

function render() {
  elMasked.textContent   = state.masked;                  // backend sends spaced string
  elLives.textContent    = state.lives;
  elWrong.textContent    = (state.wrong || []).join(" ");
  elGallows.textContent  = gallowsFor(state.lives);
  updateKeyboard();
}

function buildKeyboard() {
  elKeyboard.innerHTML = "";
  LETTERS.forEach(ch => {
    const b = document.createElement("button");
    b.className = "key";
    b.textContent = ch;
    b.dataset.key = ch;
    b.addEventListener("click", () => submitGuess(ch));
    elKeyboard.appendChild(b);
  });
}

function updateKeyboard() {
  const gameOver = state.status !== "playing";
  const wrongSet = new Set(state.wrong || []);
  // derive revealed letters from masked (remove spaces + underscores)
  const revealed = new Set(state.masked.replace(/\s+/g, "").split("").filter(c => c !== "_"));

  document.querySelectorAll(".key").forEach(b => {
    const ch = b.dataset.key;
    const used = wrongSet.has(ch) || revealed.has(ch);
    b.disabled = used || gameOver;
    b.classList.toggle("used", used);
    b.classList.toggle("ok", revealed.has(ch));
    b.classList.toggle("bad", wrongSet.has(ch));
  });

  elGuess.disabled = gameOver;
  btnGuess.disabled = gameOver;
}

// Sounds (no assets)
let audioCtx;
function playTone(freq = 440, dur = 0.08) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square"; osc.frequency.value = freq;
    gain.gain.value = 0.07;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); setTimeout(() => osc.stop(), dur * 1000);
  } catch (_) {}
}

// Confetti (emoji)
function emitConfetti(count = 24) {
  const EMO = ["🎉","✨","⭐","🎈","💥","🟣","🟡","🟢","🔷","🔶"];
  const w = window.innerWidth;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.className = "conf";
    s.textContent = EMO[Math.floor(Math.random() * EMO.length)];
    s.style.left = (Math.random() * w) + "px";
    s.style.animationDuration = (700 + Math.random() * 800) + "ms";
    elConfetti.appendChild(s);
    setTimeout(() => s.remove(), 1600);
  }
}

// --- API ---
const apiPath = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

async function apiRequest(path, options = {}) {
  const { method = 'GET', headers = {}, body, auth = true, ...rest } = options;
  const finalHeaders = new Headers(headers);
  let payload = body;

  if (auth && TOKEN && !finalHeaders.has('Authorization')) {
    finalHeaders.set('Authorization', `Bearer ${TOKEN}`);
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer;
  const isUrlParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
  const shouldJsonify = body !== undefined && !isFormData && !isBlob && !isArrayBuffer && !isUrlParams && typeof body === 'object';

  if (shouldJsonify) {
    if (!finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }
    payload = JSON.stringify(body);
  }

  const response = await fetch(apiPath(path), {
    method,
    headers: finalHeaders,
    body: payload,
    ...rest
  });

  const contentType = response.headers.get('content-type') || '';
  const parseAsJson = contentType.includes('application/json');
  const data = parseAsJson ? await response.json().catch(() => null) : await response.text().catch(() => null);

  if (!response.ok) {
    const detail = data && typeof data === 'object' ? (data.error || data.message || JSON.stringify(data)) : data;
    const error = new Error(detail ? `${response.status} ${detail}` : `Request failed ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function apiNewGame() {
  return apiRequest('/games', { method: 'POST' });
}

async function apiGuess(id, guess) {
  return apiRequest(`/games/${id}/guess`, { method: 'POST', body: { guess } });
}

// --- Game flow ---
async function newGame() {
  try {
    const data = await apiNewGame();
    gameId = data.gameId;
    state  = data;
    showMsg("");
    elApp.classList.remove("flash-bad");
    render();
  } catch (e) {
    console.error(e);
    showMsg(e.message || "Backend not reachable. Is it running on :3001?", "bad");
  }
}

async function submitGuess(raw) {
  if (!gameId) return;
  const guess = String(raw || elGuess.value || "").trim().toLowerCase();
  if (!guess) return;

  const prevMasked = state.masked;
  const prevLives  = state.lives;

  try {
    const data = await apiGuess(gameId, guess);
    state = data;
    render();

    const improved = state.masked !== prevMasked;
    const lostLife = state.lives < prevLives;

    if (state.status === "won") {
      showMsg(`You got it!`, "ok");
      emitConfetti();
      elOverlay.classList.add("show");
      setTimeout(() => elOverlay.classList.remove("show"), 800);
      playTone(880, .1); setTimeout(() => playTone(1175, .12), 120);
    } else if (state.status === "lost") {
      const solution = state.solution || state.masked.replace(/\s+/g, "");
      showMsg(`Out of lives! The word was "${solution}".`, "bad");
      elApp.classList.add("flash-bad");
      setTimeout(() => elApp.classList.remove("flash-bad"), 400);
      playTone(130, .12);
    } else {
      if (improved) {
        elMaskedBox.classList.add("glow");
        setTimeout(() => elMaskedBox.classList.remove("glow"), 250);
        showMsg(`Nice! '${guess}' is in the word.`, "ok");
        playTone(660, .08);
      } else if (lostLife) {
        elApp.classList.add("shake");
        setTimeout(() => elApp.classList.remove("shake"), 450);
        elApp.classList.add("flash-bad");
        setTimeout(() => elApp.classList.remove("flash-bad"), 200);
        showMsg(`Nope. '${guess}' is not in the word.`, "bad");
        playTone(220, .09);
      }
    }
  } catch (e) {
    console.error(e);
    showMsg(e.message || "Request failed. Check backend logs.", "bad");
  } finally {
    elGuess.value = "";
    elGuess.focus();
  }
}

// --- Wiring ---
btnGuess.addEventListener("click", () => submitGuess());
btnReset.addEventListener("click", newGame);
elGuess.addEventListener("keydown", (e) => { if (e.key === "Enter") submitGuess(); });

// Type letters anywhere (unless focused in input)
window.addEventListener("keydown", (e) => {
  if (!/^[a-z]$/i.test(e.key)) return;
  if (document.activeElement === elGuess) return;
  submitGuess(e.key);
});

// Boot
buildKeyboard();
newGame();

// expose computed API base so other pages (login.html) can reuse the same base
try {
  window.__HANGMAN_API_BASE__ = API_BASE;
  window.HANGMAN_API_BASE = API_BASE;
} catch (_) {}
