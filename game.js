// game.js

/**
 * Cyber Blaster - Modular Light Gun Shooter Engine
 */

const GAME_CONFIG = {
  LOGICAL_WIDTH: 1280,
  LOGICAL_HEIGHT: 720,
  STARTING_LIVES: 3,
  MAX_LIVES: 5,
  STARTING_TIME: 30,
  MAGAZINE_SIZE: 6,
  MAX_COMBO: 5,
  COMBO_TIMER: 1.5,
  
  BASE_THREAT_TIME: 3500,
  PERK_LIFETIME: 2200,
  PERK_SPAWN_CHANCE: 0.80,
  PERK_TIMER_BONUS: 8.0,
  HOSTAGE_PENALTY_LIVES: 1,
  
  HUD_HEIGHT: 70,
  BOTTOM_HUD_HEIGHT: 100,
  SAFE_PADDING: 35,
  OBSTACLE_BUFFER: 45,
  OBSTACLE_MIN_GAP: 80,
  ENEMY_RADIUS: 48,
  PERK_RADIUS: 36,
  ENEMY_MIN_SEPARATION: 110,
  
  POINTS: {
    ENEMY: 100,
    HOSTAGE: -250,
    PERK: 50
  },
  
  MOVEMENT_PATTERNS: ['static', 'horizontal', 'vertical', 'slow_moving', 'diagonal', 'fast', 'cover']
};

class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playShoot() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playHit() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playReload() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playDamage() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }
}

