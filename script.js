/* ============================================================
   SpeedType Arena — script.js
   Pure vanilla JavaScript — no dependencies required
   ============================================================ */

'use strict';

// ---- Paragraph pool -------------------------------------------------------
const PARAGRAPHS = [
  "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. As with all matters of the heart, you'll know when you find it.",
  "Design is not just what it looks like and feels like. Design is how it works. A beautifully crafted interface is only as good as the underlying logic and structure that supports it.",
  "In the beginning was the Word, and the Word was with Code, and the Code was elegant. The programmer who masters simplicity has mastered the hardest craft of all.",
  "The Internet is the world's largest library. It's just that all the books are on the floor. Organization, indexing, and search are the invisible arts that make it navigable.",
  "Every great developer you know got there by solving problems they were unqualified to solve until they did it. Competence follows commitment, not the other way around.",
  "Speed is a habit. The typist who reaches a hundred words per minute did not get there in a day. They got there by showing up, day after day, with intention and focus.",
  "The universe is under no obligation to make sense to you. But mathematics is, and code is its closest cousin — a language the universe secretly speaks when no one is listening.",
  "Simplicity is the ultimate sophistication. When you finally understand a complex problem well enough to express it simply, you have achieved something most people never will.",
  "A ship in harbor is safe, but that is not what ships are for. The same is true of ideas trapped inside heads, code that never ships, and skills that are never tested.",
  "Not all those who wander are lost. Some are refactoring. Some are debugging a race condition that only appears on production at three in the morning under a full moon.",
  "The measure of intelligence is the ability to change. Rigid systems rot, rigid minds stagnate. Adaptability is the only durable competitive advantage in a world of exponential change.",
  "To iterate is human, to recurse divine. The programmer who understands recursion understands something fundamental about the nature of thought, structure, and self-reference.",
  "In three words I can sum up everything I have learned about life: it goes on. In three words I can sum up everything about software: it gets refactored.",
  "The best time to plant a tree was twenty years ago. The second best time is now. The best time to write tests for your code was when you wrote the code. The second best time is now.",
  "It is not the strongest of the species that survives, nor the most intelligent. It is the one most adaptable to change. In software, that means the one with the cleanest architecture.",
  "Reality is merely an illusion, albeit a very persistent one. Abstractions are the programmer's way of bending that persistence — creating new realities layer by layer.",
  "Two things are infinite: the universe and human stupidity, and I'm not sure about the universe. But I am sure that both can be modeled, given enough memory and processing time.",
  "The secret of getting ahead is getting started. The secret of getting started is breaking your complex overwhelming tasks into small manageable tasks, and then starting on the first one.",
  "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away. Refactoring is the pursuit of that elusive, minimal, essential form.",
  "What we think, we become. The programmer who thinks in systems thinks systemically. The typist who thinks in flow types in flow. The mind shapes the fingers, and the fingers shape the world.",
];

// ---- State ----------------------------------------------------------------
const state = {
  mode: 'idle',         // idle | active | finished | practice
  timerDuration: 60,    // seconds (0 = practice)
  timeLeft: 60,
  paragraphIndex: 0,
  paragraphs: [],       // shuffled for this session
  charIndex: 0,         // cursor position in full text
  fullText: '',         // current paragraph(s) text
  typedCorrect: 0,
  typedTotal: 0,
  correctChars: 0,
  totalTyped: 0,
  wpmHistory: [],       // {t: elapsed_seconds, wpm: number}[]
  startTime: null,
  timerInterval: null,
  wpmInterval: null,
  focused: false,
  tabHeld: false,
};

// ---- DOM refs -------------------------------------------------------------
const $ = id => document.getElementById(id);
const typingArea   = $('typingArea');
const typingText   = $('typingText');
const hiddenInput  = $('hiddenInput');
const timerDisplay = $('timerDisplay');
const liveWpm      = $('liveWpm');
const liveAcc      = $('liveAcc');
const progressBar  = $('progressBar');
const typingHint   = $('typingHint');
const resultsOverlay     = $('resultsOverlay');
const dailyBestEl  = $('dailyBest');
const dailyBestVal = $('dailyBestVal');

// ---- Helpers --------------------------------------------------------------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcWpm(correctChars, elapsedMs) {
  const minutes = elapsedMs / 60000;
  if (minutes < 0.0001) return 0;
  return Math.round((correctChars / 5) / minutes);
}

function calcAcc(correct, total) {
  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}

// ---- Daily Best -----------------------------------------------------------
function getDailyBest() {
  try {
    const saved = JSON.parse(localStorage.getItem('sta_daily_best') || 'null');
    if (!saved) return null;
    const today = new Date().toDateString();
    if (saved.date !== today) return null;
    return saved;
  } catch { return null; }
}

