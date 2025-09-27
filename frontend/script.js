// === CONFIG ===
// If you deploy the API elsewhere, change this:
const API_BASE = "http://localhost:3001/api";

// === ELEMENTS ===
const elMasked   = document.getElementById("masked");
const elLives    = document.getElementById("lives");
const elWrong    = document.getElementById("wrong");
const elMsg      = document.getElementById("message");
const elGuess    = document.getElementById("guess");
const btnGuess   = document.getElementById("btnGuess");
const btnReset   = document.getElementById("btnReset");
const elGallows  = document.getElementById("gallows");
const elKeyboard = document.getElementById("keyboard");
const elOverlay  = document.getElementById("overlay");
const elMaskedBox= document.querySelector(".masked");
const elApp      = document.querySelector(".app");
const elConfetti = document.getElementById("confetti");

// === STATE ===
let gameId = null;
let state = { masked: "", lives: 6, wrong: [], status: "playing" };
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

// === UI HELPERS ===
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
  elMasked.textContent = state.masked;         // masked is already spaced by backend ("_ _ _")
  elLives.textContent  = state.lives;
  elWrong.textContent  = (state.wrong || []).join(" ");
  elGallows.textContent = gallowsFor(state.lives);
  updateKeyboard();
}

// On-screen keyboard
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
  // For “correct” marking, we infer from visible letters in masked (not perfect but solid)
  const maskedLetters = new Set(state.masked.replace(/\s+/g, "").split("").filter(c => c !== "_"));

  document.querySelectorAll(".key").forEach(b => {
    const ch = b.dataset.key;
    const used = wrongSet.has(ch) || maskedLetters.has(ch);
    b.disabled = used || gameOver;
    b.classList.toggle("used", used);
    b.classList.toggle("ok", maskedLetters.has(ch));
    b.classList.toggle("bad", wrongSet.has(ch));
  });

  // Disable input when game is over
  elGuess.disabled = gameOver;
  btnGuess.disabled = gameOver;
}

// Tiny synth sounds (no files)
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
  } catch (e) { /* ignore */ }
}

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

// === API CALLS ===
async function apiNewGame() {
  const res = await fetch(`${API_BASE}/games`, { method: "POST" });
  if (!res.ok) throw new Error(`New game failed: ${res.status}`);
  return res.json();
}

async function apiGuess(id, guess) {
  const res = await fetch(`${API_BASE}/games/${id}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guess })
  });
  if (!res.ok) throw new Error(`Guess failed: ${res.status}`);
  return res.json();
}

// === GAME FLOW ===
async function newGame() {
  try {
    const data = await apiNewGame();
    gameId = data.gameId;
    state = data;
    showMsg("");
    elApp.classList.remove("flash-bad");
    render();
  } catch (e) {
    showMsg("Backend not reachable. Is it running on :3001?", "bad");
    console.error(e);
  }
}

async function submitGuess(raw) {
  if (!gameId) return;
  const guess = String(raw || elGuess.value || "").trim().toLowerCase();
  if (!guess) return;

  const before = { masked: state.masked, lives: state.lives };

  try {
    const data = await apiGuess(gameId, guess);
    state = data;
    render();

    const improved = state.masked !== before.masked;
    const lostLife = state.lives < before.lives;

    if (state.status === "won") {
      showMsg(`You got it!`, "ok");
      emitConfetti();
      elOverlay.classList.add("show");
      setTimeout(() => elOverlay.classList.remove("show"), 800);
      playTone(880, .1); setTimeout(() => playTone(1175, .12), 120);
    } else if (state.status === "lost") {
      showMsg(`Out of lives!`, "bad");
      elApp.classList.add("flash-bad"); setTimeout(() => elApp.classList.remove("flash-bad"), 400);
      playTone(130, .12);
    } else {
      if (improved) {
        elMaskedBox.classList.add("glow");
        setTimeout(() => elMaskedBox.classList.remove("glow"), 250);
        showMsg(`Nice! '${guess}' is in the word.`, "ok");
        playTone(660, .08);
      } else if (lostLife) {
        elApp.classList.add("shake"); setTimeout(() => elApp.classList.remove("shake"), 450);
        elApp.classList.add("flash-bad"); setTimeout(() => elApp.classList.remove("flash-bad"), 200);
        showMsg(`Nope. '${guess}' is not in the word.`, "bad");
        playTone(220, .09);
      }
    }
  } catch (e) {
    showMsg("Request failed. Check backend logs.", "bad");
    console.error(e);
  } finally {
    elGuess.value = "";
    elGuess.focus();
  }
}

// === WIRING ===
btnGuess.addEventListener("click", () => submitGuess());
btnReset.addEventListener("click", newGame);
elGuess.addEventListener("keydown", (e) => { if (e.key === "Enter") submitGuess(); });

// Type anywhere (unless focused in input)
window.addEventListener("keydown", (e) => {
  if (!/^[a-z]$/i.test(e.key)) return;
  if (document.activeElement === elGuess) return;
  submitGuess(e.key);
});

// Build UI + start
buildKeyboard();
newGame();
