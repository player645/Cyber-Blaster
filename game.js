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
  
  MOVEMENT_PATTERNS: ['static', 'horizontal', 'vertical', 'slow_moving', 'diagonal', 'fast', 'cover'],

  // 2.5D ground-plane model (fixed camera).
  // WORLD CONVENTION (reference pixels = screen pixels on the nearest play line):
  //   X = lateral position, left/right across the floor.
  //   Z = distance away from the camera along the floor (0 = nearest play line, DEPTH_RANGE = farthest).
  //   Y = height above the ground plane (0 = on the floor).
  // SUPPORT SURFACES: an entity stands on the main floor (surfaceHeight 0) or on a platform
  //   (surfaceHeight = platform top). Its own `y` is the local height above that surface, so its
  //   absolute height is surfaceHeight + y. Z is never used for height and Y never for depth.
  // PROJECTION (one function: projectWorld; the room, platforms, obstacles and entities all use it):
  //   scale        = FOCAL / (FOCAL + Z)
  //   screenX      = vpX + (X - vpX) * scale
  //   groundScreenY= vpY + (floorY - vpY) * scale      // where (X, Y=0, Z) touches the floor
  //   screenY      = groundScreenY - Y * scale          // height lifts a point straight up on screen
  PERSPECTIVE: {
    FOCAL: 700,               // camera distance scale: scale = FOCAL / (FOCAL + Z)
    DEPTH_RANGE: 400,         // usable floor depth for entities: Z in [0, DEPTH_RANGE]
    PERK_HOVER_HEIGHT: 110,   // perks are hovering orbs: constant local Y above their support surface
    OBSTACLE_DEPTH: 70,       // obstacle thickness along Z (collision footprint)
    COVER_EXPOSE_LIFT: 0.5,   // exposed cover target: disc center sits this many radii above the obstacle top
    COVER_GAP: 4,             // gap between an obstacle's back face and a cover target standing behind it
    HORIZON_RATIO: 0.22,      // vanishing point height as a fraction of the playable area
    // Room, in world units (same X/Z as entities): the playable floor plus a small margin.
    ROOM_HALF_WIDTH: 700,     // side walls stand at X = center +/- this (playable half-width is ~605)
    BACK_WALL_Z: 500,         // far wall (playable depth is DEPTH_RANGE)
    FLOOR_GRID_STEP: 100,     // square floor tiles: spacing of both the cross-lines and the lane lines
    FLOOR_NEAR_Z: -200       // nearest cross-line drawn (in front of the play line, under the HUD)
  },

  // Static elevated platforms (world units). A platform has an architecture TYPE (what it is built from)
  // and comes from a layout PROFILE (an authored template of platforms with ranges). Everything below is
  // data: generatePlatforms() instantiates and validates it, getPlatformParts() builds the solids.
  PLATFORMS: {
    SPAWN_CHANCE: 0.3,        // chance an enemy / hostage / perk picks a platform instead of the floor
    MAX_TARGETS: 2,           // default targets per platform (a type can raise it)
    INNER_X: 300,             // no platform may come closer than this to the center line (aiming corridor)
    SPAWN_GAP: 40,            // minimum gap between two platform footprints
    ROOM_MARGIN: 20,          // keeps a platform this far from the back wall
    SURFACE_Z_MAX: 440,       // deepest Z a target standing on a platform may use (enemies there are still >= 29px in radius)
    BRACKET_LENGTH: 90,       // wall brackets reach this far in from the wall (must stay outside the walkable floor)
    BRACKET_DROP: 64,         // ...and drop this far down the wall below the deck
    BRACKET_THICKNESS: 12,    // plate thickness along Z
    BRACKET_INSET: 24,        // distance of the first/last bracket from the deck's front/back edge
    ROD_SIZE: 8,              // suspension rods / chains: square cross-section
    ROD_INSET: 10,            // rods sit this far in from the deck corners
    CHAIN_LINK: 22,           // spacing of the chain-link marks drawn on a rod
    TYPES: {
      // thickness: deck slab [h - thickness, h]; edgeMargin: extra inset of the walkable area (clearance from
      // rods); braceSpacing: wall-bracket spacing along Z (0 = exactly two brackets)
      balcony:   { thickness: 14, edgeMargin: 0,  maxTargets: 2, braceSpacing: 0 },
      catwalk:   { thickness: 20, edgeMargin: 0,  maxTargets: 3, braceSpacing: 95 },
      suspended: { thickness: 14, edgeMargin: 16, maxTargets: 2, braceSpacing: 0 }
    },
    // Ranges are [min, max] in world units. z = front edge, d = length along Z, h = top-surface elevation.
    // Wall types use `inner` (distance of the deck's inner edge from the center line; the deck runs from there
    // to the wall); suspended platforms use `cx` (center offset) and `w` (width). side 'a' = the profile's
    // primary side (right with probability rightBias), 'b' = the opposite side. `chance` marks a platform optional.
    // Elevations are chosen so the underside is genuinely open to the camera (see getPlatformProblems).
    PROFILES: {
      factory_right_catwalk: { weight: 3, rightBias: 0.7, platforms: [
        { type: 'catwalk', side: 'a', z: [40, 110], d: [270, 340], h: [210, 235], inner: [360, 420] },
        { type: 'balcony', side: 'b', z: [130, 230], d: [150, 190], h: [172, 195], inner: [300, 360], chance: 0.5 } ] },
      suspended_rear_platform: { weight: 2, rightBias: 0.5, platforms: [
        { type: 'suspended', side: 'a', z: [150, 240], d: [160, 200], h: [182, 210], w: [220, 260], cx: [440, 500] },
        { type: 'suspended', side: 'b', z: [60, 150], d: [150, 190], h: [192, 215], w: [200, 250], cx: [440, 500], chance: 0.45 } ] },
      wall_balcony_pair: { weight: 3, rightBias: 0.5, platforms: [
        { type: 'balcony', side: 'a', z: [90, 260], d: [150, 200], h: [172, 195], inner: [300, 360] },
        { type: 'balcony', side: 'b', z: [90, 260], d: [150, 200], h: [172, 195], inner: [300, 360] } ] },
      mixed_elevation: { weight: 2, rightBias: 0.6, platforms: [
        { type: 'catwalk', side: 'a', z: [60, 120], d: [250, 320], h: [210, 235], inner: [380, 430] },
        { type: 'suspended', side: 'b', z: [150, 240], d: [160, 190], h: [182, 210], w: [220, 260], cx: [440, 500] } ] },
      industrial_asymmetric: { weight: 2, rightBias: 0.5, platforms: [
        { type: 'balcony', side: 'a', z: [240, 290], d: [130, 170], h: [172, 195], inner: [300, 340] },
        { type: 'balcony', side: 'a', z: [20, 50], d: [125, 150], h: [172, 195], inner: [300, 340], chance: 0.55 },
        { type: 'suspended', side: 'b', z: [50, 130], d: [150, 190], h: [192, 215], w: [200, 250], cx: [440, 500] } ] }
    }
  },

  // Floor obstacle layout (world units). generateObstaclesForCoverSpecs() enumerates valid
  // (lane, row) slots and picks among them with a bias toward lanes used less recently.
  OBSTACLES: {
    LANES_X: [-370, -150, 0, 150, 370], // far-left, center-left, center, center-right, far-right (offsets from center)
    LANE_WEIGHTS: [1, 1, 0.7, 1, 1],    // the center lane is valid far more often, so it is slightly discounted
    ROWS_Z: [70, 160, 250],             // front-edge depths
    JITTER_X: 25,
    JITTER_Z: 15,
    PLATFORM_GAP: 30,                   // minimum clear gap between an obstacle (plus its cover strip) and a platform
    SHADOW_MARGIN: 14,                  // floor shadow extends this far beyond the footprint
    HISTORY_DECAY: 0.7,                 // lane-usage memory across waves
    HISTORY_PENALTY: 1.0                // how strongly recently used lanes are avoided
  },

  // Fair target visibility: a moving target is not allowed to walk into a spot where (almost) all of
  // its hit area is hidden behind a solid, because it could not be shot before the threat timer ends.
  VISIBILITY: {
    MIN_VISIBLE_FRACTION: 0.25,         // share of the disc (21 sample points) that must be in clear view
    RECOVER_DELAY: 0.25,                // seconds a target may stay below the minimum before it is moved
    RECOVER_MAX_DIST: 160               // recovery only searches this far (world px): no cross-room teleports
  }
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
    this.touchPauseBtn = document.getElementById('touch-pause-btn');

    // Screen Overlays
    this.mainMenuScreen = document.getElementById('main-menu-screen');
    this.instructionScreen = document.getElementById('instruction-screen');
    this.leaderboardScreen = document.getElementById('leaderboard-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.nameEntryScreen = document.getElementById('name-entry-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.orientationOverlay = document.getElementById('orientation-overlay');

    // Pause Menu Buttons
    this.btnResume = document.getElementById('btn-resume');
    this.btnEndGame = document.getElementById('btn-end-game');

    // Input & Stats Elements
    this.arcadeInput = document.getElementById('arcade-name-input');
    this.btnSubmitName = document.getElementById('btn-submit-name');
    this.goScoreVal = document.getElementById('go-score-val');
    this.goHighScoreVal = document.getElementById('go-highscore-val');
    this.goRankContainer = document.getElementById('go-rank-container');
    this.goRankVal = document.getElementById('go-rank-val');

    this.sound = new SoundEngine();

    // Mode States: 'MAIN_MENU', 'PLAYING', 'PAUSED', 'GAME_OVER_ANIM', 'NAME_ENTRY', 'GAME_OVER_SCREEN'
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
    this.platforms = [];
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

  requestMobileFullscreen() {
    if (!this.isMobileTouchDevice()) return;
    const container = document.documentElement;
    try {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (err) {
      console.warn('Fullscreen request failed or unsupported:', err);
    }
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
      if (this.touchPauseBtn) this.touchPauseBtn.classList.remove('visible');
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
      this.requestMobileFullscreen();
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

    // Pause Menu Event Handlers
    this.btnResume.addEventListener('click', () => {
      this.resumeGame();
    });

    this.btnEndGame.addEventListener('click', () => {
      this.endGameFromPause();
    });

    if (this.touchPauseBtn) {
      this.touchPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.gameMode === 'PLAYING' && !this.checkOrientationGate()) {
          this.pauseGame();
        }
      });
    }

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
      this.requestMobileFullscreen();
      this.gameOverScreen.classList.add('hidden');
      this.startNewGame();
    });

    document.getElementById('btn-go-main-menu').addEventListener('click', () => {
      this.gameOverScreen.classList.add('hidden');
      this.showMainMenu();
    });
  }

  pauseGame() {
    if (this.gameMode !== 'PLAYING') return;
    this.gameMode = 'PAUSED';
    if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
    if (this.touchPauseBtn) this.touchPauseBtn.classList.remove('visible');
    this.pauseScreen.classList.remove('hidden');
  }

  resumeGame() {
    if (this.gameMode !== 'PAUSED') return;
    this.pauseScreen.classList.add('hidden');
    this.gameMode = 'PLAYING';
    this.lastTimestamp = performance.now(); // Prevent large dt jumps
    this.updateHUD();
  }

  endGameFromPause() {
    if (this.gameMode !== 'PAUSED') return;
    this.pauseScreen.classList.add('hidden');
    this.clearPerkTimers();
    this.state.gameOverTriggered = true;
    this.latestQualifiedRank = -1;
    this.latestPlayerName = '';

    if (this.qualifiesForTop10(this.state.score)) {
      this.gameMode = 'NAME_ENTRY';
      this.arcadeInput.value = '';
      this.btnSubmitName.disabled = true;
      this.hudTop.classList.add('hidden');
      this.hudBottom.classList.add('hidden');
      if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
      if (this.touchPauseBtn) this.touchPauseBtn.classList.remove('visible');
      this.nameEntryScreen.classList.remove('hidden');
      this.arcadeInput.focus();
    } else {
      this.hudTop.classList.add('hidden');
      this.hudBottom.classList.add('hidden');
      if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
      if (this.touchPauseBtn) this.touchPauseBtn.classList.remove('visible');
      this.showGameOverScreen();
    }
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
    if (this.touchPauseBtn) this.touchPauseBtn.classList.remove('visible');
    this.mainMenuScreen.classList.remove('hidden');
    this.clearPerkTimers();
    this.targets = [];
    this.obstacles = [];
    this.platforms = [];
  }

  startNewGame() {
    if (this.checkOrientationGate()) {
      return;
    }

    this.mainMenuScreen.classList.add('hidden');
    this.instructionScreen.classList.add('hidden');
    this.leaderboardScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
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

    document.addEventListener('fullscreenchange', () => {
      setTimeout(() => {
        this.resizeCanvas();
        this.checkOrientationGate();
      }, 100);
    });

    document.addEventListener('webkitfullscreenchange', () => {
      setTimeout(() => {
        this.resizeCanvas();
        this.checkOrientationGate();
      }, 100);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.checkOrientationGate() || this.gameMode === 'PAUSED') return;
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
      if (e.repeat) return; // Ignore holding key down

      // Pause toggle shortcut (P)
      if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        if (this.gameMode === 'PLAYING' && !this.checkOrientationGate()) {
          this.pauseGame();
          return;
        } else if (this.gameMode === 'PAUSED') {
          this.resumeGame();
          return;
        }
      }

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

  // ---- 2.5D ground-plane helpers --------------------------------------------
  // World values (t.x, t.y, t.z) are never overwritten by projection. Rendering, hit testing,
  // hit effects, shadows and obstacle occlusion all go through projectWorld(), so they cannot
  // drift apart. See the convention comment in GAME_CONFIG.PERSPECTIVE.

  getPerspective() {
    if (!this._perspective) {
      const area = this.getPlayableArea();
      this._perspective = {
        vpX: GAME_CONFIG.LOGICAL_WIDTH / 2,
        vpY: area.minY + area.height * GAME_CONFIG.PERSPECTIVE.HORIZON_RATIO,
        floorY: area.maxY, // screen y of the floor at Z = 0 (bottom edge of the playable area)
        roomHeight: area.maxY // ceiling height: the ceiling meets the top screen edge on the Z = 0 line
      };
    }
    return this._perspective;
  }

  scaleAtZ(z) {
    const f = GAME_CONFIG.PERSPECTIVE.FOCAL;
    // Entities stay at Z >= 0; the room also draws the floor in front of the play line (Z < 0).
    const zz = Number.isFinite(z) ? Math.min(f * 2, Math.max(-f * 0.5, z)) : 0;
    return f / (f + zz);
  }

  // Inverse of scaleAtZ: the floor depth at which things are drawn at the given scale.
  zAtScale(scale) {
    const f = GAME_CONFIG.PERSPECTIVE.FOCAL;
    return f / scale - f;
  }

  // World (x, y = height above floor, z = distance along floor) -> screen.
  projectWorld(x, y, z) {
    const { vpX, vpY, floorY } = this.getPerspective();
    const scale = this.scaleAtZ(z);
    const groundY = vpY + (floorY - vpY) * scale;
    return { x: vpX + (x - vpX) * scale, y: groundY - y * scale, groundY, scale };
  }

  // Single source of truth for where a target is drawn and where it can be hit.
  // t.y is the height of the artwork's center above the floor; (t.x, t.z) is its ground anchor.
  // t.y is the local height above the support surface (floor or platform top); the absolute
  // height is surfaceHeight + y. p.surfaceY is where the support surface is under the target.
  projectTarget(t) {
    const surface = t.surfaceHeight || 0;
    const p = this.projectWorld(t.x, surface + t.y, t.z);
    p.surfaceY = p.groundY - surface * p.scale;
    p.radius = t.radius * p.scale;
    return p;
  }

  // Walkable X/Z bounds for a target's center: its platform's top surface, or the main floor.
  getSupportBounds(t) {
    const pl = t.platform;
    if (pl) {
      const S = this.getPlatformSupportSurface(pl, t.radius);
      return { minX: S.minX, maxX: S.maxX, minZ: S.minZ, maxZ: S.maxZ };
    }
    const area = this.getPlayableArea();
    return { minX: area.minX + t.radius, maxX: area.maxX - t.radius, minZ: 0, maxZ: GAME_CONFIG.PERSPECTIVE.DEPTH_RANGE };
  }

  // Back wall of the room as a screen rectangle (a frontal plane).
  getBackWallRect() {
    const { vpX, roomHeight } = this.getPerspective();
    const C = GAME_CONFIG.PERSPECTIVE;
    const tl = this.projectWorld(vpX - C.ROOM_HALF_WIDTH, roomHeight, C.BACK_WALL_Z);
    const br = this.projectWorld(vpX + C.ROOM_HALF_WIDTH, 0, C.BACK_WALL_Z);
    return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
  }

  // ---- world-space boxes: obstacles and platforms ------------------------------------
  // A box is {x, z, w, d, h, surfaceHeight?}: a footprint (x..x+w by z..z+d) standing on a surface
  // at height surfaceHeight (0 = floor) and rising h above it. Everything visible or solid about a
  // box derives from these fields through projectWorld(): its drawn faces, its silhouette, shot
  // blocking and draw ordering, so they cannot disagree.

  // THREE SEPARATE QUESTIONS, THREE SEPARATE QUERIES (they must never share one list of platform geometry):
  //  1. What stops a target walking on the floor?        -> getFloorMovementBlockers() / getOverheadClearanceBlockers()
  //  2. What blocks a shot (and hides a target)?         -> getShotBlockingParts()
  //  3. What does an entity assigned to a platform stand on? -> getPlatformSupportSurface()

  // 2. Shot blockers: obstacles (solid boxes) and the physical components of each platform (the thin
  // deck slab and the wall brackets). A platform's open underside is deliberately NOT part of this list.
  getShotBlockingParts() {
    const out = [...this.obstacles];
    for (const pl of this.platforms) out.push(...this.getPlatformParts(pl));
    return out;
  }

  // A platform is {type, x, z, w, d, h, t, side, ...}: h is the elevation of the top walking surface and t the
  // deck thickness (the deck spans [h - t, h]; everything beneath it is open). Its other parts depend on the
  // type, all built from the same box / prism solids so drawing, shot blocking, ordering and collision share them:
  //  - balcony, catwalk: wall-mounted. The deck's outer edge lies exactly on the side wall, with triangular
  //    brackets fixed to the wall below it (two for a balcony, one per braceSpacing for a long catwalk).
  //  - suspended: hangs from the ceiling on four vertical rods (chains) that run from the deck's corners up to
  //    the ceiling plane.
  // Nothing reaches the floor, so nothing below a deck blocks floor movement.
  getPlatformParts(pl) {
    if (!pl._parts) {
      const C = GAME_CONFIG.PLATFORMS;
      const type = pl.type || 'balcony';
      const t = pl.t !== undefined ? pl.t : C.TYPES[type].thickness;
      const under = pl.h - t;                                           // underside of the deck
      const deck = { x: pl.x, z: pl.z, w: pl.w, d: pl.d, surfaceHeight: under, h: t, platform: pl, kind: 'deck' };
      pl._parts = [deck, ...(type === 'suspended' ? this.buildRods(pl) : this.buildBrackets(pl, type, under))];
    }
    return pl._parts;
  }

  // Wall brackets: triangular plates fixed to the wall plane, flush under the deck, evenly spaced along Z.
  buildBrackets(pl, type, under) {
    const C = GAME_CONFIG.PLATFORMS;
    const { vpX } = this.getPerspective();
    const side = pl.side !== undefined ? pl.side : (pl.x + pl.w / 2 < vpX ? -1 : 1);
    const wallX = side < 0 ? pl.x : pl.x + pl.w;                      // the wall plane
    const dir = side < 0 ? 1 : -1;                                    // brackets reach inward from the wall
    const len = C.BRACKET_LENGTH, drop = C.BRACKET_DROP, th = C.BRACKET_THICKNESS;
    let poly = [[wallX, under - drop], [wallX + dir * len, under], [wallX, under]];
    const area2 = (poly[1][0] - poly[0][0]) * (poly[2][1] - poly[0][1]) - (poly[1][1] - poly[0][1]) * (poly[2][0] - poly[0][0]);
    if (area2 < 0) poly = poly.slice().reverse();                     // counter-clockwise in the x-y plane
    const x0 = Math.min(wallX, wallX + dir * len);
    const spacing = C.TYPES[type].braceSpacing;
    const n = spacing > 0 ? Math.max(2, Math.round(pl.d / spacing)) : 2;
    const first = pl.z + C.BRACKET_INSET, last = pl.z + pl.d - C.BRACKET_INSET - th;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ kind: 'bracket', platform: pl, poly, x: x0, w: len, z: first + (last - first) * i / (n - 1), d: th, surfaceHeight: under - drop, h: drop });
    }
    return out;
  }

  // Suspension rods (chains): thin vertical boxes from the deck's top surface at its four corners up to the
  // ceiling plane. They never reach the floor.
  buildRods(pl) {
    const C = GAME_CONFIG.PLATFORMS;
    const ceiling = this.getPerspective().roomHeight;
    const sz = C.ROD_SIZE, ins = C.ROD_INSET;
    const out = [];
    for (const x of [pl.x + ins, pl.x + pl.w - ins - sz]) {
      for (const z of [pl.z + ins, pl.z + pl.d - ins - sz]) {
        out.push({ kind: 'rod', platform: pl, x, z, w: sz, d: sz, surfaceHeight: pl.h, h: ceiling - pl.h });
      }
    }
    return out;
  }

  // 3. The support surface of a platform: its elevation and the area a target's center may occupy
  // (the deck, limited to the playable floor area; the part against the wall is not usable).
  getPlatformSupportSurface(pl, radius = 0) {
    const area = this.getPlayableArea();
    const m = radius + (pl.edgeMargin || 0);            // extra inset keeps targets clear of suspension rods
    return {
      height: pl.h,
      minX: Math.max(pl.x, area.minX) + m,
      maxX: Math.min(pl.x + pl.w, area.maxX) - m,
      minZ: pl.z + m,
      maxZ: Math.min(pl.z + pl.d, GAME_CONFIG.PLATFORMS.SURFACE_Z_MAX) - m
    };
  }

  // Screen bounds of a whole platform (all its parts), for placement conflicts.
  getPlatformBounds(pl) {
    if (!pl._bounds) {
      const bs = this.getPlatformParts(pl).map(q => this.getBoxBounds(q));
      pl._bounds = { minX: Math.min(...bs.map(b => b.minX)), maxX: Math.max(...bs.map(b => b.maxX)), minY: Math.min(...bs.map(b => b.minY)), maxY: Math.max(...bs.map(b => b.maxY)) };
    }
    return pl._bounds;
  }

  // 1a. Footprints that stop a target walking on the floor: solid obstacles, plus any platform part that
  // actually reaches the floor (a pillar). A deck is above the floor and is never a floor blocker; the
  // wall brackets stay outside the walkable area (validateLayout checks this).
  getFloorMovementBlockers() {
    const out = [...this.obstacles];
    for (const pl of this.platforms) out.push(...this.getPlatformParts(pl).filter(q => q.reachesFloor));
    return out;
  }

  // 1b. Overhead clearance, deliberately separate from horizontal wall collision: an entity whose top is
  // higher than the underside of a deck cannot fit beneath it. Ordinary NPCs (about 96 tall) fit under
  // every deck (validateLayout checks the clearance), so this list is empty for them; it applies to
  // hovering perks, which are taller than the clearance.
  getOverheadClearanceBlockers(topY = 0) {
    const out = [];
    for (const pl of this.platforms) {
      const deck = this.getPlatformParts(pl)[0];
      if (topY > deck.surfaceHeight - 2) out.push(deck);
    }
    return out;
  }

  getBoxCorners(box) {
    const x0 = box.x, x1 = box.x + box.w, z0 = box.z, z1 = box.z + box.d;
    const yb = box.surfaceHeight || 0, yt = yb + box.h;
    const pt = (x, y, z) => this.projectWorld(x, y, z);
    return {
      fbl: pt(x0, yb, z0), fbr: pt(x1, yb, z0), bbl: pt(x0, yb, z1), bbr: pt(x1, yb, z1),
      ftl: pt(x0, yt, z0), ftr: pt(x1, yt, z0), btl: pt(x0, yt, z1), btr: pt(x1, yt, z1)
    };
  }

  // Convex hull of 2D points [[x, y], ...] (monotone chain).
  convexHull2D(points) {
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const q of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
    const upper = [];
    for (const q of pts.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  pointInConvex(hull, x, y) {
    let sign = 0;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (c !== 0) {
        if (sign === 0) sign = c > 0 ? 1 : -1;
        else if ((c > 0 ? 1 : -1) !== sign) return false;
      }
    }
    return true;
  }

  // Convex outline of the projected box = exactly what the camera sees of it (boxes are static,
  // so it is computed once).
  getBoxHull(box) {
    if (!box._hull) {
      box._hull = this.convexHull2D(this.getBoxWorldVertices(box).map(v => { const q = this.projectWorld(v.x, v.y, v.z); return [q.x, q.y]; }));
    }
    return box._hull;
  }

  // World vertices of a solid: 8 corners for a box, or the polygon extruded along Z for a bracket (prism).
  getBoxWorldVertices(box) {
    if (box.poly) {
      const out = [];
      for (const [x, y] of box.poly) for (const z of [box.z, box.z + box.d]) out.push({ x, y, z });
      return out;
    }
    const y0 = box.surfaceHeight || 0, out = [];
    for (const x of [box.x, box.x + box.w]) for (const y of [y0, y0 + box.h]) for (const z of [box.z, box.z + box.d]) out.push({ x, y, z });
    return out;
  }

  getBoxBounds(box) {
    const hull = this.getBoxHull(box);
    const xs = hull.map(q => q[0]), ys = hull.map(q => q[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }

  isPointInBox(x, y, box) {
    return this.pointInConvex(this.getBoxHull(box), x, y);
  }

  isPointOnAnyBox(x, y) {
    return this.getShotBlockingParts().some(b => this.isPointInBox(x, y, b));
  }

  // Highest point (smallest screen y) of a box's silhouette within a screen x-range.
  getBoxTopYIn(box, xa, xb) {
    const hull = this.getBoxHull(box);
    let top = Infinity;
    for (let k = 0; k <= 4; k++) {
      const x = xa + (xb - xa) * k / 4;
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length];
        if (a[0] === b[0] || x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0])) continue;
        top = Math.min(top, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
      }
    }
    return top;
  }

  // ---- line of sight (the camera implied by projectWorld) ----
  getCamera() {
    const { vpX, vpY, floorY } = this.getPerspective();
    return { x: vpX, y: floorY - vpY, z: -GAME_CONFIG.PERSPECTIVE.FOCAL };
  }

  // The world point on the plane at depth z that appears at screen (sx, sy); inverse of projectWorld.
  unprojectToDepth(sx, sy, z) {
    const { vpX, vpY, floorY } = this.getPerspective();
    const s = this.scaleAtZ(z);
    return { x: vpX + (sx - vpX) / s, y: (floorY - vpY) - (sy - vpY) / s, z };
  }

  // Does the segment from the camera to p enter the box before reaching p? (slab test)
  // Exact segment-vs-prism test: clip the segment to the Z slab, then to each edge of the (counter-clockwise)
  // x-y polygon (Cyrus-Beck). Used for the triangular wall brackets so only their real shape blocks shots.
  isSegmentBlockedByPrism(p, part) {
    const c = this.getCamera();
    const dz = p.z - c.z;
    let t0 = 0, t1 = 1;
    if (Math.abs(dz) < 1e-12) {
      if (c.z < part.z || c.z > part.z + part.d) return false;
    } else {
      let a = (part.z - c.z) / dz, b = (part.z + part.d - c.z) / dz;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    const dx = p.x - c.x, dy = p.y - c.y, poly = part.poly;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const f0 = ex * (c.y - a[1]) - ey * (c.x - a[0]);   // >= 0 means inside this edge
      const fd = ex * dy - ey * dx;
      if (Math.abs(fd) < 1e-12) {
        if (f0 < 0) return false;
      } else {
        const t = -f0 / fd;
        if (fd > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
      }
      if (t0 > t1) return false;
    }
    return t0 < 1 - 1e-6;
  }

  isSegmentBlockedByBox(p, box) {
    if (box.poly) return this.isSegmentBlockedByPrism(p, box);
    const c = this.getCamera();
    const y0 = box.surfaceHeight || 0;
    const lo = [box.x, y0, box.z], hi = [box.x + box.w, y0 + box.h, box.z + box.d];
    const o = [c.x, c.y, c.z], d = [p.x - c.x, p.y - c.y, p.z - c.z];
    let tmin = 0, tmax = 1;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-12) {
        if (o[i] < lo[i] || o[i] > hi[i]) return false;
      } else {
        let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return false;
      }
    }
    return tmin < 1 - 1e-6;
  }

  isWorldPointBlocked(p) {
    return this.getShotBlockingParts().some(b => this.isSegmentBlockedByBox(p, b));
  }

  // A shot is blocked when a box stands between the camera and the point under the crosshair on
  // the target's plane. This is the same geometry the box is drawn from. `margin` is the
  // crosshair tolerance in screen px.
  isShotBlocked(sx, sy, target, margin = 2) {
    return [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]]
      .some(([dx, dy]) => this.isWorldPointBlocked(this.unprojectToDepth(sx + dx, sy + dy, target.z)));
  }

  // Sample points on a target's disc (world coordinates, on its plane). Samples never go below the
  // surface the target stands on.
  getDiscSamples(x, absY, z, r, surface = 0) {
    const k = [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [0.64, 0.64], [-0.64, 0.64], [0.64, -0.64], [-0.64, -0.64]];
    return k.map(([dx, dy]) => ({ x: x + dx * r, y: Math.max(absY + dy * r, surface + 0.5), z }));
  }

  // True if any part of the disc is hidden behind a box (used for spawn visibility).
  isDiscBlocked(x, absY, z, r, surface = 0) {
    if (this.getDiscSamples(x, absY, z, r, surface).some(p => this.isWorldPointBlocked(p))) return true;
    // the same 21-point grid the visibility guard uses, at the given radius and slightly inside it (the grids are not
    // nested, so a thin rod or deck edge could otherwise hide between the points of one grid but not the other)
    return [1, 0.9].some(k => this.getVisGrid().some(([a, c]) => this.isWorldPointBlocked({ x: x + a * r * k, y: Math.max(absY + c * r * k, surface + 0.5), z })));
  }

  // Exact (not sampled) test: the part of the target's plane hidden by a solid is the camera-projection of
  // the part of the solid that lies in front of that plane, a convex polygon. The target is (partly) behind
  // the solid iff its disc intersects that polygon, which is exactly the set of rays isSegmentBlockedByBox
  // blocks. Sampling could miss a thin sliver (e.g. a platform deck) and draw the target over it.
  isTargetBehindBox(t, box) {
    const zt = t.z;
    if (!(box.z < zt)) return false;
    const cam = this.getCamera();
    const pts = this.getBoxWorldVertices(box).map((v) => {
      const z = Math.min(v.z, zt);                      // only the part of the solid in front of the plane hides anything
      const k = (zt - cam.z) / (z - cam.z);
      return [cam.x + (v.x - cam.x) * k, cam.y + (v.y - cam.y) * k];
    });
    return this.circleTouchesConvex(this.convexHull2D(pts), t.x, (t.surfaceHeight || 0) + t.y, t.radius);
  }

  // Does the circle (cx, cy, r) overlap the convex polygon (inside it, or closer to an edge than r)?
  circleTouchesConvex(poly, cx, cy, r) {
    if (this.pointInConvex(poly, cx, cy)) return true;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy;
      let u = L2 ? ((cx - a[0]) * dx + (cy - a[1]) * dy) / L2 : 0;
      u = Math.max(0, Math.min(1, u));
      if (Math.hypot(cx - (a[0] + u * dx), cy - (a[1] + u * dy)) < r - 1e-9) return true;
    }
    return false;
  }

  // Share of a target's disc that is in clear view from the camera (21 sample points). 1 = fully visible.
  // The 21 sample offsets (in radii) shared by the visibility guard and the spawn check.
  getVisGrid() {
    if (!this._visGrid) {
      this._visGrid = [];
      for (const a of [-0.8, -0.4, 0, 0.4, 0.8]) for (const c of [-0.8, -0.4, 0, 0.4, 0.8]) if (a * a + c * c <= 0.81) this._visGrid.push([a, c]);
    }
    return this._visGrid;
  }

  getTargetVisibleFraction(t, x = t.x, z = t.z) {
    const grid = this.getVisGrid();
    const surface = t.surfaceHeight || 0;
    let clear = 0;
    for (const [a, c] of grid) {
      const p = { x: x + a * t.radius, y: Math.max(surface + t.y + c * t.radius, surface + 0.5), z };
      if (!this.isWorldPointBlocked(p)) clear++;
    }
    return clear / grid.length;
  }

  // Fallback: move a (nearly) fully hidden ordinary target to the closest nearby spot on its own support
  // surface where it is clearly visible. Bounded search; never leaves its floor/platform area.
  recoverVisibility(t) {
    const V = GAME_CONFIG.VISIBILITY;
    const b = this.getSupportBounds(t);
    const top = (t.surfaceHeight || 0) + t.y + t.radius;
    for (let dist = 20; dist <= V.RECOVER_MAX_DIST; dist += 20) {
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2;
        const x = Math.max(b.minX, Math.min(b.maxX, t.x + Math.cos(ang) * dist));
        const z = Math.max(b.minZ, Math.min(b.maxZ, t.z + Math.sin(ang) * dist));
        if (!t.platform && this.isGroundBlocked(x, z, t.radius, 0, top)) continue;
        if (this.getTargetVisibleFraction(t, x, z) >= 0.75) {
          t.x = x;
          t.z = z;
          return true;
        }
      }
    }
    return false;
  }

  isBoxBehindBox(a, b) {
    const pts = this.getBoxWorldVertices(a);
    const n = pts.length;
    pts.push({ x: pts.reduce((m, q) => m + q.x, 0) / n, y: pts.reduce((m, q) => m + q.y, 0) / n, z: pts.reduce((m, q) => m + q.z, 0) / n });
    return pts.some(p => this.isSegmentBlockedByBox(p, b));
  }

  // Draw order for everything that stands in the room. A single Z key per object is not enough once
  // objects have depth and height, so ordering is decided pairwise with the same line-of-sight test
  // used for shots, then resolved with a topological sort (farthest first among unconstrained items):
  //  - target vs target: farther first (matches hit-test order)
  //  - target vs solid: the solid is drawn first unless the target is (partly) behind it; a target
  //    standing on a platform always draws after that platform's deck
  //  - solid vs solid: the one that is behind the other draws first
  //  - parts of one platform: wall brackets first, then the deck, then suspension rods (farther first within a kind)
  // A platform is several solids (deck + brackets), so a target under the deck can appear in the open
  // space, and a target on the deck is never hidden by its own platform.
  // Remaining limitation: a cycle (three objects that each hide part of another) cannot be ordered
  // by any painter's pass; it falls back to the farthest-first key.
  getWorldDrawOrder() {
    const nodes = [];
    const screens = this.targets.map(t => this.projectTarget(t)); // projected discs, for overlap tests
    this.targets.forEach((t, i) => nodes.push({ target: t, key: t.z, idx: i }));
    this.platforms.forEach((pl, i) => this.getPlatformParts(pl).forEach((part, k) =>
      nodes.push({ box: part, kind: 'part', key: part.z + part.d, idx: 1000 + i * 10 + k })));
    this.obstacles.forEach((b, i) => nodes.push({ box: b, kind: 'obstacle', key: b.z + b.d, idx: 2000 + i }));
    const n = nodes.length;
    const after = nodes.map(() => []);
    const indeg = new Array(n).fill(0);
    const edge = (a, b) => { after[a].push(b); indeg[b]++; }; // a is drawn before b

    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const A = nodes[a], B = nodes[b];
        if (A.target && B.target) {
          // only overlapping discs constrain each other (a constraint between objects that never overlap
          // on screen is meaningless and can create cycles with the solids)
          const pa = screens[a], pb = screens[b];
          if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < pa.radius + pb.radius) {
            if (A.target.z >= B.target.z) edge(a, b); else edge(b, a);
          }
        } else if (A.box && B.box) {
          if (A.box.platform && A.box.platform === B.box.platform) {
            // brackets hang under the deck (first), rods stand on it (last); the same kind: farther first
            const rank = { bracket: 0, deck: 1, rod: 2 };
            if (rank[A.box.kind] !== rank[B.box.kind]) { if (rank[A.box.kind] < rank[B.box.kind]) edge(a, b); else edge(b, a); }
            else if (A.box.z + A.box.d >= B.box.z + B.box.d) edge(a, b); else edge(b, a);
          } else {
            const ab = this.isBoxBehindBox(A.box, B.box), ba = this.isBoxBehindBox(B.box, A.box);
            if (ab && !ba) edge(a, b);
            else if (ba && !ab) edge(b, a);
          }
        } else {
          const ti = A.target ? a : b, bi = A.target ? b : a;
          const T = nodes[ti].target, box = nodes[bi].box, pt = screens[ti];
          if (!this.circleTouchesConvex(this.getBoxHull(box), pt.x, pt.y, pt.radius)) continue; // no overlap, no constraint
          if (T.platform && box.platform === T.platform && box.kind === 'deck') edge(bi, ti);
          else if (this.isTargetBehindBox(T, box)) edge(ti, bi);
          else edge(bi, ti);
        }
      }
    }

    const done = new Array(n).fill(false);
    const order = [];
    for (let k = 0; k < n; k++) {
      let best = -1;
      for (let i = 0; i < n; i++) {
        if (done[i] || indeg[i] !== 0) continue;
        if (best < 0 || nodes[i].key > nodes[best].key || (nodes[i].key === nodes[best].key && nodes[i].idx < nodes[best].idx)) best = i;
      }
      if (best < 0) { // cycle: fall back to the farthest remaining
        for (let i = 0; i < n; i++) {
          if (done[i]) continue;
          if (best < 0 || nodes[i].key > nodes[best].key) best = i;
        }
      }
      done[best] = true;
      order.push(nodes[best]);
      after[best].forEach(j => { indeg[j]--; });
    }
    return order;
  }

  // Everything that makes a platform invalid, as a list of problem codes (empty = valid). Shared by
  // generatePlatforms() and validateLayout(), so the two cannot drift apart.
  getPlatformProblems(pl, others = []) {
    const C = GAME_CONFIG.PLATFORMS;
    const P = GAME_CONFIG.PERSPECTIVE;
    const r = GAME_CONFIG.ENEMY_RADIUS;
    const area = this.getPlayableArea();
    const { vpX, roomHeight } = this.getPerspective();
    const half = P.ROOM_HALF_WIDTH;
    const type = pl.type || 'balcony';
    const problems = [];

    if (pl.x < vpX - half - 1e-9 || pl.x + pl.w > vpX + half + 1e-9 || pl.z < 0 || pl.z + pl.d > P.BACK_WALL_Z - C.ROOM_MARGIN) problems.push('outside the room');
    const nearest = pl.x > vpX ? pl.x - vpX : (pl.x + pl.w < vpX ? vpX - (pl.x + pl.w) : 0);
    if (nearest < C.INNER_X - 1e-9) problems.push('central corridor not clear');

    const parts = this.getPlatformParts(pl);
    const deck = parts[0];
    if (deck.surfaceHeight < r * 2 + 4) problems.push('not enough clearance under the deck for a floor enemy');
    // The open underside must really be open to the camera. Looking down from the camera height, a deck hides the
    // floor beneath it unless the sight line to a floor NPC (top at 2r) passes under the deck's front edge. For the
    // deepest point under the deck that needs: underside >= camH - (camH - 2r) * (z0 + F) / (zEnd + F) (+ a small margin).
    // Without this, NPCs would vanish from view as they walk under a deck and the visibility guard would turn them
    // around at an unmarked line (an "invisible wall").
    const camH = this.getCamera().y;
    const zEnd = Math.min(pl.z + pl.d, P.DEPTH_RANGE);
    const needUnder = camH - (camH - r * 2) * (pl.z + P.FOCAL) / (zEnd + P.FOCAL) + 4;
    if (deck.surfaceHeight < needUnder) problems.push('deck hides the floor beneath it');
    if (Math.abs(deck.surfaceHeight + deck.h - pl.h) > 1e-9) problems.push('deck top is not at the platform elevation');
    const S = this.getPlatformSupportSurface(pl, r);
    if (!(S.maxX - S.minX >= 20 && S.maxZ - S.minZ >= 20)) problems.push('no usable deck area');

    if (type === 'suspended') {
      if (pl.h > roomHeight - 120) problems.push('too close to the ceiling for rods');
      parts.filter(q => q.kind === 'rod').forEach((q) => {
        if (Math.abs(q.surfaceHeight - pl.h) > 1e-9) problems.push('rod not attached to the deck');
        if (Math.abs(q.surfaceHeight + q.h - roomHeight) > 1e-9) problems.push('rod does not reach the ceiling');
        if (q.x < pl.x || q.x + q.w > pl.x + pl.w || q.z < pl.z || q.z + q.d > pl.z + pl.d) problems.push('rod outside the deck footprint');
      });
    } else {
      const wallX = vpX + pl.side * half;
      if (Math.abs((pl.side < 0 ? pl.x : pl.x + pl.w) - wallX) > 1e-9) problems.push('not mounted on the side wall');
      parts.filter(q => q.kind === 'bracket').forEach((q) => {
        if (Math.abs((pl.side < 0 ? q.x : q.x + q.w) - wallX) > 1e-9) problems.push('bracket not fixed to the wall');
        if (pl.side < 0 ? q.x + q.w > area.minX : q.x < area.maxX) problems.push('bracket reaches into the walkable floor');
        if (q.z < pl.z || q.z + q.d > pl.z + pl.d) problems.push('bracket outside the deck depth');
      });
    }

    for (const o of others) {
      if (!(o.x + o.w + C.SPAWN_GAP <= pl.x || pl.x + pl.w + C.SPAWN_GAP <= o.x || o.z + o.d + C.SPAWN_GAP <= pl.z || pl.z + pl.d + C.SPAWN_GAP <= o.z)) problems.push('overlaps another platform');
    }
    return problems;
  }

  // Instantiate one platform from a profile spec. Ranges are sampled with the given rng.
  makePlatform(spec, side, profile, rng) {
    const C = GAME_CONFIG.PLATFORMS;
    const { vpX } = this.getPerspective();
    const half = GAME_CONFIG.PERSPECTIVE.ROOM_HALF_WIDTH;
    const T = C.TYPES[spec.type];
    const range = (r) => r[0] + rng() * (r[1] - r[0]);
    const z = range(spec.z), d = range(spec.d), h = range(spec.h);
    let x, w;
    if (spec.type === 'suspended') {
      w = range(spec.w);
      x = vpX + side * range(spec.cx) - w / 2;
    } else {
      // wall-mounted: the deck's outer edge is exactly the side wall and it runs inward to `inner`
      const inner = range(spec.inner);
      w = half - inner;
      x = side < 0 ? vpX - half : vpX + inner;
    }
    return { type: spec.type, profile, side, x, z, w, d, h, t: T.thickness, edgeMargin: T.edgeMargin, maxTargets: T.maxTargets, surfaceHeight: 0 };
  }

  // Pick a layout profile (by weight, or the one named by forceProfile) and instantiate it. Every platform is
  // validated; an invalid required platform retries the draw, an invalid optional one is skipped, and a
  // single safe wall balcony is the last resort. `rng` makes generation seedable for repeatable layouts.
  generatePlatforms(rng = Math.random, forceProfile = null) {
    const C = GAME_CONFIG.PLATFORMS;
    const names = Object.keys(C.PROFILES);
    const total = names.reduce((a, n) => a + C.PROFILES[n].weight, 0);
    const pickProfile = () => {
      let r = rng() * total;
      for (const n of names) { r -= C.PROFILES[n].weight; if (r <= 0) return n; }
      return names[names.length - 1];
    };

    for (let attempt = 0; attempt < 12; attempt++) {
      const name = forceProfile || pickProfile();
      const prof = C.PROFILES[name];
      const primary = rng() < prof.rightBias ? 1 : -1;
      const list = [];
      let ok = true;
      for (const spec of prof.platforms) {
        const optional = spec.chance !== undefined;
        if (optional && rng() >= spec.chance) continue;
        const pl = this.makePlatform(spec, spec.side === 'a' ? primary : -primary, name, rng);
        if (this.getPlatformProblems(pl, list).length === 0) list.push(pl);
        else if (!optional) { ok = false; break; }
      }
      if (ok && list.length) {
        this.platforms = list;
        this.platformProfile = name;
        return;
      }
    }

    const fallback = this.makePlatform({ type: 'balcony', z: [150, 150], d: [180, 180], h: [185, 185], inner: [300, 300] }, 1, 'fallback', rng);
    this.platforms = this.getPlatformProblems(fallback, []).length === 0 ? [fallback] : [];
    this.platformProfile = 'fallback';
  }

  // Random valid spot on a platform's top surface (bounded attempts), or null.
  findPlatformSpawn(pl, radius, localY, minSeparation) {
    for (let a = 0; a < 60; a++) {
      const S = this.getPlatformSupportSurface(pl, radius);
      const x = S.minX + Math.random() * Math.max(1, S.maxX - S.minX);
      const z = S.minZ + Math.random() * Math.max(1, S.maxZ - S.minZ);
      if (this.isTargetPlacementObstructed(x, z, pl.h + localY, radius, 0, pl)) continue;
      if (this.targets.some(t => t.platform === pl && Math.hypot(x - t.x, z - t.z) < minSeparation)) continue;
      return { x, z };
    }
    return null;
  }

  pickPlatformForSpawn() {
    const C = GAME_CONFIG.PLATFORMS;
    if (!this.platforms.length || Math.random() >= C.SPAWN_CHANCE) return null;
    const open = this.platforms.filter(pl => this.targets.filter(t => t.platform === pl).length < (pl.maxTargets || C.MAX_TARGETS));
    return open.length ? open[Math.floor(Math.random() * open.length)] : null;
  }



  // Front face of an obstacle on screen (front face only, not the whole silhouette). Used by the cover
  // 'fully hidden' test: a disc inside the front face is certainly inside the silhouette.
  getObstacleScreenRect(obs) {
    const p = this.projectWorld(obs.x, 0, obs.z);
    const w = obs.w * p.scale;
    const h = obs.h * p.scale;
    return { x: p.x, y: p.groundY - h, w, h, bottom: p.groundY, scale: p.scale };
  }

  // Far-to-near by ground depth; ties keep array order. Hit testing walks this list in
  // reverse so the target drawn on top is the one that gets hit first.
  getTargetsInDrawOrder() {
    return this.targets
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (b.t.z - a.t.z) || (a.i - b.i))
      .map(o => o.t);
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

  // Ground-plane test (world X/Z) against obstacle footprints.
  // topY = height of the top of the thing being placed; it decides whether a platform deck above blocks it.
  isGroundBlocked(x, z, radius = 0, extraBuffer = 0, topY = 0) {
    const m = radius + extraBuffer;
    for (const obs of [...this.getFloorMovementBlockers(), ...this.getOverheadClearanceBlockers(topY)]) {
      if (
        x + m >= obs.x &&
        x - m <= obs.x + obs.w &&
        z + m >= obs.z &&
        z - m <= obs.z + obs.d
      ) {
        return true;
      }
    }
    return false;
  }

  // A spawn position is rejected if it touches an obstacle footprint or would start out
  // hidden behind an obstacle (so a static target can never be permanently unshootable).
  // y is the absolute height of the disc center; `platform` is its support (null = floor).
  // Rejects spots touching a footprint or with any part of the disc hidden behind a box.
  isTargetPlacementObstructed(x, z, y, radius, extraBuffer, platform = null) {
    if (!platform && this.isGroundBlocked(x, z, radius, extraBuffer, y + radius)) return true;
    return this.isDiscBlocked(x, y, z, radius * 1.1, platform ? platform.h : 0);
  }

  isTooCloseToOtherEnemies(x, z, minDistance = GAME_CONFIG.ENEMY_MIN_SEPARATION, platform = null) {
    const exposedEnemies = this.targets.filter(t => t.type === 'enemy' && t.pattern !== 'cover' && (t.platform || null) === platform);
    for (const enemy of exposedEnemies) {
      const dist = Math.hypot(x - enemy.x, z - enemy.z);
      if (dist < minDistance) {
        return true;
      }
    }
    return false;
  }

  isTooCloseToCoverTargets(x, z, radius = GAME_CONFIG.ENEMY_RADIUS) {
    const coverTargets = this.targets.filter(t => t.pattern === 'cover');
    for (const cov of coverTargets) {
      // A cover target's ground anchor never moves, so one distance check covers every state.
      if (Math.hypot(x - cov.x, z - cov.z) < radius + cov.radius + 20) {
        return true;
      }
    }
    return false;
  }

  // Cover slot: a fixed ground anchor directly behind the obstacle, on the camera's line of
  // sight through the obstacle at fraction `frac` of its width. The target hides and pops up
  // purely along Y. Returns null if the slot would not hide the target or is out of bounds.
  computeCoverSlot(obs, frac) {
    const P = GAME_CONFIG.PERSPECTIVE;
    const r = GAME_CONFIG.ENEMY_RADIUS;
    const area = this.getPlayableArea();
    const { vpX, vpY, floorY } = this.getPerspective();

    const zt = obs.z + obs.d + r + P.COVER_GAP;
    if (zt > P.DEPTH_RANGE) return null;

    const st = this.scaleAtZ(zt);
    const rect = this.getObstacleScreenRect(obs);
    const sx = rect.x + rect.w * frac;                 // screen x of the line of sight
    const xt = vpX + (sx - vpX) / st;                  // world X of the anchor on that line
    if (xt < area.minX + r || xt > area.maxX - r) return null;

    // Hidden: the whole disc must lie inside the obstacle's front face on screen.
    const M = 3;
    if (sx - r * st < rect.x + M || sx + r * st > rect.x + rect.w - M) return null;
    const gT = vpY + (floorY - vpY) * st;              // screen y of the anchor on the floor
    const hi = (gT - rect.y - M) / st - r;             // highest hidden center height
    const lo = (gT - rect.bottom + M) / st + r;        // lowest hidden center height
    if (lo > hi) return null;

    const hiddenY = Math.min(hi, Math.max(lo, r));     // prefer standing on the floor
    // Exposed: the disc center sits just above the highest point of the obstacle's silhouette
    // (its top face is visible, so the silhouette top is the back-top edge, not the front-top edge).
    const silTop = this.getBoxTopYIn(obs, sx - r * st, sx + r * st);
    const exposedY = (gT - (Number.isFinite(silTop) ? silTop : rect.y)) / st + P.COVER_EXPOSE_LIFT * r;
    return { x: xt, z: zt, hiddenY, exposedY };
  }

  getCoverSlots(obs) {
    const r = GAME_CONFIG.ENEMY_RADIUS;
    const left = this.computeCoverSlot(obs, 0.27);
    const right = this.computeCoverSlot(obs, 0.73);
    if (left && right && Math.hypot(left.x - right.x, left.z - right.z) >= 2 * r + 4) return [left, right];
    const mid = this.computeCoverSlot(obs, 0.5);
    return mid ? [mid] : [];
  }

  // Everything that makes an obstacle placement invalid, as a list of problem codes (empty = valid).
  // Used by generation and by validateLayout(), so the two cannot drift apart.
  getObstaclePlacementProblems(obs, others, needed = 0) {
    const P = GAME_CONFIG.PERSPECTIVE;
    const O = GAME_CONFIG.OBSTACLES;
    const area = this.getPlayableArea();
    const r = GAME_CONFIG.ENEMY_RADIUS;
    const edge = r * 2 + 6;   // keeps the obstacle's expanded collision box inside the walkable X range
    const gap = GAME_CONFIG.OBSTACLE_MIN_GAP;
    const reserve = P.OBSTACLE_DEPTH + 2 * r + 8; // footprint plus the strip behind it used by cover targets
    const overlap = (a, b, m) => a.minX < b.maxX + m && a.maxX + m > b.minX && a.minY < b.maxY + m && a.maxY + m > b.minY;
    const slotHits = (slot, o) => slot.x + r >= o.x && slot.x - r <= o.x + o.w && slot.z + r >= o.z && slot.z - r <= o.z + o.d;
    const problems = [];

    if (obs.x < area.minX + edge || obs.x + obs.w > area.maxX - edge) problems.push('bounds-x');
    if (obs.z < r || obs.z + obs.d > P.DEPTH_RANGE) problems.push('bounds-z');

    const hb = this.getBoxBounds(obs);
    for (const o of others) {
      if (!(obs.x + obs.w + gap <= o.x || o.x + o.w + gap <= obs.x || obs.z + reserve + gap <= o.z || o.z + reserve + gap <= obs.z)) problems.push('footprint-overlap');
      if (overlap(hb, this.getBoxBounds(o), 10)) problems.push('screen-overlap');
    }
    for (const pl of this.platforms) {
      const sepX = obs.x + obs.w + O.PLATFORM_GAP <= pl.x || pl.x + pl.w + O.PLATFORM_GAP <= obs.x;
      const sepZ = obs.z + reserve + O.PLATFORM_GAP <= pl.z || pl.z + pl.d + O.PLATFORM_GAP <= obs.z;
      if (!(sepX || sepZ)) problems.push('platform-footprint');
      if (overlap(hb, this.getPlatformBounds(pl), 10)) problems.push('platform-screen');
    }

    const slots = obs.slots && obs.slots.length ? obs.slots : this.getCoverSlots(obs);
    if (needed > 0 && slots.length < needed) problems.push('cover-slots');
    for (const sl of slots) {
      if (others.some(o => slotHits(sl, o)) || this.platforms.some(pl => slotHits(sl, pl))) problems.push('slot-blocked');
    }
    return problems;
  }

  // A candidate obstacle for a (lane, row) slot. The lane center is clamped so the footprint always
  // fits the walkable bounds (previously far lanes were rejected outright when the obstacle was wide).
  makeObstacleCandidate(laneIndex, rowIndex, needed, variant, rng) {
    const P = GAME_CONFIG.PERSPECTIVE;
    const O = GAME_CONFIG.OBSTACLES;
    const area = this.getPlayableArea();
    const { vpX } = this.getPerspective();
    const edge = GAME_CONFIG.ENEMY_RADIUS * 2 + 6;
    const w = variant === 0
      ? (needed >= 2 ? 215 + rng() * 35 : 140 + rng() * 110)
      : (needed >= 2 ? 215 : 140);                      // retry narrower when the first draw does not fit
    const h = 120 + rng() * 90;
    let cx = vpX + O.LANES_X[laneIndex] + (rng() - 0.5) * 2 * O.JITTER_X;
    cx = Math.max(area.minX + edge + w / 2, Math.min(area.maxX - edge - w / 2, cx));
    const z = O.ROWS_Z[rowIndex] + (rng() - 0.5) * 2 * O.JITTER_Z;
    return { x: cx - w / 2, z, w, d: P.OBSTACLE_DEPTH, h, surfaceHeight: 0, lane: laneIndex, row: rowIndex, slots: [], usedSlots: new Set() };
  }

  generateObstaclesForCoverSpecs(coverSpecs, rng = Math.random) {
    this.obstacles = [];
    if (!coverSpecs || coverSpecs.length === 0) return;

    const O = GAME_CONFIG.OBSTACLES;
    const laneCount = O.LANES_X.length;
    if (!this.obstacleLaneHistory || this.obstacleLaneHistory.length !== laneCount) {
      this.obstacleLaneHistory = new Array(laneCount).fill(0);
    }
    const usedNow = new Array(laneCount).fill(0);
    const rowCount = O.ROWS_Z.length;
    if (!this.obstacleRowHistory || this.obstacleRowHistory.length !== rowCount) {
      this.obstacleRowHistory = new Array(rowCount).fill(0);
    }
    const rowsNow = new Array(rowCount).fill(0);

    const obstacleCount = Math.min(3, Math.ceil(coverSpecs.length / 2));
    const specsPerObstacle = Array.from({ length: obstacleCount }, () => []);
    coverSpecs.forEach((spec, idx) => {
      specsPerObstacle[idx % obstacleCount].push(spec);
    });

    for (let i = 0; i < obstacleCount; i++) {
      const specs = specsPerObstacle[i];
      if (specs.length === 0) continue;
      const needed = Math.min(2, specs.length);

      // 1) Enumerate every (lane, row) slot and keep the ones that validate (bounded: lanes x rows x 2 tries).
      const byLane = Array.from({ length: laneCount }, () => []);
      for (let li = 0; li < laneCount; li++) {
        for (let ri = 0; ri < O.ROWS_Z.length; ri++) {
          for (let variant = 0; variant < 2; variant++) {
            const cand = this.makeObstacleCandidate(li, ri, needed, variant, rng);
            cand.slots = this.getCoverSlots(cand);
            if (this.getObstaclePlacementProblems(cand, this.obstacles, needed).length === 0) {
              byLane[li].push(cand);
              break;
            }
          }
        }
      }

      // 2) Pick a lane among those with a valid slot, favoring lanes used less recently, then a random valid row.
      const lanes = byLane.map((c, li) => li).filter(li => byLane[li].length > 0);
      if (lanes.length === 0) continue; // safe fallback: not placed, its cover specs spawn as ordinary targets
      const weights = lanes.map(li => O.LANE_WEIGHTS[li] / (1 + O.HISTORY_PENALTY * (this.obstacleLaneHistory[li] + 2 * usedNow[li])));
      let pick = rng() * weights.reduce((a, b) => a + b, 0);
      let lane = lanes[lanes.length - 1];
      for (let k = 0; k < lanes.length; k++) { pick -= weights[k]; if (pick <= 0) { lane = lanes[k]; break; } }
      // Same recent-usage bias across depth rows, so the layout is not stuck in one band of the room.
      const options = byLane[lane];
      const rowWeights = options.map(c => 1 / (1 + O.HISTORY_PENALTY * (this.obstacleRowHistory[c.row] + 2 * rowsNow[c.row])));
      let rp = rng() * rowWeights.reduce((a, b) => a + b, 0);
      let chosen = options[options.length - 1];
      for (let k = 0; k < options.length; k++) { rp -= rowWeights[k]; if (rp <= 0) { chosen = options[k]; break; } }
      this.obstacles.push(chosen);
      usedNow[lane]++;
      rowsNow[chosen.row]++;
    }

    this.obstacleLaneHistory = this.obstacleLaneHistory.map((v, li) => v * O.HISTORY_DECAY + usedNow[li]);
    this.obstacleRowHistory = this.obstacleRowHistory.map((v, ri) => v * O.HISTORY_DECAY + rowsNow[ri]);
  }

  // Repeatable validation of the current layout (platforms, obstacles, cover anchors). Returns a list of
  // problems; an empty list means the layout is valid. Safe to call from tests or the console.
  validateLayout() {
    const problems = [];
    const area = this.getPlayableArea();
    const P = GAME_CONFIG.PERSPECTIVE;
    const half = P.ROOM_HALF_WIDTH, { vpX } = this.getPerspective();
    this.platforms.forEach((pl, i) => {
      this.getPlatformProblems(pl, this.platforms.filter(q => q !== pl)).forEach(c => problems.push(`platform ${i}: ${c}`));
    });
    this.obstacles.forEach((o, i) => {
      if (o.x < vpX - half || o.x + o.w > vpX + half || o.z + o.d > P.BACK_WALL_Z) problems.push(`obstacle ${i}: outside the room`);
      this.getObstaclePlacementProblems(o, this.obstacles.filter(q => q !== o), 0).forEach(c => problems.push(`obstacle ${i}: ${c}`));
    });
    this.targets.filter(t => t.pattern === 'cover').forEach((t, i) => {
      if (!t.obstacle || !this.obstacles.includes(t.obstacle)) problems.push(`cover ${i}: not attached to an obstacle`);
      else if (!(t.z > t.obstacle.z + t.obstacle.d)) problems.push(`cover ${i}: not behind its obstacle`);
    });
    return problems;
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

    const drawOrder = this.getTargetsInDrawOrder();
    for (let i = drawOrder.length - 1; i >= 0; i--) {
      const target = drawOrder[i];
      const proj = this.projectTarget(target);
      const dist = Math.hypot(this.crosshair.x - proj.x, this.crosshair.y - proj.y);

      if (dist <= proj.radius) {
        if (this.isShotBlocked(this.crosshair.x, this.crosshair.y, target)) {
          hitObstacle = true;
          this.spawnSparks(this.crosshair.x, this.crosshair.y, '#ff9900');
          continue; 
        }

        hitTarget = true;
        this.processHit(target, this.targets.indexOf(target));
        break;
      }
    }

    if (!hitTarget) {
      if (!hitObstacle && this.isPointOnAnyBox(this.crosshair.x, this.crosshair.y)) {
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
    const hitPos = this.projectTarget(target); // effects appear where the target is drawn
    if (target.type === 'enemy' && target.toughness > 1) {
      target.toughness--;
      this.sound.playHit();
      this.spawnSparks(hitPos.x, hitPos.y, '#ffff00');
      
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
      this.spawnSparks(hitPos.x, hitPos.y, '#00ffcc');
      this.floatingTexts.push(new FloatingText(hitPos.x, hitPos.y - 10, `+${earnedScore} (x${effectiveComboVal})`, '#00ffcc'));
    } else if (target.type === 'hostage') {
      this.breakCombo();
      this.triggerFlash('rgba(255, 0, 0, 0.25)', 0.15);
      this.state.lives -= GAME_CONFIG.HOSTAGE_PENALTY_LIVES;
      this.state.score = Math.max(0, this.state.score + GAME_CONFIG.POINTS.HOSTAGE);
      this.sound.playDamage();
      this.screenShake = 12;
      this.spawnSparks(hitPos.x, hitPos.y, '#ff3366');
      this.floatingTexts.push(new FloatingText(hitPos.x, hitPos.y - 10, 'HOSTAGE HIT!', '#ff3366'));

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
        this.spawnSparks(hitPos.x, hitPos.y, '#00e664');
        this.floatingTexts.push(new FloatingText(hitPos.x, hitPos.y - 10, '+1 LIFE!', '#00e664'));
      } else if (target.perkType === 'timer_plus') {
        const bonusTime = 5.0 + Math.random() * 5.0;
        this.state.timeRemaining += bonusTime;
        this.spawnSparks(hitPos.x, hitPos.y, '#ffcc00');
        this.floatingTexts.push(new FloatingText(hitPos.x, hitPos.y - 10, `+${bonusTime.toFixed(1)}s TIME!`, '#ffcc00'));
      } else if (target.perkType === 'machine_gun') {
        this.state.isMachineGun = true;
        this.state.mgAmmo = 30;
        this.spawnSparks(hitPos.x, hitPos.y, '#ff00ff');
        this.floatingTexts.push(new FloatingText(hitPos.x, hitPos.y - 10, 'MACHINE GUN!', '#ff00ff'));
      } else if (target.perkType === 'multiplier') {
        this.state.multiplierActive = true;
        this.state.multiplierTimer = 10.0;
        this.spawnSparks(hitPos.x, hitPos.y, '#00e5ff');
        this.floatingTexts.push(new FloatingText(hitPos.x, hitPos.y - 10, '2X MULTIPLIER!', '#00e5ff'));
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

    this.generatePlatforms();
    this.generateObstaclesForCoverSpecs(coverSpecs);

    const speedMultiplier = 1 + (this.state.round - 1) * 0.15;
    const radius = GAME_CONFIG.ENEMY_RADIUS;
    const P = GAME_CONFIG.PERSPECTIVE;

    [...enemySpecs, ...hostageSpecs].forEach((spec) => {
      // A cover target needs a free cover slot on an obstacle; without one it spawns as a
      // normal moving target (same fallback the original used when no obstacle existed).
      let coverObs = null;
      let coverSlotIndex = -1;
      if (spec.pattern === 'cover') {
        const availableObs = this.obstacles.filter(o => o.usedSlots.size < o.slots.length);
        if (availableObs.length > 0) {
          coverObs = availableObs[Math.floor(Math.random() * availableObs.length)];
          const free = coverObs.slots.map((_, i) => i).filter(i => !coverObs.usedSlots.has(i));
          coverSlotIndex = free[Math.floor(Math.random() * free.length)];
          coverObs.usedSlots.add(coverSlotIndex);
        }
      }

      if (coverObs) {
        // Ground anchor (x, z) is fixed behind the obstacle; only height (y) changes.
        const slot = coverObs.slots[coverSlotIndex];
        const popupType = Math.random() < 0.5 ? 'single' : 'looping';

        this.targets.push({
          x: slot.x,
          y: slot.hiddenY,
          z: slot.z,
          surfaceHeight: 0,
          platform: null,
          radius,
          type: spec.type,
          pattern: 'cover',
          toughness: spec.toughness || 1,
          maxToughness: spec.toughness || 1,
          popupType,
          obstacle: coverObs,
          hiddenY: slot.hiddenY,
          exposedY: slot.exposedY,
          coverState: 'initial_wait',
          coverTimer: 0.3 + Math.random() * 0.4,
          coverProgress: 0,
          popSpeed: 2.2 * speedMultiplier
        });

      } else {
        let x, z;
        let attempts = 0;

        // Some enemies/hostages stand on a platform instead of the floor. Platform spots come from
        // a bounded search inside the platform's top surface; if none is valid, use the floor.
        let support = this.pickPlatformForSpawn();
        const spot = support
          ? this.findPlatformSpawn(support, radius, radius, spec.type === 'enemy' ? GAME_CONFIG.ENEMY_MIN_SEPARATION : radius * 2 + 10)
          : null;

        if (spot) {
          x = spot.x;
          z = spot.z;
        } else {
          support = null;
          do {
            x = area.minX + radius + Math.random() * Math.max(10, area.width - radius * 2);
            z = Math.random() * P.DEPTH_RANGE;
            attempts++;
          } while (
            (this.isTargetPlacementObstructed(x, z, radius, radius, GAME_CONFIG.OBSTACLE_BUFFER) ||
             this.isTooCloseToCoverTargets(x, z, radius) ||
             (spec.type === 'enemy' && this.isTooCloseToOtherEnemies(x, z, GAME_CONFIG.ENEMY_MIN_SEPARATION))) &&
            attempts < 150
          );

          // Crowded scene: relax the spacing rules, but never accept a spot that is inside or
          // hidden behind an obstacle/platform (a hidden static target could not be shot).
          if (this.isTargetPlacementObstructed(x, z, radius, radius, 0)) {
            let retry = 0;
            do {
              x = area.minX + radius + Math.random() * Math.max(10, area.width - radius * 2);
              z = Math.random() * P.DEPTH_RANGE;
              retry++;
            } while (this.isTargetPlacementObstructed(x, z, radius, radius, 0) && retry < 150);
          }
        }

        let baseSpeed = (1.2 + Math.random() * 1.0) * speedMultiplier;
        if (spec.pattern === 'slow_moving') {
          baseSpeed *= 0.5;
        }

        const angle = Math.random() * Math.PI * 2;
        let pattern = spec.pattern === 'cover' ? 'horizontal' : spec.pattern;

        // Grounded: the disc rests on its support surface (local center height = radius) at anchor (x, z).
        // vx moves along X, vz along Z (depth). Height y stays constant.
        this.targets.push({
          x,
          y: radius,
          z,
          surfaceHeight: support ? support.h : 0,
          platform: support,
          radius,
          type: spec.type,
          pattern,
          toughness: spec.toughness || 1,
          maxToughness: spec.toughness || 1,
          pauseState: 'moving',
          pauseTimer: 0,
          pauseInterval: 1.8 + Math.random() * 2.5,
          vx: pattern === 'static' ? 0 : Math.cos(angle) * baseSpeed,
          vz: pattern === 'static' ? 0 : Math.sin(angle) * baseSpeed
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
    let x, z;
    let attempts = 0;
    const hoverY = GAME_CONFIG.PERSPECTIVE.PERK_HOVER_HEIGHT;

    // Perks may hover over a platform surface or the floor; local hover height is the same.
    let support = this.pickPlatformForSpawn();
    const spot = support ? this.findPlatformSpawn(support, radius, hoverY, radius * 2 + 10) : null;
    if (spot) {
      x = spot.x;
      z = spot.z;
    } else {
      support = null;
      do {
        x = area.minX + radius + Math.random() * Math.max(10, area.width - radius * 2);
        z = Math.random() * GAME_CONFIG.PERSPECTIVE.DEPTH_RANGE;
        attempts++;
      } while (this.isTargetPlacementObstructed(x, z, hoverY, radius, GAME_CONFIG.OBSTACLE_BUFFER) && attempts < 150);

      // Crowded scene: relax the buffer, but never place a perk inside or behind a solid. If no valid spot
      // exists the spawn is skipped and does not use up one of the wave's perk slots.
      if (this.isTargetPlacementObstructed(x, z, hoverY, radius, 0)) {
        let retry = 0;
        do {
          x = area.minX + radius + Math.random() * Math.max(10, area.width - radius * 2);
          z = Math.random() * GAME_CONFIG.PERSPECTIVE.DEPTH_RANGE;
          retry++;
        } while (this.isTargetPlacementObstructed(x, z, hoverY, radius, 0) && retry < 300);
        if (this.isTargetPlacementObstructed(x, z, hoverY, radius, 0)) {
          this.perksSpawnedInWave--;
          return;
        }
      }
    }

    // Perks are hovering orbs, not grounded characters: constant height above their support surface and
    // fixed in world space for their whole lifetime (pattern 'static', no velocity). Their shadow stays
    // on the surface beneath them.
    this.targets.push({
      x,
      y: hoverY,
      z,
      surfaceHeight: support ? support.h : 0,
      platform: support,
      radius,
      type: 'perk',
      perkType: perkType,
      pattern: 'static',
      timer: GAME_CONFIG.PERK_LIFETIME,
      vx: 0,
      vz: 0
    });
  }

  applyBilliardsRebound(target, normalX, normalZ) {
    if (target.pattern === 'static') return;

    if (target.vx === undefined || target.vz === undefined || (target.vx === 0 && target.vz === 0)) {
      const angle = Math.random() * Math.PI * 2;
      target.vx = Math.cos(angle) * 2;
      target.vz = Math.sin(angle) * 2;
    }

    const dot = target.vx * normalX + target.vz * normalZ;
    if (dot >= 0) return;

    let rx = target.vx - 2 * dot * normalX;
    let rz = target.vz - 2 * dot * normalZ;

    const variation = (Math.random() - 0.5) * 0.2;
    const cosV = Math.cos(variation);
    const sinV = Math.sin(variation);

    const rotatedRx = rx * cosV - rz * sinV;
    const rotatedRz = rx * sinV + rz * cosV;

    const currentSpeed = Math.hypot(target.vx, target.vz) || 2;
    const newSpeed = Math.max(1.5, currentSpeed);

    const newLen = Math.hypot(rotatedRx, rotatedRz) || 1;
    target.vx = (rotatedRx / newLen) * newSpeed;
    target.vz = (rotatedRz / newLen) * newSpeed;
  }

  resolveEnemyCollisions() {
    const exposedEnemies = this.targets.filter(t => t.type === 'enemy' && t.pattern !== 'cover');
    
    for (let i = 0; i < exposedEnemies.length; i++) {
      for (let j = i + 1; j < exposedEnemies.length; j++) {
        const e1 = exposedEnemies[i];
        const e2 = exposedEnemies[j];
        if ((e1.platform || null) !== (e2.platform || null)) continue; // different support surfaces never collide

        const dx = e2.x - e1.x;
        const dz = e2.z - e1.z;
        const dist = Math.hypot(dx, dz);
        const minDist = e1.radius + e2.radius + 10;

        if (dist < minDist) {
          const nx = dist > 0 ? dx / dist : (Math.random() - 0.5);
          const nz = dist > 0 ? dz / dist : (Math.random() - 0.5);
          const overlap = minDist - (dist || 1);

          const e1Static = e1.pattern === 'static';
          const e2Static = e2.pattern === 'static';

          if (e1Static && !e2Static) {
            e2.x += nx * overlap;
            e2.z += nz * overlap;
            this.applyBilliardsRebound(e2, nx, nz);
          } else if (!e1Static && e2Static) {
            e1.x -= nx * overlap;
            e1.z -= nz * overlap;
            this.applyBilliardsRebound(e1, -nx, -nz);
          } else if (!e1Static && !e2Static) {
            const e1Paused = e1.pauseState === 'paused';
            const e2Paused = e2.pauseState === 'paused';

            if (e1Paused && !e2Paused) {
              e2.x += nx * overlap;
              e2.z += nz * overlap;
              this.applyBilliardsRebound(e2, nx, nz);
            } else if (!e1Paused && e2Paused) {
              e1.x -= nx * overlap;
              e1.z -= nz * overlap;
              this.applyBilliardsRebound(e1, -nx, -nz);
            } else {
              e1.x -= nx * (overlap * 0.5);
              e1.z -= nz * (overlap * 0.5);
              e2.x += nx * (overlap * 0.5);
              e2.z += nz * (overlap * 0.5);

              if (!e1Paused) this.applyBilliardsRebound(e1, -nx, -nz);
              if (!e2Paused) this.applyBilliardsRebound(e2, nx, nz);
            }
          }
        }
      }
    }

    const coverEnemies = this.targets.filter(t => t.type === 'enemy' && t.pattern === 'cover' && t.coverState !== 'hidden_loop');
    for (const exp of exposedEnemies) {
      if (exp.pattern === 'static' || exp.platform) continue;

      for (const cov of coverEnemies) {
        const dx = cov.x - exp.x;
        const dz = cov.z - exp.z;
        const dist = Math.hypot(dx, dz);
        const minDist = exp.radius + cov.radius + 6;

        if (dist < minDist) {
          const nx = dist > 0 ? dx / dist : 1;
          const nz = dist > 0 ? dz / dist : 0;
          const overlap = minDist - (dist || 1);

          exp.x -= nx * overlap;
          exp.z -= nz * overlap;

          if (exp.pauseState !== 'paused') {
            this.applyBilliardsRebound(exp, -nx, -nz);
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

        // Pop-up / hide moves the target along Y only; its ground anchor (x, z) never changes.
        t.y = t.hiddenY + (t.exposedY - t.hiddenY) * t.coverProgress;
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
              t.vz *= -1;
            }
          }
        }
      }

      let nextX = t.x;
      let nextZ = t.z;

      const { minX: minBoundX, maxX: maxBoundX, minZ: minBoundZ, maxZ: maxBoundZ } = this.getSupportBounds(t);

      const isPaused = t.pattern === 'static' || (t.type === 'enemy' && t.pauseState === 'paused');

      if (!isPaused) {
        if (t.pattern === 'horizontal') {
          nextX += t.vx * 35 * dt;
        } else if (t.pattern === 'vertical') {
          nextZ += t.vz * 35 * dt;
        } else if (t.pattern === 'slow_moving') {
          nextX += t.vx * 35 * dt;
          nextZ += t.vz * 35 * dt;
        } else if (t.pattern === 'diagonal' || t.pattern === 'fast') {
          const mult = t.pattern === 'fast' ? 1.8 : 1.0;
          nextX += t.vx * 35 * dt * mult;
          nextZ += t.vz * 35 * dt * mult;
        }
      }

      if (t.type === 'enemy') {
        let normalX = 0;
        let normalZ = 0;

        if (nextX < minBoundX) {
          nextX = minBoundX;
          normalX = 1;
        } else if (nextX > maxBoundX) {
          nextX = maxBoundX;
          normalX = -1;
        }

        if (nextZ < minBoundZ) {
          nextZ = minBoundZ;
          normalZ = 1;
        } else if (nextZ > maxBoundZ) {
          nextZ = maxBoundZ;
          normalZ = -1;
        }

        if (normalX !== 0 || normalZ !== 0) {
          this.applyBilliardsRebound(t, normalX, normalZ);
        }
      } else {
        if (nextX < minBoundX || nextX > maxBoundX) {
          t.vx *= -1;
          nextX = Math.max(minBoundX, Math.min(maxBoundX, nextX));
        }
        if (nextZ < minBoundZ || nextZ > maxBoundZ) {
          t.vz *= -1;
          nextZ = Math.max(minBoundZ, Math.min(maxBoundZ, nextZ));
        }
      }

      // Obstacle footprints (and any floor-reaching support) live on the same X/Z plane as floor targets;
      // a deck overhead is NOT a wall (see getOverheadClearanceBlockers for the one deliberate exception).
      // A target standing on a platform is bounded by that platform instead (see getSupportBounds).
      for (const obs of (t.platform ? [] : [...this.getFloorMovementBlockers(), ...this.getOverheadClearanceBlockers((t.surfaceHeight || 0) + t.y + t.radius)])) {
        const expLeft = obs.x - t.radius;
        const expRight = obs.x + obs.w + t.radius;
        const expTop = obs.z - t.radius;               // near face (toward the camera)
        const expBottom = obs.z + obs.d + t.radius;    // far face

        if (nextX > expLeft && nextX < expRight && nextZ > expTop && nextZ < expBottom) {
          const dLeft = Math.abs(nextX - expLeft);
          const dRight = Math.abs(nextX - expRight);
          const dTop = Math.abs(nextZ - expTop);
          const dBottom = Math.abs(nextZ - expBottom);

          const minD = Math.min(dLeft, dRight, dTop, dBottom);
          let normalX = 0;
          let normalZ = 0;

          if (minD === dLeft) {
            normalX = -1;
            nextX = expLeft - 2;
          } else if (minD === dRight) {
            normalX = 1;
            nextX = expRight + 2;
          } else if (minD === dTop) {
            normalZ = -1;
            nextZ = expTop - 2;
          } else if (minD === dBottom) {
            normalZ = 1;
            nextZ = expBottom + 2;
          }

          this.applyBilliardsRebound(t, normalX, normalZ);
          break;
        }
      }

      let finalX = Math.max(minBoundX, Math.min(maxBoundX, nextX));
      let finalZ = Math.max(minBoundZ, Math.min(maxBoundZ, nextZ));

      // Fair visibility: do not step into a spot where the target is (almost) completely hidden behind a
      // solid. Try sliding along one axis, otherwise stay put and reverse; a target that is already
      // poorly visible may still move if the step improves its visibility (so it can never freeze).
      if (finalX !== t.x || finalZ !== t.z) {
        const minVis = GAME_CONFIG.VISIBILITY.MIN_VISIBLE_FRACTION;
        const cur = this.getTargetVisibleFraction(t);
        const ok = (x, z) => { const f = this.getTargetVisibleFraction(t, x, z); return f >= minVis || f > cur + 1e-6; };
        if (!ok(finalX, finalZ)) {
          if (finalZ !== t.z && ok(finalX, t.z)) { finalZ = t.z; t.vz = -t.vz; }
          else if (finalX !== t.x && ok(t.x, finalZ)) { finalX = t.x; t.vx = -t.vx; }
          else { finalX = t.x; finalZ = t.z; t.vx = -t.vx; t.vz = -t.vz; }
        }
      }
      t.x = finalX;
      t.z = finalZ;
    }

    this.resolveEnemyCollisions();

    // Separation pushes happen after the per-target clamp; re-clamp so nothing ends a frame
    // outside its support surface (matters on small platforms).
    for (const t of this.targets) {
      if (t.pattern === 'cover') continue;
      const b = this.getSupportBounds(t);
      t.x = Math.max(b.minX, Math.min(b.maxX, t.x));
      t.z = Math.max(b.minZ, Math.min(b.maxZ, t.z));

      // Defensive recovery (intentional cover targets are skipped above): if separation pushes or any other
      // edge case leaves an ordinary target nearly fully hidden, move it to the closest visible spot.
      if (this.getTargetVisibleFraction(t) < GAME_CONFIG.VISIBILITY.MIN_VISIBLE_FRACTION) {
        t.hiddenFor = (t.hiddenFor || 0) + dt;
        if (t.hiddenFor >= GAME_CONFIG.VISIBILITY.RECOVER_DELAY) {
          this.recoverVisibility(t);
          t.hiddenFor = 0;
        }
      } else {
        t.hiddenFor = 0;
      }
    }
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
    this.platforms = [];
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
      if (this.touchPauseBtn) this.touchPauseBtn.classList.add('visible');
    } else {
      if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
      if (this.touchPauseBtn) this.touchPauseBtn.classList.remove('visible');
    }
  }

  gameLoop(timestamp) {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    const isPortraitRestricted = this.checkOrientationGate();

    this.ctx.save();
    if (this.screenShake > 0 && this.gameMode !== 'PAUSED') {
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
    } else if (this.gameMode === 'PAUSED') {
      // Keep lastTimestamp updated while paused so dt doesn't jump upon resume
      this.lastTimestamp = timestamp;
    } else if (this.gameMode === 'GAME_OVER_ANIM') {
      this.state.gameOverAnimTimer -= dt;
      if (this.state.gameOverAnimTimer <= 0) {
        if (this.qualifiesForTop10(this.state.score)) {
          this.gameMode = 'NAME_ENTRY';
          this.arcadeInput.value = '';
          this.btnSubmitName.disabled = true;
          this.hudTop.classList.add('hidden');
          this.hudBottom.classList.add('hidden');
          if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
          if (this.touchPauseBtn) this.touchPauseBtn.classList.remove('visible');
          this.nameEntryScreen.classList.remove('hidden');
          this.arcadeInput.focus();
        } else {
          this.hudTop.classList.add('hidden');
          this.hudBottom.classList.add('hidden');
          if (this.touchReloadBtn) this.touchReloadBtn.classList.remove('visible');
          if (this.touchPauseBtn) this.touchPauseBtn.classList.remove('visible');
          this.showGameOverScreen();
        }
      }
    }

    this.drawWorldEntities();
    this.drawBulletHoles();
    this.drawParticles();
    this.drawFloatingTexts();
    this.drawCrosshair();

    if (this.screenFlash.timer > 0 && this.gameMode !== 'PAUSED') {
      this.screenFlash.timer -= dt;
      this.drawScreenFlash();
    }

    if (this.state.roundBannerTimer > 0 && this.gameMode !== 'PAUSED') {
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

    // The original flat grid is a frontal pattern, so it is kept only on the frontal back wall
    // (on the slanted floor and side walls it would compete with the perspective lines).
    const backWall = this.getBackWallRect();
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(backWall.x, backWall.y, backWall.w, backWall.h);
    this.ctx.clip();
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

    this.ctx.restore();

    this.drawPerspectiveEnvironment();
  }

  // Fixed one-point-perspective room layered over the original background. Every vertex goes
  // through projectWorld() with world X/Y/Z, so the room, floor lines, platforms, obstacles and
  // targets share one depth mapping. Room extents come from GAME_CONFIG.PERSPECTIVE.
  drawPerspectiveEnvironment() {
    const ctx = this.ctx;
    const cfg = GAME_CONFIG.PERSPECTIVE;
    const W = GAME_CONFIG.LOGICAL_WIDTH;
    const H = GAME_CONFIG.LOGICAL_HEIGHT;
    const { vpX, vpY, floorY, roomHeight } = this.getPerspective();
    const pt = (x, y, z) => this.projectWorld(x, y, z);

    const L = vpX - cfg.ROOM_HALF_WIDTH;
    const R = vpX + cfg.ROOM_HALF_WIDTH;
    const zEdge = this.zAtScale(vpX / cfg.ROOM_HALF_WIDTH);              // where the side walls cross the canvas edges
    const zBottom = this.zAtScale((H - vpY) / (floorY - vpY));            // where the floor reaches the bottom edge
    const backTL = pt(L, roomHeight, cfg.BACK_WALL_Z);
    const backTR = pt(R, roomHeight, cfg.BACK_WALL_Z);
    const backBL = pt(L, 0, cfg.BACK_WALL_Z);
    const backBR = pt(R, 0, cfg.BACK_WALL_Z);
    const edgeLT = pt(L, roomHeight, zEdge).y, edgeLB = pt(L, 0, zEdge).y;
    const edgeRT = pt(R, roomHeight, zEdge).y, edgeRB = pt(R, 0, zEdge).y;

    ctx.save();

    // Surfaces (restrained tints)
    const poly = (pts, fill) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    poly([[0, 0], [W, 0], [W, edgeRT], [backTR.x, backTR.y], [backTL.x, backTL.y], [0, edgeLT]], 'rgba(6, 8, 14, 0.45)');
    poly([[0, edgeLT], [backTL.x, backTL.y], [backBL.x, backBL.y], [0, edgeLB]], 'rgba(6, 8, 14, 0.30)');
    poly([[W, edgeRT], [backTR.x, backTR.y], [backBR.x, backBR.y], [W, edgeRB]], 'rgba(6, 8, 14, 0.30)');

    const floorGrad = ctx.createLinearGradient(0, backBL.y, 0, H);
    floorGrad.addColorStop(0, 'rgba(30, 38, 56, 0.92)');
    floorGrad.addColorStop(1, 'rgba(16, 20, 32, 0.96)');
    poly([[backBL.x, backBL.y], [backBR.x, backBR.y], [W, edgeRB], [W, H], [0, H], [0, edgeLB]], floorGrad);

    poly([[backTL.x, backTL.y], [backTR.x, backTR.y], [backBR.x, backBR.y], [backBL.x, backBL.y]], 'rgba(0, 255, 204, 0.03)');

    // Floor lanes (lines of constant X) and cross-lines (constant Z): square world tiles.
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.12)';
    const step = cfg.FLOOR_GRID_STEP;
    const lanes = Math.ceil(cfg.ROOM_HALF_WIDTH / step) - 1;
    for (let k = -lanes; k <= lanes; k++) {
      const a = pt(vpX + k * step, 0, cfg.BACK_WALL_Z);
      const b = pt(vpX + k * step, 0, zBottom);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (let z = cfg.FLOOR_NEAR_Z; z < cfg.BACK_WALL_Z; z += step) {
      const l = pt(L, 0, z);
      const r = pt(R, 0, z);
      if (l.y > H) continue;

      ctx.strokeStyle = 'rgba(0, 255, 204, 0.12)';
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();

      // faint ribs on the side walls
      const lt = pt(L, roomHeight, z);
      const rt = pt(R, roomHeight, z);
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.07)';
      ctx.beginPath();
      ctx.moveTo(l.x, lt.y);
      ctx.lineTo(l.x, l.y);
      ctx.moveTo(r.x, rt.y);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
    }

    // Structural edges: wall/floor and wall/ceiling seams, back wall frame
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, edgeLB);
    ctx.lineTo(backBL.x, backBL.y);
    ctx.lineTo(backBR.x, backBR.y);
    ctx.lineTo(W, edgeRB);
    ctx.moveTo(0, edgeLT);
    ctx.lineTo(backTL.x, backTL.y);
    ctx.lineTo(backTR.x, backTR.y);
    ctx.lineTo(W, edgeRT);
    ctx.moveTo(backTL.x, backTL.y);
    ctx.lineTo(backBL.x, backBL.y);
    ctx.moveTo(backTR.x, backTR.y);
    ctx.lineTo(backBR.x, backBR.y);
    ctx.stroke();

    ctx.restore();
  }

  // Floor shadows are decals on the floor, so they are drawn before everything that stands on it:
  // obstacles cast a soft shadow slightly larger than their footprint; a platform deck casts one on the
  // floor beneath it, which is what makes the open space under it read as open.
  drawFloorShadows() {
    const ctx = this.ctx;
    const poly = (x0, z0, x1, z1, alpha) => {
      const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => this.projectWorld(x, 0, z));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
      ctx.closePath();
      ctx.fill();
    };
    const m = GAME_CONFIG.OBSTACLES.SHADOW_MARGIN;
    ctx.save();
    ctx.fillStyle = '#000000';
    this.obstacles.forEach(o => poly(o.x - m, o.z - m, o.x + o.w + m, o.z + o.d + m, 0.3));
    this.platforms.forEach(pl => poly(pl.x, pl.z, pl.x + pl.w, pl.z + pl.d, 0.22));
    ctx.restore();
  }

  // Everything in the room is drawn in one pass in the order from getWorldDrawOrder().
  drawWorldEntities() {
    this.drawFloorShadows();
    this.getWorldDrawOrder().forEach((n) => {
      if (n.target) this.drawTargets([n.target]);
      else if (n.kind === 'obstacle') this.drawObstacles([n.box]);
      else this.drawPlatformPart(n.box);
    });
  }

  // One solid-box renderer for obstacles and platform parts: the visible faces (front, top, and the
  // inner side face) are polygons of projected world corners. `style` only picks colors.
  drawBox(box, style) {
    const ctx = this.ctx;
    const c = this.getBoxCorners(box);
    const { vpX, vpY, floorY } = this.getPerspective();
    const yb = box.surfaceHeight || 0, yt = yb + box.h;
    const face = (pts, fill) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.stroke();
    };

    ctx.save();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.lineWidth;
    ctx.lineJoin = 'round';
    if (box.x + box.w < vpX) face([c.fbr, c.bbr, c.btr, c.ftr], style.side);      // inner side face (right)
    else if (box.x > vpX) face([c.fbl, c.bbl, c.btl, c.ftl], style.side);          // inner side face (left)
    if (!style.noTop && yt < floorY - vpY) face([c.ftl, c.ftr, c.btr, c.btl], style.top); // top face (camera is above it)
    face([c.fbl, c.fbr, c.ftr, c.ftl], style.front);                               // front face
    if (style.diagonal) {
      ctx.beginPath();
      ctx.moveTo(c.ftl.x, c.ftl.y);
      ctx.lineTo(c.fbr.x, c.fbr.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // One platform part: the thin deck (neon top surface + fascia), a wall bracket or a suspension rod (chain).
  drawPlatformPart(part) {
    if (part.kind === 'bracket') {
      this.drawBracket(part);
    } else if (part.kind === 'rod') {
      this.drawChain(part);
    } else {
      this.drawBox(part, { front: '#1e2638', top: '#2a364f', side: '#151b2b', stroke: 'rgba(0, 255, 204, 0.55)', lineWidth: 1.5 });
      if (part.platform && part.platform.type === 'catwalk') this.drawCatwalkRibs(part);
    }
  }

  // Restrained industrial detail for a long catwalk: vertical seams on its visible inner fascia, at the
  // bracket spacing, drawn between projected world points on the deck's inner side face.
  drawCatwalkRibs(deck) {
    const pl = deck.platform;
    const xIn = pl.side > 0 ? pl.x : pl.x + pl.w;
    const step = GAME_CONFIG.PLATFORMS.TYPES.catwalk.braceSpacing;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let z = pl.z + step; z < pl.z + pl.d - 10; z += step) {
      const a = this.projectWorld(xIn, deck.surfaceHeight, z), b = this.projectWorld(xIn, deck.surfaceHeight + deck.h, z);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // A suspension rod drawn as a chain: a thin box from the deck's top up to the ceiling with link marks
  // every CHAIN_LINK world units, all from projected world points.
  drawChain(rod) {
    this.drawBox(rod, { front: '#243049', top: '#243049', side: '#18203a', stroke: 'rgba(0, 255, 204, 0.6)', lineWidth: 1.2 });
    const ctx = this.ctx;
    const link = GAME_CONFIG.PLATFORMS.CHAIN_LINK;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let y = rod.surfaceHeight + link; y < rod.surfaceHeight + rod.h; y += link) {
      const a = this.projectWorld(rod.x, y, rod.z), b = this.projectWorld(rod.x + rod.w, y, rod.z);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // A triangular wall bracket: the front plate plus any extruded edge that faces the camera, all from
  // projected world vertices (same projection as everything else).
  drawBracket(part) {
    const ctx = this.ctx;
    const cam = this.getCamera();
    const poly = part.poly, z0 = part.z, z1 = part.z + part.d;
    const P0 = poly.map(([x, y]) => this.projectWorld(x, y, z0));
    const P1 = poly.map(([x, y]) => this.projectWorld(x, y, z1));
    const fill = (pts, color) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
    };
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const ex = poly[j][0] - poly[i][0], ey = poly[j][1] - poly[i][1];
      const mx = (poly[i][0] + poly[j][0]) / 2, my = (poly[i][1] + poly[j][1]) / 2;
      if (ey * (cam.x - mx) - ex * (cam.y - my) > 0) fill([P0[i], P0[j], P1[j], P1[i]], '#11172a'); // edge faces the camera
    }
    fill(P0, '#171e2e');                                                                            // front plate
    ctx.restore();
  }

  // Whole platform in a valid painter order (brackets, then the deck, then rods). The room draws parts
  // individually through getWorldDrawOrder(); this is the standalone form.
  drawPlatform(pl) {
    const rank = { bracket: 0, deck: 1, rod: 2 };
    this.getPlatformParts(pl).slice().sort((a, b) => (rank[a.kind] - rank[b.kind]) || ((b.z + b.d) - (a.z + a.d))).forEach(q => this.drawPlatformPart(q));
  }

  // Contact shadow anchored on the target's support surface (floor or platform top) directly below it.
  // A target resting on the floor touches it; a raised target (hovering perk, popped-up cover
  // target) gets a smaller, fainter shadow at the same ground anchor.
  drawTargetShadow(t, proj) {
    const lift = Math.max(0, t.y - t.radius); // gap between the disc's bottom and the floor (world px)
    const heightFrac = Math.min(1, lift / 160);
    const rx = proj.radius * (1 - 0.25 * heightFrac);
    const ry = rx * 0.24;

    this.ctx.save();
    this.ctx.globalAlpha = 0.34 * (1 - 0.5 * heightFrac);
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.ellipse(proj.x, proj.surfaceY, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  // Obstacles keep their original look (dark fill, bright neon edge, diagonal) but are now solids.
  drawObstacles(list = this.obstacles) {
    list.forEach((o) => {
      this.drawBox(o, { front: '#1e2638', top: '#2b3750', side: '#161d2d', stroke: '#00ffcc', lineWidth: 2, diagonal: true });
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

  drawTargets(list = this.getTargetsInDrawOrder()) {
    const threatProgress = Math.max(0, Math.min(1, 1 - (this.waveThreatTimer / this.waveThreatDuration)));

    list.forEach((t) => {
      const proj = this.projectTarget(t);
      this.drawTargetShadow(t, proj);

      this.ctx.save();
      this.ctx.translate(proj.x, proj.y);
      this.ctx.scale(proj.scale, proj.scale); // uniform: existing artwork is reused as-is

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
      if (this.gameMode !== 'PAUSED') p.update();
      p.draw(this.ctx);
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawFloatingTexts() {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      if (this.gameMode !== 'PAUSED') ft.update();
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

  // Sized in logical canvas pixels (the canvas is scaled to the screen as a whole). The font used to be assigned
  // to `this.font` instead of `this.ctx.font`, so the text always rendered at the 10px canvas default.
  drawRoundBanner() {
    const ctx = this.ctx;
    ctx.save();
    const boxWidth = 380;
    const boxHeight = 80;
    const boxX = (GAME_CONFIG.LOGICAL_WIDTH - boxWidth) / 2;
    const boxY = GAME_CONFIG.HUD_HEIGHT + 20;

    ctx.fillStyle = 'rgba(15, 16, 24, 0.92)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`ROUND ${this.state.round}`, GAME_CONFIG.LOGICAL_WIDTH / 2, boxY + boxHeight / 2 + 2);
    ctx.restore();
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