function saveDailyBest(wpm, acc) {
  const today = new Date().toDateString();
  localStorage.setItem('sta_daily_best', JSON.stringify({ wpm, acc, date: today }));
}

function updateDailyBestUI() {
  const best = getDailyBest();
  if (best) {
    dailyBestEl.style.display = 'flex';
    dailyBestVal.textContent = best.wpm;
  } else {
    dailyBestEl.style.display = 'none';
  }
}

// ---- Theme ----------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('themeIcon').textContent = theme === 'dark' ? '\u2600' : '\u263D';
  localStorage.setItem('sta_theme', theme);
}

function loadTheme() {
  const saved = localStorage.getItem('sta_theme') || 'dark';
  applyTheme(saved);
}

$('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ---- Text rendering -------------------------------------------------------
function renderText() {
  typingText.innerHTML = '';
  for (let i = 0; i < state.fullText.length; i++) {
    const span = document.createElement('span');
    span.className = 'char untyped' + (i === state.charIndex ? ' cursor' : '');
    span.textContent = state.fullText[i];
    span.dataset.idx = i;
    typingText.appendChild(span);
  }
}

function updateChar(idx, cls) {
  const span = typingText.querySelector(`[data-idx="${idx}"]`);
  if (!span) return;
  span.className = 'char ' + cls + (idx === state.charIndex ? ' cursor' : '');
}

function moveCursor(oldIdx, newIdx) {
  // Remove cursor class from old
  const old = typingText.querySelector(`[data-idx="${oldIdx}"]`);
  if (old) old.classList.remove('cursor');
  // Add cursor class to new
  const nw = typingText.querySelector(`[data-idx="${newIdx}"]`);
  if (nw) nw.classList.add('cursor');
  // Auto-scroll cursor into view
  if (nw) nw.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ---- Progress & Stats update ----------------------------------------------
function updateStats() {
  const elapsed = state.startTime ? Date.now() - state.startTime : 0;
  const wpm = calcWpm(state.correctChars, elapsed);
  const acc = calcAcc(state.correctChars, state.totalTyped);
  liveWpm.textContent = wpm;
  liveAcc.textContent = acc + '%';

  // Progress
  const pct = Math.min(100, (state.charIndex / state.fullText.length) * 100);
  progressBar.style.width = pct + '%';
}

// ---- Timer ----------------------------------------------------------------
function startTimer() {
  if (state.timerDuration === 0) return; // practice mode
  state.timeLeft = state.timerDuration;
  renderTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    renderTimerDisplay();
    if (state.timeLeft <= 0) {
      endTest();
    }
  }, 1000);
}

function renderTimerDisplay() {
  if (state.timerDuration === 0) {
    timerDisplay.textContent = 'Practice';
    timerDisplay.className = 'stat-value timer-value practice-mode';
    return;
  }
  timerDisplay.textContent = state.timeLeft + 's';
  timerDisplay.className = 'stat-value timer-value' + (state.timeLeft <= 10 ? ' urgent' : '');
}

// ---- WPM history sampling -------------------------------------------------
function startWpmSampling() {
  state.wpmHistory = [];
  state.wpmInterval = setInterval(() => {
    if (!state.startTime) return;
    const elapsed = Date.now() - state.startTime;
    const wpm = calcWpm(state.correctChars, elapsed);
    state.wpmHistory.push({ t: Math.round(elapsed / 1000), wpm });
  }, 1000);
}

// ---- Input handling -------------------------------------------------------
function handleKey(e) {
  if (state.mode === 'idle') {
    if (e.key === 'Tab') return; // let Tab fall through for focus
    beginTest();
  }
  if (state.mode !== 'active' && state.mode !== 'practice') return;

  const key = e.key;

  if (key === 'Backspace') {
    e.preventDefault();
    if (state.charIndex === 0) return;
    const prevIdx = state.charIndex - 1;
    // Undo stats for the previously typed character
    const span = typingText.querySelector(`[data-idx="${prevIdx}"]`);
    const wasCorrect = span && span.classList.contains('correct');
    if (wasCorrect) state.correctChars--;
    state.totalTyped = Math.max(0, state.totalTyped - 1);
    state.charIndex--;
    moveCursor(state.charIndex + 1, state.charIndex);
    // Reset span to untyped
    const s = typingText.querySelector(`[data-idx="${state.charIndex}"]`);
    if (s) s.className = 'char untyped cursor';
    updateStats();
    return;
  }

  if (key.length !== 1) return; // ignore control keys
  e.preventDefault();

  const expected = state.fullText[state.charIndex];
  if (expected === undefined) return;

  const correct = key === expected;
  const cls = correct
    ? 'correct'
    : (expected === ' ' ? 'incorrect space-incorrect' : 'incorrect');

  if (correct) state.correctChars++;
  state.totalTyped++;

  // Update this char appearance, remove cursor from it
  const span = typingText.querySelector(`[data-idx="${state.charIndex}"]`);
  if (span) span.className = 'char ' + cls;

  state.charIndex++;

  // Move cursor to next char
  moveCursor(state.charIndex - 1, state.charIndex);

  updateStats();

  // Practice mode: load next paragraph seamlessly
  if (state.mode === 'practice' && state.charIndex >= state.fullText.length) {
    appendNextParagraph();
  }
}

