// --- CONFIGURATION ---
const allEmojis = ['🍎', '🍌', '🍇', '🍒', '🍋', '🍉', '🍍', '🥝', '🍓', '🍑', '🥥', '🥑', '🍆', '🌽', '🥕'];

// Levels Configuration
const difficulties = {
    easy:   { rows: 3, cols: 4, pairs: 6, time: 30 }, 
    normal: { rows: 4, cols: 4, pairs: 8, time: 45 },
    hard:   { rows: 5, cols: 4, pairs: 10, time: 60 }
};

// Variables
let currentDifficulty = 'normal';
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let totalPairs = 0;
let lockBoard = false;
let timer = null;
let timeLeft = 0;
let flipCount = 0;
let gameActive = false;

// DOM Elements
const board = document.getElementById('game-board');
const timerSpan = document.getElementById('timer');
const flipCounterSpan = document.getElementById('flip-counter');
const bestScoreSpan = document.getElementById('best-score');
const victoryModal = document.getElementById('victory-modal');
const gameOverModal = document.getElementById('game-over-modal');
const finalTimeSpan = document.getElementById('final-time');

// --- SOUND SYSTEM (Fail-Safe) ---
let audioCtx = null;

function initAudio() {
    // Audio Context tabhi banega jab user interact karega, taaki crash na ho
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API not supported");
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, type, duration) {
    if (!audioCtx) return; // Agar sound system fail hai toh silent raho
    
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.error("Sound Error", e);
    }
}

const sounds = {
    flip: () => playTone(300, 'sine', 0.05),
    match: () => { playTone(600, 'sine', 0.1); setTimeout(()=> playTone(900, 'triangle', 0.2), 150); },
    wrong: () => { playTone(150, 'sawtooth', 0.3); },
    win: () => { [400, 500, 600, 800].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2), i*200)); },
    lose: () => { [300, 200, 100].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.4), i*300)); }
};

// --- GAME LOGIC ---

function setDifficulty(level) {
    initAudio(); // User click par audio start karo
    currentDifficulty = level;
    
    // Update Button Styles
    document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active-mode'));
    document.querySelector(`button[onclick="setDifficulty('${level}')"]`).classList.add('active-mode');
    
    restartGame();
}

function updateStats() {
    timerSpan.textContent = `${timeLeft}s`;
    flipCounterSpan.textContent = `${flipCount}`;
    
    // Best score LocalStorage se uthao
    const savedBest = localStorage.getItem(`memory-best-${currentDifficulty}`);
    bestScoreSpan.textContent = savedBest ? savedBest : '-';
}

function startTimer() {
    if (timer) clearInterval(timer);
    
    timer = setInterval(() => {
        if(timeLeft > 0) {
            timeLeft--;
            timerSpan.textContent = `${timeLeft}s`;
            
            // Warning Red Color
            timerSpan.style.color = timeLeft <= 10 ? '#ff5e62' : '#fff';
        } else {
            clearInterval(timer);
            gameLost();
        }
    }, 1000);
}

function shuffle(array) {
    return array.sort(() => 0.5 - Math.random());
}

function restartGame() {
    initAudio(); // Ensure audio context is ready
    gameActive = false;
    if (timer) clearInterval(timer);
    
    // Reset Logic
    const config = difficulties[currentDifficulty];
    timeLeft = config.time;
    flipCount = 0;
    matchedPairs = 0;
    flippedCards = [];
    
    // Hide Modals
    victoryModal.classList.add('hidden');
    gameOverModal.classList.add('hidden');
    timerSpan.style.color = '#fff';
    
    updateStats();
    createBoard();
}

function createBoard() {
    board.innerHTML = ''; // Clear old board
    const config = difficulties[currentDifficulty];
    totalPairs = config.pairs;

    // Grid Columns Set Karo
    board.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;

    // Cards Banao
    const selectedEmojis = allEmojis.slice(0, config.pairs);
    const deck = [...selectedEmojis, ...selectedEmojis];
    shuffle(deck);

    deck.forEach(emoji => {
        const card = document.createElement('div');
        card.classList.add('card');
        // Initial "flip" class add kar rahe hain taaki peek dikhe
        card.classList.add('flip'); 
        
        card.dataset.emoji = emoji;
        card.innerHTML = `<div class="front"></div><div class="back">${emoji}</div>`;
        card.addEventListener('click', flipCard);
        board.appendChild(card);
    });

    // PEEK LOGIC: 2 second baad cards band honge
    lockBoard = true;
    setTimeout(() => {
        const allCards = document.querySelectorAll('.card');
        allCards.forEach(c => c.classList.remove('flip'));
        lockBoard = false;
        gameActive = true;
        startTimer();
    }, 2000); 
}

function flipCard() {
    if (lockBoard || !gameActive) return;
    if (this === flippedCards[0]) return;

    this.classList.add('flip');
    flippedCards.push(this);
    sounds.flip();

    if (flippedCards.length === 2) {
        flipCount++;
        flipCounterSpan.textContent = flipCount;
        checkForMatch();
    }
}

function checkForMatch() {
    const [card1, card2] = flippedCards;
    const isMatch = card1.dataset.emoji === card2.dataset.emoji;

    if (isMatch) {
        disableCards();
        sounds.match();
    } else {
        lockBoard = true;
        sounds.wrong();
        setTimeout(() => {
            card1.classList.remove('flip');
            card2.classList.remove('flip');
            lockBoard = false;
            flippedCards = [];
        }, 1000);
    }
}

function disableCards() {
    flippedCards = [];
    matchedPairs++;
    if (matchedPairs === totalPairs) {
        gameWon();
    }
}

function gameWon() {
    clearInterval(timer);
    gameActive = false;
    sounds.win();
    createConfetti();
    
    const savedBest = localStorage.getItem(`memory-best-${currentDifficulty}`);
    if (!savedBest || flipCount < parseInt(savedBest)) {
        localStorage.setItem(`memory-best-${currentDifficulty}`, flipCount);
    }

    finalTimeSpan.textContent = timeLeft;
    victoryModal.classList.remove('hidden');
}

function gameLost() {
    gameActive = false;
    lockBoard = true;
    sounds.lose();
    gameOverModal.classList.remove('hidden');
}

// Confetti Effect
function createConfetti() {
    for(let i=0; i<50; i++) {
        const conf = document.createElement('div');
        conf.classList.add('confetti');
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.animationDuration = Math.random() * 3 + 2 + 's';
        conf.style.background = `hsl(${Math.random()*360}, 100%, 50%)`;
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 5000);
    }
}

// Global Event Listeners
document.getElementById('refresh-btn').addEventListener('click', restartGame);

// Start Game
restartGame();