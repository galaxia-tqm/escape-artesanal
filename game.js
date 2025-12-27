const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ASSETS & PRELOADING ---
const characters = [1, 2, 3, 4, 5, 6, 7, 8];
const obstacleIds = [9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46];
const victoryNames = ['bunuelo', 'cafe', 'tamal'];

let playerSprite = new Image(); 
let selectedCharId = 1;
let objectsJumped = [];
let obstacles = [];

const imageLibrary = {};
// MATH: 8 chars + 37 obstacles + 3 victory + 2 (bg & splash) = 50 total images
let totalAssets = characters.length + obstacleIds.length + victoryNames.length + 2; 
let loadedAssets = 0;

function checkLoadingProgress() {
    loadedAssets++;
    const startBtn = document.getElementById('start-btn');
    
    let percentage = Math.floor((loadedAssets / totalAssets) * 100);
    if (startBtn) {
        startBtn.textContent = `CARGANDO ${percentage}%`;
    }

    if (loadedAssets >= totalAssets) {
        if (startBtn) {
            startBtn.textContent = "INICIAR";
            startBtn.disabled = false; 
            startBtn.style.cursor = "crosshair";
        }
    }
}

// 1. Preload Background & Splash
const bgImg = new Image();
bgImg.onload = checkLoadingProgress;
bgImg.onerror = checkLoadingProgress;
bgImg.src = 'assets/background.jpg';

const splashImg = new Image();
splashImg.onload = checkLoadingProgress;
splashImg.onerror = checkLoadingProgress;
splashImg.src = 'assets/start.png';

// 2. Preload Victory Screens
victoryNames.forEach(name => {
    const img = new Image();
    img.onload = checkLoadingProgress;
    img.onerror = checkLoadingProgress; 
    img.src = `assets/${name}.png`;
    imageLibrary[name] = img;
});

// 3. Preload Characters and Obstacles
[...characters, ...obstacleIds].forEach(id => {
    const formattedId = id.toString().padStart(2, '0');
    const img = new Image();
    img.onload = checkLoadingProgress;
    img.onerror = checkLoadingProgress;
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
for (let i = 0; i < maxRain; i++) {
    raindrops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        speed: 12 + Math.random() * 5,
        length: 15 + Math.random() * 10
    });
}

let obstacleTimer = 0;
let nextSpawnThreshold = 50;

const player = {
    x: 50, y: 450, width: 70, height: 70, dy: 0,
    jumpPower: -24, gravity: 1.6, grounded: false, jumpCount: 0, maxJumps: 2
};

const music = document.getElementById('bg-music');

// --- CHARACTER SELECTION ---
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
    playerSprite = imageLibrary[charId]; 
    availableObstacles = [...obstacleIds];

    document.getElementById('start-screen').classList.add('hidden');
    
    // Draw one frame so it's not black behind the tutorial
    drawFrozenFrame();
    document.getElementById('tutorial-screen').classList.remove('hidden');
}