// ---- Init / Reset ---------------------------------------------------------
function initParagraphs() {
  state.paragraphs = shuffle(PARAGRAPHS);
  state.paragraphIndex = 0;
}

function getParagraph() {
  const p = state.paragraphs[state.paragraphIndex % state.paragraphs.length];
  state.paragraphIndex++;
  return p;
}

function appendNextParagraph() {
  const next = getParagraph();
  state.fullText += ' ' + next;
  // Append new char spans
  const start = typingText.querySelectorAll('.char').length;
  const chars = (' ' + next).split('');
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    const idx = start + i;
    span.className = 'char untyped' + (idx === state.charIndex ? ' cursor' : '');
    span.textContent = ch;
    span.dataset.idx = idx;
    typingText.appendChild(span);
  });
}

function setupTest() {
  initParagraphs();
  state.fullText = getParagraph();
  state.charIndex = 0;
  state.correctChars = 0;
  state.totalTyped = 0;
  state.wpmHistory = [];
  state.startTime = null;

  liveWpm.textContent = '0';
  liveAcc.textContent = '100%';
  progressBar.style.width = '0%';

  if (state.timerDuration === 0) {
    timerDisplay.textContent = 'Practice';
    timerDisplay.className = 'stat-value timer-value practice-mode';
  } else {
    timerDisplay.textContent = state.timerDuration + 's';
    timerDisplay.className = 'stat-value timer-value';
  }

  typingHint.textContent = 'Type to start';
  resultsOverlay.style.display = 'none';

  renderText();
  focusInput();
}

function beginTest() {
  if (state.timerDuration === 0) {
    state.mode = 'practice';
  } else {
    state.mode = 'active';
  }

  state.startTime = Date.now();
  typingHint.textContent = '';

  startTimer();
  startWpmSampling();
}

function endTest() {
  clearInterval(state.timerInterval);
  clearInterval(state.wpmInterval);
  state.mode = 'finished';
  typingHint.textContent = '';

  const elapsed = state.startTime ? Date.now() - state.startTime : 0;
  const wpm = calcWpm(state.correctChars, elapsed);
  const acc = calcAcc(state.correctChars, state.totalTyped);

  // Count words
  const typed = hiddenInput.value;
  const words = state.fullText.split(' ');
  let correctWords = 0, incorrectWords = 0;
  let charPointer = 0;
  words.forEach(word => {
    const typedWord = typed.substr(charPointer, word.length);
    if (typedWord === word) correctWords++; else incorrectWords++;
    charPointer += word.length + 1;
  });
  // Clamp based on how far user got
  const charsDone = state.charIndex;
  const totalWords = Math.ceil(charsDone / 5);
  correctWords = Math.min(correctWords, totalWords);
  incorrectWords = Math.max(0, totalWords - correctWords);

  showResults({ wpm, acc, correctWords, incorrectWords, elapsed });
}

function resetTest() {
  clearInterval(state.timerInterval);
  clearInterval(state.wpmInterval);
  hiddenInput.value = '';
  state.mode = 'idle';
  setupTest();
}

// ---- Results display ------------------------------------------------------
function showResults({ wpm, acc, correctWords, incorrectWords, elapsed }) {
  $('resFinalWpm').textContent = wpm;
  $('resFinalAcc').textContent = acc + '%';
  $('resCorrect').textContent = correctWords;
  $('resIncorrect').textContent = incorrectWords;
  $('resTime').textContent = Math.round(elapsed / 1000) + 's';

  // Daily best
  const best = getDailyBest();
  const isNewBest = !best || wpm > best.wpm;
  $('newBestBadge').style.display = isNewBest ? 'block' : 'none';
  if (isNewBest) saveDailyBest(wpm, acc);
  updateDailyBestUI();

  // Chart
  drawChart(state.wpmHistory);

  resultsOverlay.style.display = 'flex';
}

