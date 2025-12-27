const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ASSETS & PRELOADING ---
const characters = [1, 2, 3, 4, 5, 6, 7, 8];
const obstacleIds = [9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46];

let playerSprite = new Image(); 
let selectedCharId = 1;
let objectsJumped = [];
let obstacles = [];

const imageLibrary = {};
let totalAssets = characters.length + obstacleIds.length + 2; 
let loadedAssets = 0;

function checkLoadingProgress() {
    loadedAssets++;
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        let percentage = Math.floor((loadedAssets / totalAssets) * 100);
        startBtn.textContent = `CARGANDO ${percentage}%`;
    }

    if (loadedAssets === totalAssets) {
        if (startBtn) {
            startBtn.textContent = "INICIAR";
            startBtn.disabled = false; 
            startBtn.style.cursor = "crosshair";
        }
    }
}

// 1. Preload Background
const bgImg = new Image();
bgImg.onload = checkLoadingProgress;
bgImg.src = 'assets/background.jpg';

// NEW: Preload Splash Screen Image for logic tracking
const splashImg = new Image();
splashImg.onload = checkLoadingProgress;
splashImg.src = 'assets/start.png';

// 2. Preload Characters and Obstacles
[...characters, ...obstacleIds].forEach(id => {
    const formattedId = id.toString().padStart(2, '0');
    const img = new Image();
    img.onload = checkLoadingProgress;
    img.onerror = () => {
        console.error(`Failed to load: assets/clay-${formattedId}.png`);
        checkLoadingProgress(); // Still count it so game can start
    };
    img.src = `assets/clay-${formattedId}.png`;
    imageLibrary[formattedId] = img; 
});

// --- CONFIGURATION ---
let currentRound = 1;
const maxRounds = 3;
let totalScore = 0;
let roundScore = 0;
let isGameRunning = false;
let gameSpeed = 7;
let animationId;
let roundScoresHistory = [];
let availableObstacles = [...obstacleIds];
let distanceTraveled = 0;
let bgX = 0;

// --- RAIN ---
let raindrops = [];
const maxRain = 40;

function createRaindrop() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        speed: 12 + Math.random() * 5,
        length: 15 + Math.random() * 10
    };
}

for (let i = 0; i < maxRain; i++) {
    raindrops.push(createRaindrop());
}

let obstacleTimer = 0;
let nextSpawnThreshold = 50;

// --- PLAYER ---
const player = {
    x: 50,
    y: 450, 
    width: 70,
    height: 70,
    dy: 0,
    jumpPower: -24,
    gravity: 1.6,
    grounded: false,
    jumpCount: 0,
    maxJumps: 2
};

const music = document.getElementById('bg-music');

// --- START: CHARACTER SELECTION ---
window.addEventListener('DOMContentLoaded', () => {
    const charGrid = document.getElementById('character-grid');
    if (charGrid) {
        characters.forEach(id => {
            let img = document.createElement('img');
            let formattedId = id.toString().padStart(2, '0');
            img.src = `assets/clay-${formattedId}.png`;
            img.className = 'char-select-img';
            img.onclick = () => startGame(formattedId);
            charGrid.appendChild(img);
        });
    }
});

function startGame(charId) {
    selectedCharId = charId;
    // FIX: Assign the actual Image object from the library
    playerSprite = imageLibrary[charId]; 
    
    availableObstacles = [...obstacleIds];
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('tutorial-screen').classList.remove('hidden');
}

function beginGameplay() {
    document.getElementById('tutorial-screen').classList.add('hidden');
    if (music) music.play().catch(e => console.log("Audio requires interaction"));
    resetRound();
    isGameRunning = true;
    loop();
}

// --- CONTROLS ---
function performJump() {
    if (!isGameRunning) return;
    if (player.grounded) {
        player.dy = player.jumpPower;
        player.grounded = false;
        player.jumpCount = 1;
    } else if (player.jumpCount < player.maxJumps) {
        player.dy = player.jumpPower * 0.8;
        player.jumpCount++;
    }
}