function beginGameplay() {
    document.getElementById('tutorial-screen').classList.add('hidden');
    if (music) music.play().catch(e => console.log("Audio interaction required"));
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
// CHANGED: Listen to 'window' instead of 'canvas' so tapping black bars works
window.addEventListener('touchstart', (e) => {
    // Only interfere if the game is actually running
    if (isGameRunning) {
        // Prevent scrolling/zooming while playing
        e.preventDefault(); 
        performJump();
    }
    // If game is NOT running (menus), we do nothing, 
    // so your Start/Restart buttons still work.
}, { passive: false });

function spawnObstacle() {
    if (availableObstacles.length === 0) availableObstacles = [...obstacleIds];
    let randomIndex = Math.floor(Math.random() * availableObstacles.length);
    let randId = availableObstacles.splice(randomIndex, 1)[0];
    let formattedId = randId.toString().padStart(2, '0');

    obstacles.push({
        x: canvas.width, y: 480, width: 60, height: 60,
        img: imageLibrary[formattedId], passed: false
    });
}

function loop() {
    if (!isGameRunning) return;
    distanceTraveled += gameSpeed / 80;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (bgImg.complete) {
        const scale = canvas.height / bgImg.height;
        const renderWidth = bgImg.width * scale;
        bgX -= gameSpeed * 0.4;
        if (bgX <= -renderWidth) bgX += renderWidth;
        ctx.drawImage(bgImg, Math.floor(bgX), 0, renderWidth + 1, canvas.height);
        ctx.drawImage(bgImg, Math.floor(bgX + renderWidth), 0, renderWidth + 1, canvas.height);
    }

    raindrops.forEach(drop => {
        ctx.strokeStyle = 'rgba(200, 200, 220, 0.4)';
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.stroke();
        drop.y += drop.speed;
        if (drop.y > canvas.height) { drop.y = -20; drop.x = Math.random() * canvas.width; }
    });

    player.dy += player.gravity;
    player.y += player.dy;
    if (player.y + player.height > 540) {
        player.y = 540 - player.height;
        player.dy = 0;
        player.grounded = true;
        player.jumpCount = 0;
    }
    ctx.drawImage(playerSprite, player.x, player.y, player.width, player.height);

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

        const p = 12;
        if (player.x + p < obs.x + obs.width - p && player.x + player.width - p > obs.x + p &&
            player.y + p < obs.y + obs.height - p && player.y + player.height - p > obs.y + p) {
            endRound();
        }

        if (obs.x + obs.width < player.x && !obs.passed) {
            obs.passed = true;
            roundScore += 10;
            objectsJumped.push(obs.img.src);
            gameSpeed += 1; 
        }
    }

    ctx.fillStyle = '#f0f';
    ctx.font = '20px "Courier New"';
    ctx.fillText(`Ronda: ${currentRound}/3 | Distancia: ${Math.floor(distanceTraveled)}m`, 20, 30);
    
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
    
    if (currentRound >= maxRounds) {
        showGameOver();
        return;
    }

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
    nextBtn.textContent = "VOLVER A ESCAPAR";
    nextBtn.onclick = () => {
        currentRound++;
        document.getElementById('summary-screen').classList.add('hidden');
        resetRound();
        isGameRunning = true;
        loop();
    };
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
    
    // NOTE: Elements inside might be missing if previous round was a victory
    // The restartToCharacterSelect function now handles restoring them.
    let breakdown = document.getElementById('score-breakdown');
    let title = endScreen.querySelector('h1');
    let storyBox = endScreen.querySelector('.narrative-box');
    
    endScreen.classList.remove('hidden');

    if (totalScore >= 250) {
        // --- WIN (PANADERÍA) ---
        // Find the restart button if it exists and HIDE it
        const restartBtn = endScreen.querySelector('button[onclick*="restartToCharacterSelect"]');
        if (restartBtn) restartBtn.style.display = 'none';

        if (breakdown) breakdown.innerHTML = `<h2 style="color: #f0f;">RECORRES ${totalScore} METROS EN TOTAL</h2>`;
        if (title) title.innerHTML = "¡LLEGAS A UNA PANADERÍA!";
        
        if (storyBox) {
            storyBox.innerHTML = `
                <p style="font-size: 1.6rem;">Entras y te...</p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="choice-btn" onclick="showVictoryScreen('bunuelo')">A) ENTIERRAS EN UN BUÑUELO</button>
                    <button class="choice-btn" onclick="showVictoryScreen('cafe')">B) ZAMBULLES EN UN CAFÉ</button>
                    <button class="choice-btn" onclick="showVictoryScreen('tamal')">C) FUSIONAS CON UN TAMAL</button>
                </div>`;
        }
    } else {
        // --- LOSE (FRACASO) ---
        // Find the restart button and ensure it is VISIBLE
        const restartBtn = endScreen.querySelector('button[onclick*="restartToCharacterSelect"]');
        if (restartBtn) restartBtn.style.display = 'block';

        const mathFormula = roundScoresHistory.join(" + ") + " = " + totalScore;
        if (breakdown) breakdown.innerHTML = `<h2 style="font-size: 2em; color: #f0f;">${mathFormula} METROS</h2>`;
        if (title) title.textContent = "FRACASASTE";
        
        if (storyBox) {
            storyBox.innerHTML = `
                 <p>Te mudas a Costa Rica con tu turista.</p>
                 <p>Te das cuenta de que San José no está tan mal: también llueve; también, a veces, hace alguito de frío.</p> 
            `;
        }
    }
}

