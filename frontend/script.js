// script.js — Frontend wired to backend API with neon UI, keyboard, sounds, confetti
// Make sure your HTML has elements with IDs referenced below.

// use relative API path so it works when served from a static server with a proxy or same-origin
const API_BASE = "/api";

// basic auth token (stored by login page)
const TOKEN = localStorage.getItem('hangman_token');
if (!TOKEN) {
  // redirect to a simple login page
  if (!location.pathname.endsWith('/login.html')) {
    location.href = '/frontend/login.html';
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
async function apiNewGame() {
  const res = await fetch(`${API_BASE}/games`, { method: "POST", headers: { 'Authorization': `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`New game failed: ${res.status}`);
  return res.json();
}

async function apiGuess(id, guess) {
  const res = await fetch(`${API_BASE}/games/${id}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guess })
  });
  // include token
  const headers = { "Content-Type": "application/json", 'Authorization': `Bearer ${TOKEN}` };
  const res2 = await fetch(`${API_BASE}/games/${id}/guess`, {
    method: "POST",
    headers,
    body: JSON.stringify({ guess })
  });
  // use res2 in place of res below
  if (!res2.ok) throw new Error(`Guess failed: ${res2.status}`);
  return res2.json();
  if (!res.ok) throw new Error(`Guess failed: ${res.status}`);
  return res.json();
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
    showMsg("Backend not reachable. Is it running on :3001?", "bad");
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
    showMsg("Request failed. Check backend logs.", "bad");
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