document.addEventListener('keydown', (e) => { if (e.code === 'Space') performJump(); });
canvas.addEventListener('mousedown', performJump);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    performJump();
}, { passive: false });

function spawnObstacle() {
    if (availableObstacles.length === 0) availableObstacles = [...obstacleIds];
    let randomIndex = Math.floor(Math.random() * availableObstacles.length);
    let randId = availableObstacles.splice(randomIndex, 1)[0];
    let formattedId = randId.toString().padStart(2, '0');

    obstacles.push({
        x: canvas.width,
        y: 480,
        width: 60,
        height: 60,
        img: imageLibrary[formattedId], 
        passed: false
    });
}

function loop() {
    if (!isGameRunning) return;
    distanceTraveled += gameSpeed / 80;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    if (bgImg.complete) {
        const scale = canvas.height / bgImg.height;
        const renderWidth = bgImg.width * scale;
        bgX -= gameSpeed * 0.4;
        if (bgX <= -renderWidth) bgX += renderWidth;
        ctx.drawImage(bgImg, Math.floor(bgX), 0, renderWidth + 1, canvas.height);
        ctx.drawImage(bgImg, Math.floor(bgX + renderWidth), 0, renderWidth + 1, canvas.height);
    }

    // Rain
    ctx.strokeStyle = 'rgba(200, 200, 220, 0.4)';
    ctx.lineWidth = 1;
    raindrops.forEach(drop => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.stroke();
        drop.y += drop.speed;
        if (drop.y > canvas.height) { drop.y = -20; drop.x = Math.random() * canvas.width; }
    });

    // Player Physics
    player.dy += player.gravity;
    player.y += player.dy;
    if (player.y + player.height > 540) {
        player.y = 540 - player.height;
        player.dy = 0;
        player.grounded = true;
        player.jumpCount = 0;
    }
    ctx.drawImage(playerSprite, player.x, player.y, player.width, player.height);

    // Obstacles
    obstacleTimer++;
    if (obstacleTimer > nextSpawnThreshold) {
        spawnObstacle();
        obstacleTimer = 0;
        nextSpawnThreshold = Math.floor((350 + Math.random() * 350) / gameSpeed);
    }

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= gameSpeed;
        ctx.drawImage(obs.img, obs.x, obs.y, obs.width, obs.height);

        if (obs.x + obs.width < -100) { obstacles.splice(i, 1); i--; continue; }

        const p = 12; // padding
        if (player.x + p < obs.x + obs.width - p && player.x + player.width - p > obs.x + p &&
            player.y + p < obs.y + obs.height - p && player.y + player.height - p > obs.y + p) {
            endRound();
        }

        if (obs.x + obs.width < player.x && !obs.passed) {
            obs.passed = true;
            roundScore += 10;
            objectsJumped.push(obs.img.src);
            gameSpeed += 0.2; 
        }
    }

    // HUD
    ctx.fillStyle = '#f0f';
    ctx.font = '20px "Courier New"';
    ctx.fillText(`Ronda: ${currentRound}/3 | Distancia: ${Math.floor(distanceTraveled)}m`, 20, 30);
    
    // Progress Bar
    let progress = Math.min((totalScore + Math.floor(distanceTraveled)) / 250, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(20, 45, 200, 10);
    ctx.fillStyle = '#f0f';
    ctx.fillRect(20, 45, 200 * progress, 10);

    animationId = requestAnimationFrame(loop);
}

function endRound() {
    isGameRunning = false;
    cancelAnimationFrame(animationId);
    const metersRun = Math.floor(distanceTraveled);
    totalScore += metersRun;
    roundScoresHistory.push(metersRun); 
    
    const list = document.getElementById('jumped-list');
    list.innerHTML = '';
    objectsJumped.forEach(imgSrc => {
        let img = document.createElement('img');
        img.src = imgSrc;
        img.className = 'summary-img'; 
        list.appendChild(img);
    });

    document.getElementById('round-score').innerHTML = `<h2 style="margin:0;">DISTANCIA RECORRIDA: ${metersRun}m</h2>`;
    document.getElementById('summary-screen').classList.remove('hidden');

    const nextBtn = document.getElementById('next-round-btn');
    if (currentRound < maxRounds) {
        nextBtn.textContent = "VOLVER A ESCAPAR";
        nextBtn.onclick = () => {
            currentRound++;
            document.getElementById('summary-screen').classList.add('hidden');
            resetRound();
            isGameRunning = true;
            loop();
        };
    } else {
        nextBtn.textContent = "Ver Distancia Total";
        nextBtn.onclick = showGameOver;
    }
}