function showVictoryScreen(type) {
    const endScreen = document.getElementById('game-over-screen');
    const preImg = imageLibrary[type];
    
    endScreen.style.padding = '0';
    
    endScreen.style.backgroundImage = `url('${preImg.src}')`;
    endScreen.style.backgroundSize = 'cover';
    endScreen.style.backgroundPosition = 'center';
    endScreen.style.backgroundRepeat = 'no-repeat';

    endScreen.innerHTML = `
        <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            background: rgba(0,0,0,0.3);
        ">
            <h1 class="neon-text" style="font-size: 4rem; color: #fff; margin-bottom: 15px;">MMM . . .</h1>
            
            <div style="
                background: rgba(255, 0, 255, 0.9); 
                padding: 10px 15px; 
                max-width: 80%; 
                text-align: center;
                border: 2px solid #fff; 
            ">
                <p style="
                    color: white; 
                    font-weight: bold; 
                    margin: 0; 
                    font-size: 1rem; 
                    line-height: 1.4;
                ">
                    Sana y salva, te quedas por siempre en Bogotá.
                </p>
            </div>

            <button onclick="restartToCharacterSelect()" class="pixel-btn" style="margin-top: 25px; padding: 15px 30px; font-size: 1.1rem;">JUGAR DE NUEVO</button>
        </div>`;
}

function drawFrozenFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgImg.complete) {
        const scale = canvas.height / bgImg.height;
        ctx.drawImage(bgImg, 0, 0, bgImg.width * scale, canvas.height);
    }
    ctx.drawImage(playerSprite, player.x, player.y, player.width, player.height);
}

function restartToCharacterSelect() {
    // 1. Reset logic variables
    currentRound = 1;
    totalScore = 0;
    roundScore = 0;
    distanceTraveled = 0;
    roundScoresHistory = [];
    isGameRunning = false;
    cancelAnimationFrame(animationId);

    // 2. Hide Screen
    const endScreen = document.getElementById('game-over-screen');
    endScreen.classList.add('hidden');
    endScreen.style.backgroundImage = '';
    endScreen.style.padding = '';

    // 3. IMPORTANT: Restore the original HTML structure of the Game Over screen
    // This fixes the bug where "Fracasaste" screen disappears after a Victory.
    endScreen.innerHTML = `
        <div id="score-breakdown" style="margin-top: 10px; margin-bottom: 20px;"></div>
        <h1 class="neon-text title-large">FRACASASTE</h1> 
        <div class="narrative-box" style="margin-bottom: 20px;"></div>
        <button class="pixel-btn" onclick="restartToCharacterSelect()">Jugar de Nuevo</button>
    `;

    // 4. Show Start Screen
    document.getElementById('start-screen').classList.remove('hidden');
}

function goToCharacterSelect() {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    
    if (music) {
        music.play().catch(e => console.log("Music requires interaction"));
    }
}

function toggleCredits() {
    const modal = document.getElementById('credits-modal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
}

// --- PAUSE MUSIC WHEN TAB IS HIDDEN/PHONE LOCKED ---
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // The user left the tab or locked the phone
        if (music) music.pause();
    } else {
        // The user came back. Only resume if we are past the splash screen.
        const splashScreen = document.getElementById('splash-screen');
        if (music && splashScreen && splashScreen.classList.contains('hidden')) {
            music.play().catch(e => console.log("Resume failed:", e));
        }
    }
});