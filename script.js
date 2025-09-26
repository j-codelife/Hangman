// ----- words & constants -----
const WORDS = [
  "computer","javascript","variable","debug","interface",
  "inheritance","polymorphism","algorithm","compiler","arraylist",
  "recursion","exception","package","constructor","function","object"
];
const MAX_LIVES = 6;
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

// ----- elements -----
const elMasked = document.getElementById("masked");
const elLives = document.getElementById("lives");
const elWrong = document.getElementById("wrong");
const elMsg = document.getElementById("message");
const elGuess = document.getElementById("guess");
const btnGuess = document.getElementById("btnGuess");
const btnReset = document.getElementById("btnReset");
const elGallows = document.getElementById("gallows");
const elKeyboard = document.getElementById("keyboard");
const elOverlay = document.getElementById("overlay");
const elMaskedBox = document.querySelector(".masked");
const elApp = document.querySelector(".app");
const elConfetti = document.getElementById("confetti");

// ----- game state -----
let word = "";
let masked = [];
let lives = MAX_LIVES;
let wrong = new Set();
let correct = new Set();
let audioCtx; // lazily created

// ----- helpers -----
function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)].toLowerCase();
}
function maskWord(w) {
  return w.split("").map(ch => /[a-z]/i.test(ch) ? "_" : ch);
}
function reveal(ch) {
  let hit = false;
  for (let i = 0; i < word.length; i++) if (word[i] === ch) { masked[i] = ch; hit = true; }
  return hit;
}
function isRevealed() { return masked.every(c => c !== "_"); }

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
  elMasked.textContent = masked.join(" ");
  elLives.textContent = lives;
  elWrong.textContent = [...wrong].join(" ");
  elGallows.textContent = gallowsFor(lives);
}
function showMsg(text, type = "") {
  elMsg.className = `message ${type}`;
  elMsg.textContent = text;
}
function buildKeyboard(){
  elKeyboard.innerHTML = "";
  LETTERS.forEach(ch=>{
    const b = document.createElement("button");
    b.className = "key";
    b.textContent = ch;
    b.dataset.key = ch;
    b.addEventListener("click", ()=> { handleGuess(ch); updateKeyboard(); });
    elKeyboard.appendChild(b);
  });
}
function updateKeyboard(){
  document.querySelectorAll(".key").forEach(b=>{
    const ch = b.dataset.key;
    const used = correct.has(ch) || wrong.has(ch);
    b.disabled = used || lives===0 || isRevealed();
    b.classList.toggle("used", used);
    b.classList.toggle("ok", correct.has(ch));
    b.classList.toggle("bad", wrong.has(ch));
  });
}

function playTone(freq=440, dur=0.08){
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square"; o.frequency.value = freq;
    g.gain.value = 0.07; o.connect(g); g.connect(audioCtx.destination);
    o.start(); setTimeout(()=>{ o.stop(); }, dur*1000);
  }catch(e){ /* ignore if autoplay blocked */ }
}
function emitConfetti(count=24){
  const EMO = ["🎉","✨","⭐","🎈","💥","🟣","🟡","🟢","🔷","🔶"];
  const w = window.innerWidth;
  for(let i=0;i<count;i++){
    const s = document.createElement("span");
    s.className = "conf";
    s.textContent = EMO[Math.floor(Math.random()*EMO.length)];
    s.style.left = (Math.random()*w) + "px";
    s.style.animationDuration = (700 + Math.random()*800) + "ms";
    elConfetti.appendChild(s);
    setTimeout(()=>s.remove(), 1600);
  }
}

// ----- core flow -----
function resetGame(){
  word = pickWord();
  masked = maskWord(word);
  lives = MAX_LIVES;
  wrong.clear(); correct.clear();
  elGuess.value = ""; showMsg("");
  elApp.classList.remove("flash-bad");
  render(); buildKeyboard(); updateKeyboard();
}

function handleGuess(raw) {
  const guess = raw.trim().toLowerCase();
  if (!guess) return;

  if (/^[a-z]$/.test(guess)) {
    const ch = guess;
    if (correct.has(ch) || wrong.has(ch)) {
      showMsg(`You already tried '${ch}'.`, "bad");
      return;
    }
    if (reveal(ch)) {
      correct.add(ch);
      render(); updateKeyboard();
      showMsg(`Nice! '${ch}' is in the word.`, "ok");
      elMaskedBox.classList.add("glow");
      setTimeout(()=>elMaskedBox.classList.remove("glow"), 250);
      playTone(660, .08);

      if (isRevealed()) {
        showMsg(`You got it! The word was "${word}".`, "ok");
        emitConfetti();
        elOverlay.classList.add("show");
        setTimeout(()=>elOverlay.classList.remove("show"), 800);
        playTone(880, .1); setTimeout(()=>playTone(1175,.12),120);
      }
    } else {
      wrong.add(ch); lives--;
      render(); updateKeyboard();
      showMsg(`Nope. '${ch}' is not in the word.`, "bad");
      elApp.classList.add("shake"); setTimeout(()=>elApp.classList.remove("shake"), 450);
      elApp.classList.add("flash-bad"); setTimeout(()=>elApp.classList.remove("flash-bad"), 200);
      playTone(220, .09);

      if (lives === 0) {
        masked = word.split(""); render(); updateKeyboard();
        showMsg(`Out of lives! The word was "${word}".`, "bad");
        playTone(130, .12);
      }
    }
  } else if (/^[a-z]+$/.test(guess)) {
    // full-word
    if (guess === word) {
      masked = word.split(""); render(); updateKeyboard();
      showMsg(`Exact match! "${word}" 🎉`, "ok");
      emitConfetti();
      elOverlay.classList.add("show");
      setTimeout(()=>elOverlay.classList.remove("show"), 800);
      playTone(880, .1); setTimeout(()=>playTone(1175,.12),120);
    } else {
      lives--; render(); updateKeyboard();
      showMsg("Not it. You lost a life.", "bad");
      elApp.classList.add("shake"); setTimeout(()=>elApp.classList.remove("shake"), 450);
      elApp.classList.add("flash-bad"); setTimeout(()=>elApp.classList.remove("flash-bad"), 200);
      playTone(220, .09);
      if (lives === 0) {
        masked = word.split(""); render(); updateKeyboard();
        showMsg(`Out of lives! The word was "${word}".`, "bad");
        playTone(130, .12);
      }
    }
  } else {
    showMsg("Please enter letters only.", "bad");
  }
}

// ----- UI wiring -----
btnGuess.addEventListener("click", () => {
  handleGuess(elGuess.value);
  elGuess.value = "";
  elGuess.focus();
});
btnReset.addEventListener("click", resetGame);
elGuess.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleGuess(elGuess.value);
    elGuess.value = "";
  }
});
// type letters anywhere (unless typing in the input)
window.addEventListener("keydown", (e) => {
  if (!/^[a-z]$/i.test(e.key)) return;
  if (document.activeElement === elGuess) return;
  handleGuess(e.key);
});

resetGame(); // boot