class Particle {
  constructor(x, y, color, speed) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = (Math.random() - 0.5) * speed;
    this.vy = (Math.random() - 0.5) * speed;
    this.radius = Math.random() * 3 + 2;
    this.alpha = 1;
    this.decay = Math.random() * 0.03 + 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.alpha = 1.0;
    this.vy = -1.5;
  }

  update() {
    this.y += this.vy;
    this.alpha -= 0.02;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class LightGunGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // DOM Elements
    this.hudTop = document.getElementById('hud');
    this.hudBottom = document.getElementById('bottom-hud');
    this.scoreEl = document.getElementById('score-val');
    this.timeEl = document.getElementById('time-val');
    this.livesEl = document.getElementById('lives-val');
    this.ammoEl = document.getElementById('ammo-val');
    this.comboHud = document.getElementById('combo-hud');
    this.comboEl = document.getElementById('combo-val');
    this.comboBarFill = document.getElementById('combo-bar-fill');
    this.roundEl = document.getElementById('round-val');
    this.waveEl = document.getElementById('wave-val');
    this.reloadPrompt = document.getElementById('reload-prompt');
    this.touchReloadBtn = document.getElementById('touch-reload-btn');

    // Screen Overlays
    this.mainMenuScreen = document.getElementById('main-menu-screen');
    this.instructionScreen = document.getElementById('instruction-screen');
    this.leaderboardScreen = document.getElementById('leaderboard-screen');
    this.nameEntryScreen = document.getElementById('name-entry-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.orientationOverlay = document.getElementById('orientation-overlay');

    // Input & Stats Elements
    this.arcadeInput = document.getElementById('arcade-name-input');
    this.btnSubmitName = document.getElementById('btn-submit-name');
    this.goScoreVal = document.getElementById('go-score-val');
    this.goHighScoreVal = document.getElementById('go-highscore-val');
    this.goRankContainer = document.getElementById('go-rank-container');
    this.goRankVal = document.getElementById('go-rank-val');

    this.sound = new SoundEngine();

    // Mode States: 'MAIN_MENU', 'PLAYING', 'GAME_OVER_ANIM', 'NAME_ENTRY', 'GAME_OVER_SCREEN'
    this.gameMode = 'MAIN_MENU';

    this.state = {
      score: 0,
      lives: GAME_CONFIG.STARTING_LIVES,
      timeRemaining: GAME_CONFIG.STARTING_TIME,
      ammo: GAME_CONFIG.MAGAZINE_SIZE,
      combo: 0,
      comboTimer: 0,
      round: 1,
      waveInRound: 1,
      gameOverTriggered: false,
      roundBannerTimer: 0,
      gameOverAnimTimer: 0,
      
      // Machine Gun Perk State
      isMachineGun: false,
      mgAmmo: 0,
      
      // Multiplier Perk State
      multiplierActive: false,
      multiplierTimer: 0,
      multiplierDuration: 10.0
    };

    this.isPointerDown = false;
    this.mgShotFired = false;
    this.mgFireTimer = 0;
    this.mgFireInterval = 0.1;

    this.screenFlash = { color: '', timer: 0, maxDuration: 0.15 };

    this.targets = [];
    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.bulletHoles = [];
    this.screenShake = 0;
    this.crosshair = { x: -100, y: -100 };
    this.lastTimestamp = 0;
    
    this.waveThreatTimer = 0;
    this.waveThreatDuration = GAME_CONFIG.BASE_THREAT_TIME;
    this.perksSpawnedInWave = 0;
    this.maxPerksInWave = 1;
    this.perkTimers = [];
    this.lastWaveHadMultiplePerks = false;

    this.leaderboardKey = 'cyber_blaster_leaderboard';
    this.leaderboard = this.loadLeaderboard();
    this.latestQualifiedRank = -1;
    this.latestPlayerName = '';

    this.setupLayoutClasses();
    this.setupUIEvents();
    this.initMultiplierHUD();
    this.init();
  }

  isMobileTouchDevice() {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth <= 1024 || window.innerHeight <= 768;
    return isMobileUA || (isTouch && isSmallScreen);
  }

  checkOrientationGate() {
    if (!this.isMobileTouchDevice()) {
      if (this.orientationOverlay) this.orientationOverlay.classList.add('hidden');
      return false;
    }

    const isPortrait = window.matchMedia('(orientation: portrait)').matches || (window.innerHeight > window.innerWidth);
    
    if (isPortrait) {
      if (this.orientationOverlay) this.orientationOverlay.classList.remove('hidden');
      if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
      return true;
    } else {
      if (this.orientationOverlay) this.orientationOverlay.classList.add('hidden');
      return false;
    }
  }

  getWavesForRound(round) {
    return Math.min(7, 3 + Math.floor((round - 1) / 5));
  }

  getEnemyCountRangeForRound(round) {
    const step = Math.floor((round - 1) / 3);
    const cycle = Math.floor(step / 3);
    const subStep = step % 3;

    let minCount = 2 + cycle;
    let maxCount = 4 + (cycle * 3) + subStep;

    if (subStep === 2) {
      maxCount += 1;
    }

    minCount = Math.min(5, Math.max(2, minCount));
    maxCount = Math.min(12, Math.max(minCount, maxCount));

    return { min: minCount, max: maxCount };
  }

  getAvailablePatternsForRound(round) {
    if (round === 1) {
      return ['static'];
    } else if (round === 2) {
      return ['static', 'horizontal', 'vertical'];
    } else if (round === 3) {
      return ['static', 'horizontal', 'vertical', 'cover'];
    } else if (round === 4) {
      return ['static', 'horizontal', 'vertical', 'slow_moving', 'cover'];
    } else {
      return ['static', 'horizontal', 'vertical', 'slow_moving', 'diagonal', 'fast', 'cover'];
    }
  }

  getRoundClearTimeReward(clearedRound) {
    const reductions = Math.floor((clearedRound - 1) / 5);
    return Math.max(5, 10 - reductions);
  }

  initMultiplierHUD() {
    if (!document.getElementById('multiplier-hud')) {
      const multHud = document.createElement('div');
      multHud.id = 'multiplier-hud';
      multHud.className = 'hud-item hud-multiplier hidden';
      multHud.innerHTML = `
        <div class="multiplier-badge"><span class="mult-icon">2x</span><span class="mult-title">MULTIPLIER</span></div>
        <div id="multiplier-bar"><div id="multiplier-bar-fill"></div></div>
      `;
      if (this.hudBottom) {
        this.hudBottom.appendChild(multHud);
      }
    }
    this.multiplierHud = document.getElementById('multiplier-hud');
    this.multiplierBarFill = document.getElementById('multiplier-bar-fill');
  }

  loadLeaderboard() {
    try {
      const data = localStorage.getItem(this.leaderboardKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed.slice(0, 10);
      }
    } catch (e) {
      console.warn('Leaderboard load error:', e);
    }
    return [];
  }

  saveLeaderboard() {
    try {
      localStorage.setItem(this.leaderboardKey, JSON.stringify(this.leaderboard));
    } catch (e) {
      console.warn('Leaderboard save error:', e);
    }
  }

  getHighScore() {
    if (this.leaderboard.length > 0) {
      return this.leaderboard[0].score;
    }
    return 0;
  }

  qualifiesForTop10(score) {
    if (score <= 0) return false;
    if (this.leaderboard.length < 10) return true;
    return score > this.leaderboard[this.leaderboard.length - 1].score;
  }

  insertScore(name, score) {
    const entry = { name: name.toUpperCase(), score };
    this.leaderboard.push(entry);
    this.leaderboard.sort((a, b) => b.score - a.score);
    if (this.leaderboard.length > 10) {
      this.leaderboard = this.leaderboard.slice(0, 10);
    }
    this.saveLeaderboard();
    return this.leaderboard.findIndex(e => e === entry) + 1;
  }

  setupLayoutClasses() {
    if (this.livesEl && this.livesEl.parentElement) {
      this.livesEl.parentElement.classList.add('hud-lives');
    }
    if (this.comboHud) {
      this.comboHud.classList.add('hud-combo');
    }
    if (this.ammoEl && this.ammoEl.parentElement) {
      this.ammoEl.parentElement.classList.add('hud-ammo');
    }
  }

  setupUIEvents() {
    document.getElementById('btn-play').addEventListener('click', () => {
      if (this.checkOrientationGate()) return;
      this.startNewGame();
    });
    document.getElementById('btn-instruction').addEventListener('click', () => {
      this.mainMenuScreen.classList.add('hidden');
      this.instructionScreen.classList.remove('hidden');
    });
    document.getElementById('btn-instruction-back').addEventListener('click', () => {
      this.instructionScreen.classList.add('hidden');
      this.mainMenuScreen.classList.remove('hidden');
    });

    document.getElementById('btn-leaderboard').addEventListener('click', () => {
      this.renderLeaderboardTable();
      this.mainMenuScreen.classList.add('hidden');
      this.leaderboardScreen.classList.remove('hidden');
    });
    document.getElementById('btn-leaderboard-back').addEventListener('click', () => {
      this.leaderboardScreen.classList.add('hidden');
      this.mainMenuScreen.classList.remove('hidden');
    });

    this.arcadeInput.addEventListener('input', () => {
      this.arcadeInput.value = this.arcadeInput.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      this.btnSubmitName.disabled = this.arcadeInput.value.length !== 3;
    });

    this.btnSubmitName.addEventListener('click', () => {
      if (this.arcadeInput.value.length === 3) {
        this.latestPlayerName = this.arcadeInput.value.toUpperCase();
        this.latestQualifiedRank = this.insertScore(this.latestPlayerName, this.state.score);
        this.nameEntryScreen.classList.add('hidden');
        this.showGameOverScreen();
      }
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
      if (this.checkOrientationGate()) return;
      this.gameOverScreen.classList.add('hidden');
      this.startNewGame();
    });

    document.getElementById('btn-go-main-menu').addEventListener('click', () => {
      this.gameOverScreen.classList.add('hidden');
      this.showMainMenu();
    });
  }

  renderLeaderboardTable() {
    const tbody = document.getElementById('leaderboard-tbody');
    tbody.innerHTML = '';
    if (this.leaderboard.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">NO HIGH SCORES YET</td></tr>';
      return;
    }
    this.leaderboard.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>#${idx + 1}</td><td>${entry.name}</td><td>${entry.score}</td>`;
      tbody.appendChild(tr);
    });
  }

  showMainMenu() {
    this.gameMode = 'MAIN_MENU';
    this.hudTop.classList.add('hidden');
    this.hudBottom.classList.add('hidden');
    if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
    this.mainMenuScreen.classList.remove('hidden');
    this.clearPerkTimers();
    this.targets = [];
    this.obstacles = [];
  }

  startNewGame() {
    if (this.checkOrientationGate()) {
      return;
    }

    this.mainMenuScreen.classList.add('hidden');
    this.instructionScreen.classList.add('hidden');
    this.leaderboardScreen.classList.add('hidden');
    this.nameEntryScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');

    this.hudTop.classList.remove('hidden');
    this.hudBottom.classList.remove('hidden');

    this.resetGame();
    this.gameMode = 'PLAYING';
  }

  init() {
    this.resizeCanvas();
    this.checkOrientationGate();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.checkOrientationGate();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.resizeCanvas();
        this.checkOrientationGate();
      }, 150);
    });

    if (window.matchMedia) {
      window.matchMedia('(orientation: portrait)').addEventListener('change', () => {
        this.checkOrientationGate();
      });
    }

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.checkOrientationGate()) return;
      this.mgShotFired = false;
      this.isPointerDown = true;
      this.updateCrosshair(e);
      this.handleShoot(e);
      this.mgFireTimer = 0;
    });

    this.canvas.addEventListener('pointermove', (e) => {
      this.updateCrosshair(e);
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
      this.mgShotFired = false;
    });

    window.addEventListener('pointercancel', () => {
      this.isPointerDown = false;
      this.mgShotFired = false;
    });

    window.addEventListener('keydown', (e) => {
      if (this.gameMode === 'PLAYING' && !this.checkOrientationGate()) {
        if (e.code === 'Space' || e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
          this.reload();
        }
      }
    });

    this.touchReloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.gameMode === 'PLAYING' && !this.checkOrientationGate()) {
        this.reload();
      }
    });

    this.showMainMenu();
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  getPlayableArea() {
    const minY = GAME_CONFIG.HUD_HEIGHT + GAME_CONFIG.SAFE_PADDING;
    const minX = GAME_CONFIG.SAFE_PADDING;
    const maxX = GAME_CONFIG.LOGICAL_WIDTH - GAME_CONFIG.SAFE_PADDING;
    const maxY = GAME_CONFIG.LOGICAL_HEIGHT - GAME_CONFIG.BOTTOM_HUD_HEIGHT - GAME_CONFIG.SAFE_PADDING;
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  resizeCanvas() {
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    const logicalW = GAME_CONFIG.LOGICAL_WIDTH;
    const logicalH = GAME_CONFIG.LOGICAL_HEIGHT;
    const targetAspect = logicalW / logicalH;

    let displayWidth = containerWidth;
    let displayHeight = containerWidth / targetAspect;

    if (displayHeight > containerHeight) {
      displayHeight = containerHeight;
      displayWidth = containerHeight * targetAspect;
    }

    const scale = displayWidth / logicalW;
    document.documentElement.style.setProperty('--game-scale', scale);

    this.canvas.width = logicalW;
    this.canvas.height = logicalH;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  updateCrosshair(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = GAME_CONFIG.LOGICAL_WIDTH / rect.width;
    const scaleY = GAME_CONFIG.LOGICAL_HEIGHT / rect.height;
    this.crosshair.x = (e.clientX - rect.left) * scaleX;
    this.crosshair.y = (e.clientY - rect.top) * scaleY;
  }

  reload() {
    if (this.state.isMachineGun) return;
    if (this.gameMode === 'PLAYING' && this.state.ammo < GAME_CONFIG.MAGAZINE_SIZE && !this.state.gameOverTriggered && !this.checkOrientationGate()) {
      this.state.ammo = GAME_CONFIG.MAGAZINE_SIZE;
      this.sound.playReload();
      this.updateHUD();
    }
  }

  breakCombo() {
    if (this.state.combo > 0) {
      this.triggerComboBreakEffect();
    }
    this.state.combo = 0;
    this.state.comboTimer = 0;
    this.updateHUD();
  }

  triggerComboBreakEffect() {
    if (!this.comboHud) return;
    this.comboHud.classList.remove('combo-active', 'combo-break');
    void this.comboHud.offsetWidth;
    this.comboHud.classList.add('combo-break');
    setTimeout(() => {
      this.comboHud.classList.remove('combo-break');
    }, 350);
  }

  triggerFlash(color, duration = 0.15) {
    this.screenFlash.color = color;
    this.screenFlash.timer = duration;
    this.screenFlash.maxDuration = duration;
  }

  clearPerkTimers() {
    this.perkTimers.forEach(timer => clearTimeout(timer));
    this.perkTimers = [];
  }

  isPointObstructed(x, y, radius = 0, extraBuffer = 0) {
    const totalMargin = radius + extraBuffer;
    for (const obs of this.obstacles) {
      if (
        x + totalMargin >= obs.x &&
        x - totalMargin <= obs.x + obs.w &&
        y + totalMargin >= obs.y &&
        y - totalMargin <= obs.y + obs.h
      ) {
        return true;
      }
    }
    return false;
  }

  isTooCloseToOtherEnemies(x, y, minDistance = GAME_CONFIG.ENEMY_MIN_SEPARATION) {
    const exposedEnemies = this.targets.filter(t => t.type === 'enemy' && t.pattern !== 'cover');
    for (const enemy of exposedEnemies) {
      const dist = Math.hypot(x - enemy.x, y - enemy.y);
      if (dist < minDistance) {
        return true;
      }
    }
    return false;
  }

  isTooCloseToCoverTargets(x, y, radius = GAME_CONFIG.ENEMY_RADIUS) {
    const coverTargets = this.targets.filter(t => t.pattern === 'cover');
    for (const cov of coverTargets) {
      const distHidden = Math.hypot(x - cov.hiddenX, y - cov.hiddenY);
      const distExposed = Math.hypot(x - cov.exposedX, y - cov.exposedY);
      const minSafeDist = radius + cov.radius + 20;
      if (distHidden < minSafeDist || distExposed < minSafeDist) {
        return true;
      }
    }
    return false;
  }

  isNearReservedCoverSpot(obsX, obsY, obsW, obsH, coverSpots, minGap = 70) {
    for (const spot of coverSpots) {
      if (
        spot.x >= obsX - minGap &&
        spot.x <= obsX + obsW + minGap &&
        spot.y >= obsY - minGap &&
        spot.y <= obsY + obsH + minGap
      ) {
        return true;
      }
    }
    return false;
  }

  generateObstaclesForCoverSpecs(coverSpecs) {
    this.obstacles = [];
    if (!coverSpecs || coverSpecs.length === 0) return;

    const area = this.getPlayableArea();
    const EDGE_MARGIN = 75;
    const minPadding = GAME_CONFIG.OBSTACLE_MIN_GAP;

    const obstacleCount = Math.min(3, Math.ceil(coverSpecs.length / 2));
    const specsPerObstacle = Array.from({ length: obstacleCount }, () => []);

    coverSpecs.forEach((spec, idx) => {
      specsPerObstacle[idx % obstacleCount].push(spec);
    });

    for (let i = 0; i < obstacleCount; i++) {
      const specs = specsPerObstacle[i];
      if (specs.length === 0) continue;

      let attempts = 0;
      let placed = false;

      while (!placed && attempts < 150) {
        attempts++;
        const w = 140 + Math.random() * 110;
        const h = 120 + Math.random() * 90;

        const xMin = area.minX + EDGE_MARGIN;
        const xMax = area.maxX - EDGE_MARGIN - w;
        const yMin = area.minY + EDGE_MARGIN;
        const yMax = area.maxY - EDGE_MARGIN - h;

        if (xMax <= xMin || yMax <= yMin) continue;

        const x = xMin + Math.random() * (xMax - xMin);
        const y = yMin + Math.random() * (yMax - yMin);

        let overlaps = false;
        for (const existing of this.obstacles) {
          if (
            x < existing.x + existing.w + minPadding &&
            x + w + minPadding > existing.x &&
            y < existing.y + existing.h + minPadding &&
            y + h + minPadding > existing.y
          ) {
            overlaps = true;
            break;
          }
        }

        if (overlaps) continue;

        const reservedCoverSpots = [];
        const radius = GAME_CONFIG.ENEMY_RADIUS;
        const offset = radius * 1.2;

        specs.forEach((spec) => {
          let cx = x + w / 2;
          let cy = y + h / 2;
          if (spec.side === 0) cy = Math.max(area.minY + radius, y - offset);
          else if (spec.side === 1) cx = Math.min(area.maxX - radius, x + w + offset);
          else if (spec.side === 2) cy = Math.min(area.maxY - radius, y + h + offset);
          else if (spec.side === 3) cx = Math.max(area.minX + radius, x - offset);
          reservedCoverSpots.push({ x: cx, y: cy });
        });

        if (this.isNearReservedCoverSpot(x, y, w, h, reservedCoverSpots, 20)) {
          continue;
        }

        const obstacleObj = { x, y, w, h, assignedSides: new Set() };
        this.obstacles.push(obstacleObj);
        placed = true;
      }
    }
  }

  handleShoot(e) {
    this.sound.init();
    if (this.gameMode !== 'PLAYING' || this.state.gameOverTriggered || this.mgShotFired || this.checkOrientationGate()) {
      return;
    }

    if (e) this.updateCrosshair(e);

    const currentAmmo = this.state.isMachineGun ? this.state.mgAmmo : this.state.ammo;

    if (currentAmmo <= 0) {
      this.sound.playHit();
      return;
    }

    const isLastMgShot = this.state.isMachineGun && this.state.mgAmmo === 1;

    if (this.state.isMachineGun) {
      this.state.mgAmmo--;
      if (this.state.mgAmmo <= 0) {
        this.state.isMachineGun = false;
        this.state.mgAmmo = 0;
        this.mgShotFired = true;
        this.isPointerDown = false;
      }
    } else {
      this.state.ammo--;
    }

    this.sound.playShoot();
    this.screenShake = 5;

    for (let i = 0; i < 8; i++) {
      this.particles.push(new Particle(this.crosshair.x, this.crosshair.y, '#ffcc00', 8));
    }

    let hitTarget = false;
    let hitObstacle = false;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const target = this.targets[i];
      const dist = Math.hypot(this.crosshair.x - target.x, this.crosshair.y - target.y);

      if (dist <= target.radius) {
        if (this.isPointObstructed(this.crosshair.x, this.crosshair.y, 2, 0)) {
          hitObstacle = true;
          this.spawnSparks(this.crosshair.x, this.crosshair.y, '#ff9900');
          continue; 
        }

        hitTarget = true;
        this.processHit(target, i);
        break;
      }
    }

    if (!hitTarget) {
      if (!hitObstacle && this.isPointObstructed(this.crosshair.x, this.crosshair.y, 0, 0)) {
        hitObstacle = true;
        this.spawnSparks(this.crosshair.x, this.crosshair.y, '#ff9900');
      }

      if (!this.state.isMachineGun && !isLastMgShot) {
        this.breakCombo();
      }
      this.bulletHoles.push({ x: this.crosshair.x, y: this.crosshair.y });
    }

    this.updateHUD();
  }

  processHit(target, index) {
    if (target.type === 'enemy' && target.toughness > 1) {
      target.toughness--;
      this.sound.playHit();
      this.spawnSparks(target.x, target.y, '#ffff00');
      
      this.state.comboTimer = GAME_CONFIG.COMBO_TIMER;
      this.updateHUD();
      return;
    }

    this.targets.splice(index, 1);

    const scoreMultiplier = this.state.multiplierActive ? 2 : 1;

    if (target.type === 'enemy') {
      if (this.state.multiplierActive) {
        this.state.combo = Math.min(10, this.state.combo + 1);
      } else {
        this.state.combo = Math.min(GAME_CONFIG.MAX_COMBO, this.state.combo + 1);
      }
      this.state.comboTimer = GAME_CONFIG.COMBO_TIMER;
      
      const effectiveComboVal = this.state.multiplierActive ? Math.min(10, this.state.combo * 2) : this.state.combo;
      const multiplier = Math.round(Math.pow(this.state.combo, 1.5));
      
      const baseEnemyPoints = GAME_CONFIG.POINTS.ENEMY * (target.maxToughness || 1);
      const earnedScore = baseEnemyPoints * Math.max(1, multiplier) * scoreMultiplier;
      this.state.score += earnedScore;
      
      this.sound.playHit();
      this.spawnSparks(target.x, target.y, '#00ffcc');
      this.floatingTexts.push(new FloatingText(target.x, target.y - 10, `+${earnedScore} (x${effectiveComboVal})`, '#00ffcc'));
    } else if (target.type === 'hostage') {
      this.breakCombo();
      this.triggerFlash('rgba(255, 0, 0, 0.25)', 0.15);
      this.state.lives -= GAME_CONFIG.HOSTAGE_PENALTY_LIVES;
      this.state.score = Math.max(0, this.state.score + GAME_CONFIG.POINTS.HOSTAGE);
      this.sound.playDamage();
      this.screenShake = 12;
      this.spawnSparks(target.x, target.y, '#ff3366');
      this.floatingTexts.push(new FloatingText(target.x, target.y - 10, 'HOSTAGE HIT!', '#ff3366'));

      if (this.state.lives <= 0) {
        this.triggerGameOver();
        return;
      } else {
        this.failWave();
        return;
      }
    } else if (target.type === 'perk') {
      this.state.score += GAME_CONFIG.POINTS.PERK * scoreMultiplier;
      this.sound.playReload();

      if (target.perkType === 'extra_life') {
        this.state.lives = Math.min(GAME_CONFIG.MAX_LIVES, this.state.lives + 1);
        this.spawnSparks(target.x, target.y, '#00e664');
        this.floatingTexts.push(new FloatingText(target.x, target.y - 10, '+1 LIFE!', '#00e664'));
      } else if (target.perkType === 'timer_plus') {
        const bonusTime = 5.0 + Math.random() * 5.0;
        this.state.timeRemaining += bonusTime;
        this.spawnSparks(target.x, target.y, '#ffcc00');
        this.floatingTexts.push(new FloatingText(target.x, target.y - 10, `+${bonusTime.toFixed(1)}s TIME!`, '#ffcc00'));
      } else if (target.perkType === 'machine_gun') {
        this.state.isMachineGun = true;
        this.state.mgAmmo = 30;
        this.spawnSparks(target.x, target.y, '#ff00ff');
        this.floatingTexts.push(new FloatingText(target.x, target.y - 10, 'MACHINE GUN!', '#ff00ff'));
      } else if (target.perkType === 'multiplier') {
        this.state.multiplierActive = true;
        this.state.multiplierTimer = 10.0;
        this.spawnSparks(target.x, target.y, '#00e5ff');
        this.floatingTexts.push(new FloatingText(target.x, target.y - 10, '2X MULTIPLIER!', '#00e5ff'));
      }
    }

    this.checkWaveCompletion();
    this.updateHUD();
  }

  failWave() {
    this.triggerFlash('rgba(255, 0, 0, 0.25)', 0.15);
    this.clearPerkTimers();
    this.targets = [];
    this.spawnWave();
  }

  checkWaveCompletion() {
    const enemiesRemaining = this.targets.filter(t => t.type === 'enemy').length;
    
    if (enemiesRemaining === 0) {
      this.clearPerkTimers();
      this.targets = [];

      const requiredWaves = this.getWavesForRound(this.state.round);

      if (this.state.waveInRound >= requiredWaves) {
        const reward = this.getRoundClearTimeReward(this.state.round);
        this.state.timeRemaining += reward;

        const area = this.getPlayableArea();
        this.floatingTexts.push(
          new FloatingText(
            area.minX + area.width / 2,
            area.minY + area.height / 2,
            `+${reward}s ROUND BONUS!`,
            '#00ffcc'
          )
        );

        this.state.waveInRound = 1;
        this.state.round++;
        this.state.roundBannerTimer = 1.8;
        this.triggerFlash('rgba(0, 255, 100, 0.25)', 0.2);
      } else {
        this.state.waveInRound++;
      }

      this.spawnWave();
    }
  }

  spawnSparks(x, y, color) {
    for (let i = 0; i < 15; i++) {
      this.particles.push(new Particle(x, y, color, 12));
    }
  }

  generateArmoredToughness() {
    const round = this.state.round;
    const rand = Math.random();
    
    if (round < 3) {
      return 2;
    } else if (round <= 4) {
      return rand < 0.85 ? 2 : 3;
    } else if (round <= 6) {
      if (rand < 0.60) return 2;
      if (rand < 0.90) return 3;
      return 4;
    } else if (round <= 8) {
      if (rand < 0.40) return 2;
      if (rand < 0.75) return 3;
      if (rand < 0.93) return 4;
      return 5;
    } else {
      if (rand < 0.20) return 2;
      if (rand < 0.50) return 3;
      if (rand < 0.80) return 4;
      return 5;
    }
  }

  spawnWave() {
    this.bulletHoles = [];
    this.clearPerkTimers();

    this.perksSpawnedInWave = 0;
    
    if (this.lastWaveHadMultiplePerks) {
      this.maxPerksInWave = 1;
      this.lastWaveHadMultiplePerks = false;
    } else {
      const allowMultiple = Math.random() < 0.35;
      if (allowMultiple) {
        this.maxPerksInWave = 2;
        this.lastWaveHadMultiplePerks = true;
      } else {
        this.maxPerksInWave = 1;
        this.lastWaveHadMultiplePerks = false;
      }
    }
    
    const range = this.getEnemyCountRangeForRound(this.state.round);
    const totalEnemies = Math.floor(range.min + Math.random() * (range.max - range.min + 1));
    const hostageCount = Math.min(3, Math.floor((this.state.round - 1) * 0.5));
    const area = this.getPlayableArea();

    let activeArmoredCount = 0;
    let totalArmoredToughnessPoints = 0;

    const availablePatterns = this.getAvailablePatternsForRound(this.state.round);

    const enemySpecs = [];
    for (let i = 0; i < totalEnemies; i++) {
      let pattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
      
      let toughness = 1;
      if (this.state.round >= 3) {
        const armChance = Math.min(0.65, 0.2 + (this.state.round - 3) * 0.10);
        if (activeArmoredCount < 2 && Math.random() < armChance) {
          toughness = this.generateArmoredToughness();
          activeArmoredCount++;
          totalArmoredToughnessPoints += (toughness - 1);
        }
      }

      enemySpecs.push({ type: 'enemy', pattern, toughness });
    }

    const hostageSpecs = [];
    for (let i = 0; i < hostageCount; i++) {
      let pattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
      hostageSpecs.push({ type: 'hostage', pattern });
    }

    const coverSpecs = [...enemySpecs, ...hostageSpecs].filter(s => s.pattern === 'cover');
    coverSpecs.forEach((spec, idx) => {
      spec.side = idx % 4;
    });

    this.generateObstaclesForCoverSpecs(coverSpecs);

    const speedMultiplier = 1 + (this.state.round - 1) * 0.15;
    const radius = GAME_CONFIG.ENEMY_RADIUS;

    [...enemySpecs, ...hostageSpecs].forEach((spec) => {
      if (spec.pattern === 'cover' && this.obstacles.length > 0) {
        let availableObs = this.obstacles.filter(o => o.assignedSides.size < 4);
        if (availableObs.length === 0) availableObs = this.obstacles;
        
        const obs = availableObs[Math.floor(Math.random() * availableObs.length)];
        let side = 0;
        for (let s = 0; s < 4; s++) {
          if (!obs.assignedSides.has(s)) {
            side = s;
            break;
          }
        }
        obs.assignedSides.add(side);

        let hiddenX = obs.x + obs.w / 2;
        let hiddenY = obs.y + obs.h / 2;
        let exposedX = hiddenX;
        let exposedY = hiddenY;
        const offset = radius * 1.2;

        if (side === 0) {
          exposedY = Math.max(area.minY + radius, obs.y - offset);
        } else if (side === 1) {
          exposedX = Math.min(area.maxX - radius, obs.x + obs.w + offset);
        } else if (side === 2) {
          exposedY = Math.min(area.maxY - radius, obs.y + obs.h + offset);
        } else {
          exposedX = Math.max(area.minX + radius, obs.x - offset);
        }

        const popupType = Math.random() < 0.5 ? 'single' : 'looping';

        this.targets.push({
          x: hiddenX,
          y: hiddenY,
          baseX: hiddenX,
          baseY: hiddenY,
          radius,
          type: spec.type,
          pattern: 'cover',
          toughness: spec.toughness || 1,
          maxToughness: spec.toughness || 1,
          popupType,
          obstacle: obs,
          hiddenX,
          hiddenY,
          exposedX,
          exposedY,
          coverState: 'initial_wait',
          coverTimer: 0.3 + Math.random() * 0.4,
          coverProgress: 0,
          popSpeed: 2.2 * speedMultiplier
        });

      } else {
        let x, y;
        let attempts = 0;

        do {
          x = area.minX + radius + Math.random() * Math.max(10, area.width - radius * 2);
          y = area.minY + radius + Math.random() * Math.max(10, area.height - radius * 2);
          attempts++;
        } while (
          (this.isPointObstructed(x, y, radius, GAME_CONFIG.OBSTACLE_BUFFER) ||
           this.isTooCloseToCoverTargets(x, y, radius) ||
           (spec.type === 'enemy' && this.isTooCloseToOtherEnemies(x, y, GAME_CONFIG.ENEMY_MIN_SEPARATION))) &&
          attempts < 150
        );

        let baseSpeed = (1.2 + Math.random() * 1.0) * speedMultiplier;
        if (spec.pattern === 'slow_moving') {
          baseSpeed *= 0.5;
        }

        const angle = Math.random() * Math.PI * 2;
        let pattern = spec.pattern === 'cover' ? 'horizontal' : spec.pattern;

        this.targets.push({
          x,
          y,
          baseX: x,
          baseY: y,
          radius,
          type: spec.type,
          pattern,
          toughness: spec.toughness || 1,
          maxToughness: spec.toughness || 1,
          pauseState: 'moving',
          pauseTimer: 0,
          pauseInterval: 1.8 + Math.random() * 2.5,
          vx: pattern === 'static' ? 0 : Math.cos(angle) * baseSpeed,
          vy: pattern === 'static' ? 0 : Math.sin(angle) * baseSpeed
        });
      }
    });

    const enemyThreatBonus = totalEnemies * 450;
    const armorThreatBonus = totalArmoredToughnessPoints * 350;
    const roundPenalty = (this.state.round - 1) * 150;
    this.waveThreatDuration = Math.max(2200, GAME_CONFIG.BASE_THREAT_TIME + enemyThreatBonus + armorThreatBonus - roundPenalty);
    this.waveThreatTimer = this.waveThreatDuration;

    if (Math.random() < GAME_CONFIG.PERK_SPAWN_CHANCE) {
      this.schedulePerkSpawns();
    }
  }

  schedulePerkSpawns() {
    const perksToSpawn = Math.min(this.maxPerksInWave, 1 + Math.floor(Math.random() * this.maxPerksInWave));

    for (let i = 0; i < perksToSpawn; i++) {
      const delay = i === 0 
        ? 100 + Math.random() * 400 
        : 600 + i * 500 + Math.random() * 400;

      const timer = setTimeout(() => {
        if (this.gameMode === 'PLAYING' && !this.state.gameOverTriggered && this.targets.some(t => t.type === 'enemy')) {
          this.spawnPerkTarget();
        }
      }, delay);

      this.perkTimers.push(timer);
    }
  }

  getTimerPlusWeight() {
    const time = this.state.timeRemaining;
    if (time <= 10) return 2.5;
    if (time >= 60) return 0.1;
    return 2.5 - ((time - 10) / 50.0) * (2.5 - 0.1);
  }

  getExtraLifeWeight() {
    if (this.state.lives >= GAME_CONFIG.MAX_LIVES) return 0.05;
    if (this.state.lives === 1) return 1.5;
    return 1.0;
  }

  getMachineGunWeight() {
    const normalWeight = 1.2;
    return this.state.isMachineGun ? (normalWeight * 0.575) : normalWeight;
  }

  selectWeightedPerk(availablePerkTypes) {
    const weights = {};
    availablePerkTypes.forEach((type) => {
      let baseWeight = 1.0;
      if (type === 'timer_plus') baseWeight = this.getTimerPlusWeight();
      else if (type === 'extra_life') baseWeight = this.getExtraLifeWeight();
      else if (type === 'machine_gun') baseWeight = this.getMachineGunWeight();
      weights[type] = baseWeight;
    });

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) return availablePerkTypes[0];

    let randomVal = Math.random() * totalWeight;
    for (const type of availablePerkTypes) {
      if (randomVal < weights[type]) return type;
      randomVal -= weights[type];
    }
    return availablePerkTypes[0];
  }

  spawnPerkTarget() {
    if (this.perksSpawnedInWave >= this.maxPerksInWave) return;

    const availablePerkTypes = ['timer_plus', 'machine_gun'];

    const hasExtraLifeSpawned = this.targets.some(t => t.type === 'perk' && t.perkType === 'extra_life');
    if (!hasExtraLifeSpawned) {
      availablePerkTypes.push('extra_life');
    }

    const hasMultiplierSpawned = this.targets.some(t => t.type === 'perk' && t.perkType === 'multiplier');
    if (!this.state.multiplierActive && !hasMultiplierSpawned) {
      availablePerkTypes.push('multiplier');
    }

    if (availablePerkTypes.length === 0) return;

    this.perksSpawnedInWave++;
    const perkType = this.selectWeightedPerk(availablePerkTypes);

    const area = this.getPlayableArea();
    const radius = GAME_CONFIG.PERK_RADIUS;
    let x, y;
    let attempts = 0;

    do {
      x = area.minX + radius + Math.random() * Math.max(10, area.width - radius * 2);
      y = area.minY + radius + Math.random() * Math.max(10, area.height - radius * 2);
      attempts++;
    } while (this.isPointObstructed(x, y, radius, GAME_CONFIG.OBSTACLE_BUFFER) && attempts < 150);

    const availablePatterns = this.getAvailablePatternsForRound(this.state.round);
    let pattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
    if (pattern === 'cover' || pattern === 'static') pattern = 'horizontal';

    const speedMultiplier = 1 + (this.state.round - 1) * 0.15;
    const baseSpeed = (2.0 + Math.random() * 1.2) * speedMultiplier;
    const angle = Math.random() * Math.PI * 2;

    this.targets.push({
      x,
      y,
      baseX: x,
      baseY: y,
      radius,
      type: 'perk',
      perkType: perkType,
      pattern,
      timer: GAME_CONFIG.PERK_LIFETIME,
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed
    });
  }

  applyBilliardsRebound(target, normalX, normalY) {
    if (target.pattern === 'static') return;

    if (target.vx === undefined || target.vy === undefined || (target.vx === 0 && target.vy === 0)) {
      const angle = Math.random() * Math.PI * 2;
      target.vx = Math.cos(angle) * 2;
      target.vy = Math.sin(angle) * 2;
    }

    const dot = target.vx * normalX + target.vy * normalY;
    if (dot >= 0) return;

    let rx = target.vx - 2 * dot * normalX;
    let ry = target.vy - 2 * dot * normalY;

    const variation = (Math.random() - 0.5) * 0.2;
    const cosV = Math.cos(variation);
    const sinV = Math.sin(variation);

    const rotatedRx = rx * cosV - ry * sinV;
    const rotatedRy = rx * sinV + ry * cosV;

    const currentSpeed = Math.hypot(target.vx, target.vy) || 2;
    const newSpeed = Math.max(1.5, currentSpeed);

    const newLen = Math.hypot(rotatedRx, rotatedRy) || 1;
    target.vx = (rotatedRx / newLen) * newSpeed;
    target.vy = (rotatedRy / newLen) * newSpeed;
  }

  resolveEnemyCollisions() {
    const exposedEnemies = this.targets.filter(t => t.type === 'enemy' && t.pattern !== 'cover');
    
    for (let i = 0; i < exposedEnemies.length; i++) {
      for (let j = i + 1; j < exposedEnemies.length; j++) {
        const e1 = exposedEnemies[i];
        const e2 = exposedEnemies[j];

        const dx = e2.x - e1.x;
        const dy = e2.y - e1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = e1.radius + e2.radius + 10;

        if (dist < minDist) {
          const nx = dist > 0 ? dx / dist : (Math.random() - 0.5);
          const ny = dist > 0 ? dy / dist : (Math.random() - 0.5);
          const overlap = minDist - (dist || 1);

          const e1Static = e1.pattern === 'static';
          const e2Static = e2.pattern === 'static';

          if (e1Static && !e2Static) {
            e2.x += nx * overlap;
            e2.y += ny * overlap;
            this.applyBilliardsRebound(e2, nx, ny);
          } else if (!e1Static && e2Static) {
            e1.x -= nx * overlap;
            e1.y -= ny * overlap;
            this.applyBilliardsRebound(e1, -nx, -ny);
          } else if (!e1Static && !e2Static) {
            const e1Paused = e1.pauseState === 'paused';
            const e2Paused = e2.pauseState === 'paused';

            if (e1Paused && !e2Paused) {
              e2.x += nx * overlap;
              e2.y += ny * overlap;
              this.applyBilliardsRebound(e2, nx, ny);
            } else if (!e1Paused && e2Paused) {
              e1.x -= nx * overlap;
              e1.y -= ny * overlap;
              this.applyBilliardsRebound(e1, -nx, -ny);
            } else {
              e1.x -= nx * (overlap * 0.5);
              e1.y -= ny * (overlap * 0.5);
              e2.x += nx * (overlap * 0.5);
              e2.y += ny * (overlap * 0.5);

              if (!e1Paused) this.applyBilliardsRebound(e1, -nx, -ny);
              if (!e2Paused) this.applyBilliardsRebound(e2, nx, ny);
            }
          }
        }
      }
    }

    const coverEnemies = this.targets.filter(t => t.type === 'enemy' && t.pattern === 'cover' && t.coverState !== 'hidden_loop');
    for (const exp of exposedEnemies) {
      if (exp.pattern === 'static') continue;

      for (const cov of coverEnemies) {
        const dx = cov.x - exp.x;
        const dy = cov.y - exp.y;
        const dist = Math.hypot(dx, dy);
        const minDist = exp.radius + cov.radius + 6;

        if (dist < minDist) {
          const nx = dist > 0 ? dx / dist : 1;
          const ny = dist > 0 ? dy / dist : 0;
          const overlap = minDist - (dist || 1);

          exp.x -= nx * overlap;
          exp.y -= ny * overlap;

          if (exp.pauseState !== 'paused') {
            this.applyBilliardsRebound(exp, -nx, -ny);
          }
        }
      }
    }
  }

  updateTargets(now, dt) {
    const area = this.getPlayableArea();
    this.waveThreatTimer -= dt * 1000;

    if (this.waveThreatTimer <= 0) {
      const enemiesRemaining = this.targets.filter(t => t.type === 'enemy').length;
      if (enemiesRemaining > 0) {
        this.state.lives -= 1;
        this.sound.playDamage();
        this.screenShake = 15;
        this.breakCombo();
        this.updateHUD();

        if (this.state.lives <= 0) {
          this.triggerGameOver();
          return;
        }

        this.failWave();
        return;
      }
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];

      if (t.type === 'perk') {
        t.timer -= dt * 1000;
        if (t.timer <= 0) {
          this.targets.splice(i, 1);
          continue;
        }
      }

      if (t.pattern === 'cover') {
        if (t.coverState === 'initial_wait') {
          t.coverTimer -= dt;
          if (t.coverTimer <= 0) {
            t.coverState = 'popping_out';
          }
        } else if (t.coverState === 'popping_out') {
          t.coverProgress += t.popSpeed * dt;
          if (t.coverProgress >= 1) {
            t.coverProgress = 1;
            t.coverState = 'exposed';
            t.coverTimer = t.popupType === 'looping' ? 0.8 : 999;
          }
        } else if (t.coverState === 'exposed') {
          if (t.popupType === 'looping') {
            t.coverTimer -= dt;
            if (t.coverTimer <= 0) {
              t.coverState = 'popping_in';
            }
          }
        } else if (t.coverState === 'popping_in') {
          t.coverProgress -= t.popSpeed * dt;
          if (t.coverProgress <= 0) {
            t.coverProgress = 0;
            t.coverState = 'hidden_loop';
            t.coverTimer = 0.5 + Math.random() * 0.4;
          }
        } else if (t.coverState === 'hidden_loop') {
          t.coverTimer -= dt;
          if (t.coverTimer <= 0) {
            t.coverState = 'popping_out';
          }
        }

        const EXPOSURE_RATIO = 0.775;
        const currentExposure = t.coverProgress * EXPOSURE_RATIO;
        t.x = t.hiddenX + (t.exposedX - t.hiddenX) * currentExposure;
        t.y = t.hiddenY + (t.exposedY - t.hiddenY) * currentExposure;
        continue;
      }

      if (t.type === 'enemy' && t.pattern !== 'static' && t.pauseState !== undefined) {
        if (t.pauseState === 'moving') {
          t.pauseInterval -= dt;
          if (t.pauseInterval <= 0) {
            t.pauseState = 'paused';
            t.pauseTimer = 0.6 + Math.random() * 0.8;
          }
        } else if (t.pauseState === 'paused') {
          t.pauseTimer -= dt;
          if (t.pauseTimer <= 0) {
            t.pauseState = 'moving';
            t.pauseInterval = 1.8 + Math.random() * 2.5;
            if (Math.random() < 0.5) {
              t.vx *= -1;
              t.vy *= -1;
            }
          }
        }
      }

      let nextX = t.x;
      let nextY = t.y;

      const minBoundX = area.minX + t.radius;
      const maxBoundX = area.maxX - t.radius;
      const minBoundY = area.minY + t.radius;
      const maxBoundY = area.maxY - t.radius;

      const isPaused = t.pattern === 'static' || (t.type === 'enemy' && t.pauseState === 'paused');

      if (!isPaused) {
        if (t.pattern === 'horizontal') {
          nextX += t.vx * 35 * dt;
        } else if (t.pattern === 'vertical') {
          nextY += t.vy * 35 * dt;
        } else if (t.pattern === 'slow_moving') {
          nextX += t.vx * 35 * dt;
          nextY += t.vy * 35 * dt;
        } else if (t.pattern === 'diagonal' || t.pattern === 'fast') {
          const mult = t.pattern === 'fast' ? 1.8 : 1.0;
          nextX += t.vx * 35 * dt * mult;
          nextY += t.vy * 35 * dt * mult;
        }
      }

      if (t.type === 'enemy') {
        let normalX = 0;
        let normalY = 0;

        if (nextX < minBoundX) {
          nextX = minBoundX;
          normalX = 1;
        } else if (nextX > maxBoundX) {
          nextX = maxBoundX;
          normalX = -1;
        }

        if (nextY < minBoundY) {
          nextY = minBoundY;
          normalY = 1;
        } else if (nextY > maxBoundY) {
          nextY = maxBoundY;
          normalY = -1;
        }

        if (normalX !== 0 || normalY !== 0) {
          this.applyBilliardsRebound(t, normalX, normalY);
        }
      } else {
        if (nextX < minBoundX || nextX > maxBoundX) {
          t.vx *= -1;
          nextX = Math.max(minBoundX, Math.min(maxBoundX, nextX));
        }
        if (nextY < minBoundY || nextY > maxBoundY) {
          t.vy *= -1;
          nextY = Math.max(minBoundY, Math.min(maxBoundY, nextY));
        }
      }

      for (const obs of this.obstacles) {
        const expLeft = obs.x - t.radius;
        const expRight = obs.x + obs.w + t.radius;
        const expTop = obs.y - t.radius;
        const expBottom = obs.y + obs.h + t.radius;

        if (nextX > expLeft && nextX < expRight && nextY > expTop && nextY < expBottom) {
          const dLeft = Math.abs(nextX - expLeft);
          const dRight = Math.abs(nextX - expRight);
          const dTop = Math.abs(nextY - expTop);
          const dBottom = Math.abs(nextY - expBottom);

          const minD = Math.min(dLeft, dRight, dTop, dBottom);
          let normalX = 0;
          let normalY = 0;

          if (minD === dLeft) {
            normalX = -1;
            nextX = expLeft - 2;
          } else if (minD === dRight) {
            normalX = 1;
            nextX = expRight + 2;
          } else if (minD === dTop) {
            normalY = -1;
            nextY = expTop - 2;
          } else if (minD === dBottom) {
            normalY = 1;
            nextY = expBottom + 2;
          }

          this.applyBilliardsRebound(t, normalX, normalY);
          break;
        }
      }

      t.x = Math.max(minBoundX, Math.min(maxBoundX, nextX));
      t.y = Math.max(minBoundY, Math.min(maxBoundY, nextY));
    }

    this.resolveEnemyCollisions();
  }

  triggerGameOver() {
    if (this.state.gameOverTriggered) return;
    this.state.gameOverTriggered = true;

    this.clearPerkTimers();
    this.gameMode = 'GAME_OVER_ANIM';
    this.state.gameOverAnimTimer = 1.5;
    this.latestQualifiedRank = -1;
    this.latestPlayerName = '';

    this.sound.playDamage();
  }

  showGameOverScreen() {
    this.gameMode = 'GAME_OVER_SCREEN';
    this.goScoreVal.textContent = this.state.score;
    this.goHighScoreVal.textContent = Math.max(this.getHighScore(), this.state.score);

    if (this.latestQualifiedRank > 0) {
      this.goRankContainer.classList.remove('hidden');
      this.goRankVal.textContent = `#${this.latestQualifiedRank} (${this.latestPlayerName})`;
    } else {
      this.goRankContainer.classList.add('hidden');
    }

    this.gameOverScreen.classList.remove('hidden');
  }

  resetGame() {
    this.clearPerkTimers();
    this.mgShotFired = false;
    this.isPointerDown = false;
    this.state.score = 0;
    this.state.lives = GAME_CONFIG.STARTING_LIVES;
    this.state.timeRemaining = GAME_CONFIG.STARTING_TIME;
    this.state.ammo = GAME_CONFIG.MAGAZINE_SIZE;
    this.state.combo = 0;
    this.state.comboTimer = 0;
    this.state.round = 1;
    this.state.waveInRound = 1;
    this.state.gameOverTriggered = false;
    this.state.isMachineGun = false;
    this.state.mgAmmo = 0;
    this.state.multiplierActive = false;
    this.state.multiplierTimer = 0;
    this.targets = [];
    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.bulletHoles = [];
    this.lastWaveHadMultiplePerks = false;
    this.spawnWave();
    this.updateHUD();
  }

  updateHUD() {
    this.scoreEl.textContent = this.state.score;
    
    const remainingTime = Math.max(0, this.state.timeRemaining);
    this.timeEl.textContent = remainingTime.toFixed(3);
    
    let livesHTML = '';
    for (let i = 0; i < GAME_CONFIG.MAX_LIVES; i++) {
      const isFilled = i < this.state.lives;
      livesHTML += `<span class="heart-icon ${isFilled ? '' : 'empty'}">♥</span>`;
    }
    this.livesEl.innerHTML = livesHTML;

    let ammoHTML = '';
    if (this.state.isMachineGun) {
      ammoHTML = `<span class="mg-ammo-symbol">⚡</span><span class="mg-ammo-count">x${this.state.mgAmmo}</span>`;
    } else {
      for (let i = 0; i < GAME_CONFIG.MAGAZINE_SIZE; i++) {
        const isFilled = i < this.state.ammo;
        ammoHTML += `<span class="bullet-icon ${isFilled ? '' : 'empty'}"></span>`;
      }
    }
    this.ammoEl.innerHTML = ammoHTML;

    const displayComboMultiplier = this.state.multiplierActive ? Math.min(10, this.state.combo * 2) : this.state.combo;
    this.comboEl.textContent = `x${displayComboMultiplier}`;
    this.roundEl.textContent = this.state.round;
    
    const requiredWaves = this.getWavesForRound(this.state.round);
    this.waveEl.textContent = `${this.state.waveInRound}/${requiredWaves}`;

    const comboRatio = this.state.comboTimer / GAME_CONFIG.COMBO_TIMER;
    this.comboBarFill.style.width = `${Math.max(0, comboRatio * 100)}%`;

    if (this.comboHud) {
      if (this.state.combo > 0) {
        this.comboHud.classList.add('combo-active');
      } else {
        this.comboHud.classList.remove('combo-active');
      }
    }

    if (this.multiplierHud) {
      if (this.state.multiplierActive) {
        this.multiplierHud.classList.remove('hidden');
        const multRatio = Math.max(0, this.state.multiplierTimer / this.state.multiplierDuration);
        this.multiplierBarFill.style.width = `${multRatio * 100}%`;
      } else {
        this.multiplierHud.classList.add('hidden');
      }
    }

    if (!this.state.isMachineGun && this.state.ammo === 0 && this.gameMode === 'PLAYING') {
      this.reloadPrompt.classList.remove('hidden');
    } else {
      this.reloadPrompt.classList.add('hidden');
    }

    if (this.isMobileTouchDevice() && !this.checkOrientationGate() && this.gameMode === 'PLAYING') {
      if (this.touchReloadBtn) this.touchReloadBtn.classList.add('visible');
    } else {
      if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
    }
  }

  gameLoop(timestamp) {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    const isPortraitRestricted = this.checkOrientationGate();

    this.ctx.save();
    if (this.screenShake > 0) {
      const dx = (Math.random() - 0.5) * this.screenShake;
      const dy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(dx, dy);
      this.screenShake *= 0.85;
      if (this.screenShake < 0.5) this.screenShake = 0;
    }

    this.drawBackground();

    if (this.gameMode === 'PLAYING' && !isPortraitRestricted) {
      this.state.timeRemaining -= dt;
      if (this.state.timeRemaining <= 0) {
        this.state.timeRemaining = 0;
        this.triggerGameOver();
      }

      if (this.state.multiplierActive) {
        this.state.multiplierTimer -= dt;
        if (this.state.multiplierTimer <= 0) {
          this.state.multiplierActive = false;
          this.state.multiplierTimer = 0;
          if (this.state.combo > GAME_CONFIG.MAX_COMBO) {
            this.state.combo = GAME_CONFIG.MAX_COMBO;
          }
        }
      }

      if (this.state.isMachineGun && this.isPointerDown) {
        this.mgFireTimer += dt;
        if (this.mgFireTimer >= this.mgFireInterval) {
          this.handleShoot();
          this.mgFireTimer = 0;
        }
      }

      if (this.state.combo > 0) {
        this.state.comboTimer -= dt;
        if (this.state.comboTimer <= 0) {
          this.breakCombo();
        }
      }

      this.updateTargets(timestamp, dt);
      this.updateHUD();
    } else if (this.gameMode === 'GAME_OVER_ANIM') {
      this.state.gameOverAnimTimer -= dt;
      if (this.state.gameOverAnimTimer <= 0) {
        if (this.qualifiesForTop10(this.state.score)) {
          this.gameMode = 'NAME_ENTRY';
          this.arcadeInput.value = '';
          this.btnSubmitName.disabled = true;
          this.hudTop.classList.add('hidden');
          this.hudBottom.classList.add('hidden');
          this.nameEntryScreen.classList.remove('hidden');
          this.arcadeInput.focus();
        } else {
          this.hudTop.classList.add('hidden');
          this.hudBottom.classList.add('hidden');
          this.showGameOverScreen();
        }
      }
    }

    this.drawTargets();
    this.drawObstacles();
    this.drawBulletHoles();
    this.drawParticles();
    this.drawFloatingTexts();
    this.drawCrosshair();

    if (this.screenFlash.timer > 0) {
      this.screenFlash.timer -= dt;
      this.drawScreenFlash();
    }

    if (this.state.roundBannerTimer > 0) {
      this.state.roundBannerTimer -= dt;
      this.drawRoundBanner();
    }

    if (this.gameMode === 'GAME_OVER_ANIM') {
      this.drawGameOverBanner();
    }

    this.ctx.restore();
    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  drawBackground() {
    this.ctx.fillStyle = '#0f1018';
    this.ctx.fillRect(0, 0, GAME_CONFIG.LOGICAL_WIDTH, GAME_CONFIG.LOGICAL_HEIGHT);

    this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.04)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < GAME_CONFIG.LOGICAL_WIDTH; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, GAME_CONFIG.LOGICAL_HEIGHT);
      this.ctx.stroke();
    }
    for (let y = 0; y < GAME_CONFIG.LOGICAL_HEIGHT; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(GAME_CONFIG.LOGICAL_WIDTH, y);
      this.ctx.stroke();
    }
  }

  drawObstacles() {
    this.obstacles.forEach((obs) => {
      this.ctx.save();
      
      this.ctx.fillStyle = '#1e2638';
      this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

      this.ctx.strokeStyle = '#00ffcc';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

      this.ctx.fillStyle = 'rgba(0, 255, 204, 0.1)';
      this.ctx.beginPath();
      this.ctx.moveTo(obs.x, obs.y);
      this.ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
      this.ctx.stroke();

      this.ctx.restore();
    });
  }

  drawBulletHoles() {
    this.bulletHoles.forEach((hole) => {
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(hole.x, hole.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#555555';
      this.ctx.stroke();
    });
  }

  getEnemyColorByToughness(toughness) {
    switch (toughness) {
      case 2: return '#e6b800'; // Yellow
      case 3: return '#28a745'; // Green
      case 4: return '#007bff'; // Blue
      case 5: return '#8a2be2'; // Violet
      default: return '#ff3344'; // Red (Standard 1-shot)
    }
  }

  drawTargets() {
    const threatProgress = Math.max(0, Math.min(1, 1 - (this.waveThreatTimer / this.waveThreatDuration)));

    this.targets.forEach((t) => {
      this.ctx.save();
      this.ctx.translate(t.x, t.y);

      if (t.type === 'enemy') {
        this.ctx.fillStyle = this.getEnemyColorByToughness(t.toughness);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, t.radius * 0.6, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = '#ffcc00';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, t.radius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * threatProgress));
        this.ctx.stroke();

      } else if (t.type === 'hostage') {
        this.ctx.fillStyle = '#1a0d18';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#28a745';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, t.radius - 2, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = '#28a745';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, t.radius + 4, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.fillStyle = '#ffffff';

        const headRadius = t.radius * 0.38;
        const headOffsetY = -t.radius * 0.32;
        this.ctx.beginPath();
        this.ctx.arc(0, headOffsetY, headRadius, 0, Math.PI * 2);
        this.ctx.fill();

        const bodyRadius = t.radius * 0.72;
        const bodyOffsetY = t.radius * 0.7;
        this.ctx.beginPath();
        this.ctx.arc(0, bodyOffsetY, bodyRadius, Math.PI, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#ff3366';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("HOSTAGE", 0, t.radius * 0.45);

      } else if (t.type === 'perk') {
        const perkProgress = Math.max(0, Math.min(1, t.timer / GAME_CONFIG.PERK_LIFETIME));

        let color = '#ffb700';
        if (t.perkType === 'extra_life') color = '#00e664';
        else if (t.perkType === 'machine_gun') color = '#ff00ff';
        else if (t.perkType === 'multiplier') color = '#00e5ff';

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, t.radius + 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * perkProgress));
        this.ctx.stroke();

        if (t.perkType === 'extra_life') {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.beginPath();
          const r = t.radius * 0.42;
          this.ctx.moveTo(0, r * 0.7);
          this.ctx.bezierCurveTo(-r * 1.2, -r * 0.2, -r * 1.1, -r * 1.2, 0, -r * 0.5);
          this.ctx.bezierCurveTo(r * 1.1, -r * 1.2, r * 1.2, -r * 0.2, 0, r * 0.7);
          this.ctx.fill();
        } else if (t.perkType === 'timer_plus') {
          const clockR = t.radius * 0.38;
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.arc(0, -3, clockR, 0, Math.PI * 2);
          this.ctx.stroke();

          this.ctx.beginPath();
          this.ctx.moveTo(0, -3);
          this.ctx.lineTo(0, -3 - clockR * 0.55);
          this.ctx.moveTo(0, -3);
          this.ctx.lineTo(clockR * 0.45, -3);
          this.ctx.stroke();

          this.ctx.fillStyle = '#000000';
          this.font = 'bold 9px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText("Timer+", 0, t.radius * 0.65);
        } else if (t.perkType === 'machine_gun') {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = 'bold 18px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText('⚡', 0, 0);
        } else if (t.perkType === 'multiplier') {
          this.ctx.fillStyle = '#000000';
          this.ctx.font = 'bold 16px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText('2X', 0, 0);
        }
      }

      this.ctx.restore();
    });
  }

  drawParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      p.draw(this.ctx);
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawFloatingTexts() {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.update();
      ft.draw(this.ctx);
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  drawCrosshair() {
    const { x, y } = this.crosshair;
    if (x < 0 || y < 0) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#00ffcc';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.arc(x, y, 12, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x - 18, y);
    this.ctx.lineTo(x + 18, y);
    this.ctx.moveTo(x, y - 18);
    this.ctx.lineTo(x, y + 18);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawScreenFlash() {
    this.ctx.save();
    const alphaRatio = Math.max(0, this.screenFlash.timer / this.screenFlash.maxDuration);
    this.ctx.fillStyle = this.screenFlash.color;
    this.ctx.globalAlpha = alphaRatio;
    this.ctx.fillRect(0, 0, GAME_CONFIG.LOGICAL_WIDTH, GAME_CONFIG.LOGICAL_HEIGHT);
    this.ctx.restore();
  }

  drawRoundBanner() {
    this.ctx.save();
    const boxWidth = 240;
    const boxHeight = 50;
    const boxX = (GAME_CONFIG.LOGICAL_WIDTH - boxWidth) / 2;
    const boxY = GAME_CONFIG.HUD_HEIGHT + 20;

    this.ctx.fillStyle = 'rgba(15, 16, 24, 0.9)';
    this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    this.ctx.strokeStyle = '#00ffcc';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    this.ctx.fillStyle = '#00ffcc';
    this.font = 'bold 1.4rem sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`ROUND ${this.state.round}`, GAME_CONFIG.LOGICAL_WIDTH / 2, boxY + boxHeight / 2);
    this.ctx.restore();
  }

  drawGameOverBanner() {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, GAME_CONFIG.LOGICAL_WIDTH, GAME_CONFIG.LOGICAL_HEIGHT);

    this.ctx.fillStyle = '#ff3344';
    this.ctx.font = '900 4rem sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowColor = 'rgba(255, 51, 68, 0.8)';
    this.ctx.shadowBlur = 20;
    this.ctx.fillText("GAME OVER", GAME_CONFIG.LOGICAL_WIDTH / 2, GAME_CONFIG.LOGICAL_HEIGHT / 2);
    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new LightGunGame();
});