function resetRound() {
    obstacles = [];
    objectsJumped = [];
    roundScore = 0;
    distanceTraveled = 0;
    gameSpeed = currentRound === 1 ? 7 : (currentRound === 2 ? 10 : 13);
    bgX = 0;
    obstacleTimer = 0;
    nextSpawnThreshold = 50;
    player.y = 450;
}

function showGameOver() {
    document.getElementById('summary-screen').classList.add('hidden');
    const endScreen = document.getElementById('game-over-screen');
    const breakdown = document.getElementById('score-breakdown');
    const title = endScreen.querySelector('h1');
    const storyBox = endScreen.querySelector('.narrative-box');
    const mainReloadBtn = endScreen.querySelector('button[onclick="location.reload()"]');

    endScreen.classList.remove('hidden');

    if (totalScore >= 250) {
        breakdown.innerHTML = `<h2 style="color: #f0f;">RECORRES ${totalScore} METROS EN TOTAL</h2>`;
        title.innerHTML = "¡LLEGAS A UNA PANADERÍA!";
        if(mainReloadBtn) mainReloadBtn.style.display = 'none';
        storyBox.innerHTML = `
            <p style="font-size: 1.6rem;">Entras y te...</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="choice-btn" onclick="showVictoryScreen('bunuelo')">A) ENTIERRAS EN UN BUÑUELO</button>
                <button class="choice-btn" onclick="showVictoryScreen('cafe')">B) ZAMBULLES EN UN CAFÉ</button>
                <button class="choice-btn" onclick="showVictoryScreen('tamal')">C) FUSIONAS CON UN TAMAL</button>
            </div>`;
    } else {
        const mathFormula = roundScoresHistory.join(" + ") + " = " + totalScore;
        breakdown.innerHTML = `<h2 style="font-size: 2em; color: #f0f;">${mathFormula} METROS</h2>`;
        title.textContent = "FRACASASTE";
    }
}

function showVictoryScreen(type) {
    const endScreen = document.getElementById('game-over-screen');
    const images = { 'bunuelo': 'assets/bunuelo.png', 'cafe': 'assets/cafe.png', 'tamal': 'assets/tamal.png' };
    endScreen.style.backgroundImage = `url('${images[type]}')`;
    endScreen.style.backgroundSize = 'cover';
    endScreen.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; background: rgba(0,0,0,0.3);">
            <h1 class="neon-text" style="font-size: 5rem; color: #fff;">MMM . . .</h1>
            <div style="background: rgba(255, 0, 255, 0.9); padding: 15px;">
                <p style="color: white; font-weight: bold;">Sana y salva, te quedas por siempre en Bogotá.</p>
            </div>
            <button onclick="restartToCharacterSelect()">JUGAR DE NUEVO</button>
        </div>`;
}

function goToCharacterSelect() {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    if (music) music.play().catch(e => console.log("Music error"));
}

function toggleCredits() {
    document.getElementById('credits-modal').classList.toggle('hidden');
}

function restartToCharacterSelect() {
    // 1. Hide the Game Over screen
    document.getElementById('game-over-screen').classList.add('hidden');
    
    // 2. Show the Character Selection screen
    document.getElementById('start-screen').classList.remove('hidden');

    // 3. Reset all global game variables
    currentRound = 1;
    totalScore = 0;
    roundScore = 0;
    distanceTraveled = 0;
    roundScoresHistory = [];
    isGameRunning = false;
    
    // 4. Stop any leftover music or animations
    cancelAnimationFrame(animationId);
}