// ---- Canvas WPM Chart -----------------------------------------------------
function drawChart(history) {
  const canvas = $('wpmChart');
  if (!canvas) return;
  const wrap = $('chartWrap');

  // Hide chart if no data
  if (!history || history.length < 2) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';

  const dpr = window.devicePixelRatio || 1;
  const cssW = wrap.clientWidth - 32; // padding
  const cssH = 100;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const lineColor  = isDark ? '#00d4ff' : '#0099bb';
  const fillColorA = isDark ? 'rgba(0,212,255,0.18)' : 'rgba(0,153,187,0.15)';
  const fillColorB = isDark ? 'rgba(0,212,255,0)' : 'rgba(0,153,187,0)';
  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const maxWpm = Math.max(...history.map(h => h.wpm), 10);
  const W = cssW, H = cssH;
  const padL = 8, padR = 8, padT = 8, padB = 8;

  const xScale = i => padL + (i / (history.length - 1)) * (W - padL - padR);
  const yScale = v => padT + (1 - v / maxWpm) * (H - padT - padB);

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const y = yScale(maxWpm * f);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
  });

  // Fill
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, fillColorA);
  grad.addColorStop(1, fillColorB);

  ctx.beginPath();
  ctx.moveTo(xScale(0), yScale(history[0].wpm));
  for (let i = 1; i < history.length; i++) {
    const x0 = xScale(i - 1), y0 = yScale(history[i-1].wpm);
    const x1 = xScale(i),     y1 = yScale(history[i].wpm);
    const cpx = (x0 + x1) / 2;
    ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
  }
  ctx.lineTo(xScale(history.length - 1), H - padB);
  ctx.lineTo(xScale(0), H - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xScale(0), yScale(history[0].wpm));
  for (let i = 1; i < history.length; i++) {
    const x0 = xScale(i - 1), y0 = yScale(history[i-1].wpm);
    const x1 = xScale(i),     y1 = yScale(history[i].wpm);
    const cpx = (x0 + x1) / 2;
    ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dots at data points
  ctx.fillStyle = lineColor;
  history.forEach((h, i) => {
    ctx.beginPath();
    ctx.arc(xScale(i), yScale(h.wpm), 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---- Focus handling -------------------------------------------------------
function focusInput() {
  hiddenInput.focus();
  typingArea.classList.add('focused');
  state.focused = true;
}

typingArea.addEventListener('click', focusInput);
typingArea.addEventListener('focus', focusInput);

hiddenInput.addEventListener('blur', () => {
  typingArea.classList.remove('focused');
  typingArea.classList.add('unfocused');
  state.focused = false;
  if (state.mode === 'idle') typingHint.textContent = 'Click here to focus';
});

hiddenInput.addEventListener('focus', () => {
  typingArea.classList.add('focused');
  typingArea.classList.remove('unfocused');
  state.focused = true;
  if (state.mode === 'idle') typingHint.textContent = 'Type to start';
});

// ---- Keyboard events ------------------------------------------------------
hiddenInput.addEventListener('keydown', e => {
  // Tab + Enter = restart
  if (state.tabHeld && e.key === 'Enter') {
    e.preventDefault();
    resetTest();
    return;
  }
  if (e.key === 'Tab') {
    state.tabHeld = true;
    e.preventDefault();
    return;
  }
  handleKey(e);
});

hiddenInput.addEventListener('keyup', e => {
  if (e.key === 'Tab') state.tabHeld = false;
});

// Prevent hiddenInput from accumulating characters (we track manually)
hiddenInput.addEventListener('input', () => { hiddenInput.value = ''; });

// ---- Mode selector --------------------------------------------------------
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.mode === 'active') return; // can't change mid-test
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const t = parseInt(btn.dataset.time, 10);
    state.timerDuration = t;
    resetTest();
  });
});

// ---- Action buttons -------------------------------------------------------
$('restartBtn').addEventListener('click', () => {
  resetTest();
});

$('newTextBtn').addEventListener('click', () => {
  // Advance paragraph index so we get a fresh one
  state.paragraphIndex++;
  resetTest();
});

$('tryAgainBtn').addEventListener('click', () => {
  resetTest();
});

$('newTextResultBtn').addEventListener('click', () => {
  state.paragraphIndex++;
  resetTest();
});

// ---- Persist timer preference ---------------------------------------------
function loadTimerPref() {
  const saved = localStorage.getItem('sta_timer');
  if (saved !== null) {
    const t = parseInt(saved, 10);
    state.timerDuration = t;
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('active');
      if (parseInt(btn.dataset.time, 10) === t) btn.classList.add('active');
    });
  }
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    localStorage.setItem('sta_timer', btn.dataset.time);
  });
});

// ---- Boot -----------------------------------------------------------------
loadTheme();
loadTimerPref();
updateDailyBestUI();
state.mode = 'idle';
setupTest();
