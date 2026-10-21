// Platanus Hack 26 — Caracas Arcade Edition
// CHAMITO: LA MATA DE MANGO
// Recreación en Phaser 3 del clásico juego de los celulares Vergatarios en Venezuela

const GAME_WIDTH = 480;
const GAME_HEIGHT = 640;

// Mapeo obligatorio de controles para el mueble arcade físico
const CABINET_KEYS = {
  P1_U: ['w', 'ArrowUp'],
  P1_D: ['s', 'ArrowDown'],
  P1_L: ['a', 'ArrowLeft'],
  P1_R: ['d', 'ArrowRight'],
  P1_1: ['u', 'p', ' '],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l', 'r'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter', ' '],
  START2: ['2'],
};

// Registro de teclas (WASD y Flechas con máxima prioridad y compatibilidad)
const held = {
  P1_U: false,
  P1_D: false,
  P1_L: false,
  P1_R: false,
  START1: false,
};
const justPressed = {
  P1_U: false,
  P1_D: false,
  P1_L: false,
  P1_R: false,
  START1: false,
  P1_1: false,
  RESET: false,
};

window.addEventListener('keydown', (e) => {
  const k = e.key;
  const code = e.code;

  if (k === 'ArrowUp' || k === 'w' || k === 'W' || code === 'KeyW' || code === 'ArrowUp') {
    if (!held.P1_U) justPressed.P1_U = true;
    held.P1_U = true;
    e.preventDefault();
  }
  if (k === 'ArrowDown' || k === 's' || k === 'S' || code === 'KeyS' || code === 'ArrowDown') {
    if (!held.P1_D) justPressed.P1_D = true;
    held.P1_D = true;
    e.preventDefault();
  }
  if (k === 'ArrowLeft' || k === 'a' || k === 'A' || code === 'KeyA' || code === 'ArrowLeft') {
    if (!held.P1_L) justPressed.P1_L = true;
    held.P1_L = true;
    e.preventDefault();
  }
  if (k === 'ArrowRight' || k === 'd' || k === 'D' || code === 'KeyD' || code === 'ArrowRight') {
    if (!held.P1_R) justPressed.P1_R = true;
    held.P1_R = true;
    e.preventDefault();
  }
  if (k === 'Enter' || k === ' ' || k === 'Spacebar' || code === 'Space' || code === 'Enter') {
    if (!held.START1) justPressed.START1 = true;
    held.START1 = true;
    e.preventDefault();
  }
  if (k === 'p' || k === 'P' || k === 'Escape' || code === 'KeyP' || code === 'Escape') {
    justPressed.P1_1 = true;
    e.preventDefault();
  }
  if (k === 'r' || k === 'R' || code === 'KeyR') {
    justPressed.RESET = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key;
  const code = e.code;
  if (k === 'ArrowUp' || k === 'w' || k === 'W' || code === 'KeyW' || code === 'ArrowUp') held.P1_U = false;
  if (k === 'ArrowDown' || k === 's' || k === 'S' || code === 'KeyS' || code === 'ArrowDown') held.P1_D = false;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A' || code === 'KeyA' || code === 'ArrowLeft') held.P1_L = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D' || code === 'KeyD' || code === 'ArrowRight') held.P1_R = false;
  if (k === 'Enter' || k === ' ' || k === 'Spacebar' || code === 'Space' || code === 'Enter') held.START1 = false;
});

// --- Almacenamiento persistente ---
function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? { found: false, value: null } : { found: true, value: JSON.parse(raw) };
      } catch (err) {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {}
    },
  };
}

// --- Audio Sintetizado (Web Audio API - Cero archivos externos) ---
class ArcadeAudio {
  constructor(soundManager) {
    this.sound = soundManager;
    this.ctx = soundManager.context;
    this.muted = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  playTone(freq, type, duration, vol = 0.15, slideTo = null) {
    if (this.muted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, slideTo), this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  jump() {
    this.playTone(320, 'sine', 0.1, 0.22, 620);
  }

  munch() {
    this.playTone(590, 'square', 0.08, 0.18, 940);
  }

  golden() {
    [440, 554, 659, 880, 1108].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.16, 0.22), i * 55);
    });
  }

  hurt() {
    this.playTone(190, 'sawtooth', 0.22, 0.3, 60);
  }

  smash() {
    this.playTone(450, 'sawtooth', 0.1, 0.25, 120);
  }

  chamitoFall() {
    this.playTone(420, 'sine', 0.14, 0.35, 840);
    setTimeout(() => {
      this.playTone(680, 'sawtooth', 0.65, 0.3, 65);
    }, 130);
  }

  gameOver() {
    [380, 320, 260, 200, 140].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.28, 0.28, f * 0.8), i * 110);
    });
  }

  startBGM() {
    if (this.bgmTimer) return;
    this.bgmStep = 0;

    // Tema Chiptune 8-bit Venezolano ("Moliendo Café" - Hugo Blanco)
    // Melodía alegre, icónica y pegajosa que acompaña al Chamito
    const melody = [
      330, 440, 494, 523, 494, 440, 494, 415, 330, 0,
      330, 415, 440, 494, 440, 415, 440, 0,
      440, 494, 523, 587, 523, 494, 523, 440, 0,
      523, 587, 659, 587, 523, 494, 523, 494, 440, 415, 440, 0, 0
    ];

    // Bajo tropical venezolano (Tumbao / Joropo sincopado en Am, E7 y Dm)
    const bassline = [
      110, 165, 110, 165, 110, 165, 82, 123, 82, 123,
      82, 123, 82, 123, 110, 165, 110, 165,
      147, 220, 147, 220, 110, 165, 110, 165,
      147, 220, 110, 165, 82, 123, 82, 123, 110, 165, 110, 165, 110, 0
    ];

    const tick = () => {
      if (!this.muted && this.ctx) {
        const step = this.bgmStep % melody.length;
        const note = melody[step];
        const bass = bassline[step % bassline.length];

        const isSuper = typeof superTimer !== 'undefined' && superTimer > 0;
        const isSpace = typeof altitude !== 'undefined' && altitude >= 750;

        // 1. Melodía Chiptune (en tierra es onda cuadrada arcade; en el espacio es sintetizador cósmico; con super arepa brilla en agudos)
        if (note > 0) {
          const leadFreq = isSuper ? note * 1.5 : (isSpace ? note * 1.2 : note);
          const leadWave = isSuper ? 'triangle' : (isSpace ? 'sine' : 'square');
          const leadVol = isSuper ? 0.07 : (isSpace ? 0.05 : 0.045);
          this.playTone(leadFreq, leadWave, 0.12, leadVol);
        }

        // 2. Bajo tropical cálido
        if (bass > 0) {
          const bassFreq = isSpace ? bass * 1.5 : bass;
          const bassWave = isSpace ? 'sine' : 'triangle';
          this.playTone(bassFreq, bassWave, 0.14, 0.055);
        }

        // 3. Maraquita / Shaker rítmico en contratiempo caribeño
        if (this.bgmStep % 2 === 1) {
          const shakerPitch = isSpace ? 2200 : (1200 + (this.bgmStep % 4) * 90);
          this.playTone(shakerPitch, 'sawtooth', 0.02, 0.012);
        }
      }

      this.bgmStep++;
      // Con la Super Arepa se acelera el tempo para máxima emoción arcade!
      const stepDuration = (typeof superTimer !== 'undefined' && superTimer > 0) ? 128 : 160;
      this.bgmTimer = setTimeout(tick, stepDuration);
    };

    tick();
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

// --- CONSTANTES DEL JUEGO ---
const NUM_TRUNKS = 4;
const TRUNK_X = [80, 180, 300, 400]; // 4 Troncos distribuidos a lo ancho
const OFFSET_X = 22; // Distancia al abrazar el tronco

const STATE_MENU = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;
const STATE_DYING = 3;
const STATE_GAMEOVER = 4;

// --- CONFIGURACIÓN DE PHASER 3 ---
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-root',
  backgroundColor: '#041008',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: {
    preload,
    create,
    update,
  },
};

new Phaser.Game(config);

function preload() {}

let currentScene;
let sfx;
let gameState = STATE_MENU;
let score = 0;
let mangosCount = 0;
let lives = 3;
let altitude = 0;
let highScore = 0;
let bestAltitude = 0;
let superTimer = 0;
let invulTimer = 0;
let scrollSpeed = 0.5;

// Objeto del Chamito (Comienza en el suelo del patio junto al tronco)
let chamito = {
  trunk: 1,
  side: 1,
  x: TRUNK_X[1] + OFFSET_X,
  targetX: TRUNK_X[1] + OFFSET_X,
  y: 535, // En el suelo firme del patio
  targetY: 535,
  sprite: null,
  isDying: false,
  deathVx: 0,
  deathVy: 0,
  climbAnimTimer: 0,
  climbFrame: 0,
};

let ants = [];
let mangos = [];
let floatingTexts = [];
let antSpawnTimer = 0;
let mangoSpawnTimer = 0;

// Capas de render
let bgGraphics;
let treeGraphics;
let superAuraGraphics;
let hudGraphics;
let hudTexts = {};
let centerMenuText;
let starShield = [];
let gameOverCooldown = 0;

function create() {
  currentScene = this;
  sfx = new ArcadeAudio(this.sound);

  // Cargar High Score previo
  getStorage().get('chamito_high_score').then((res) => {
    if (res.found && typeof res.value === 'number') {
      highScore = res.value;
      broadcastStats();
    }
  });
  getStorage().get('chamito_best_altitude').then((res) => {
    if (res.found && typeof res.value === 'number') {
      bestAltitude = res.value;
      broadcastStats();
    }
  });

  generateProceduralTextures(this);

  // 1. Capas Gráficas
  bgGraphics = this.add.graphics().setDepth(1);
  treeGraphics = this.add.graphics().setDepth(5);
  superAuraGraphics = this.add.graphics().setDepth(19);

  // 2. Sprite del Chamito y sus 3 Mini Arepitas de Poder en Órbita 3D
  chamito.sprite = this.add.sprite(chamito.x, chamito.y, 'tex_chamito').setDepth(20);
  starShield = [
    this.add.sprite(0, 0, 'tex_mini_arepa').setDepth(25).setVisible(false),
    this.add.sprite(0, 0, 'tex_mini_arepa').setDepth(25).setVisible(false),
    this.add.sprite(0, 0, 'tex_mini_arepa').setDepth(25).setVisible(false),
  ];

  // 3. HUD superior elegante (delgado, no tapa el juego)
  createSleekHUD(this);

  // 4. Scanlines CRT del canvas
  drawCRTScanlines(this);

  // 5. Menú Inicial
  centerMenuText = this.add.text(240, 310, '', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#ffe600',
    align: 'center',
    backgroundColor: '#031208',
    padding: { x: 20, y: 16 },
    lineSpacing: 8,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(110);

  // Soporte de clic/touch para iniciar o continuar
  this.input.on('pointerdown', () => {
    if (gameState === STATE_MENU) {
      startFreshGame();
    } else if (gameState === STATE_GAMEOVER && gameOverCooldown <= 0) {
      startFreshGame();
    }
  });

  showMenuUI(true);
  renderDynamicBackground();
  renderMangoTrunks();
}

// --- GENERACIÓN DE TEXTURAS PROCEDURALES ---
function generateProceduralTextures(scene) {
  // 1A. Chamito Trepador - Cuadro 1 (Brazo derecho arriba agarrando corteza, rodilla derecha flexionada, SIN bolso)
  const gC1 = scene.make.graphics({ x: 0, y: 0, add: false });
  // Pierna trasera (izquierda) empujando hacia abajo
  gC1.fillStyle(0x101758, 1);
  gC1.fillRoundedRect(10, 26, 6, 9, 2);
  gC1.fillStyle(0xbe8b68, 1);
  gC1.fillRect(11, 34, 5, 7);
  gC1.fillStyle(0x38241f, 1);
  gC1.fillRoundedRect(9, 40, 7, 5, 2);

  // Brazo trasero (izquierdo) apoyado a media altura en el tronco
  gC1.fillStyle(0xbe8b68, 1);
  gC1.fillCircle(24, 23, 3.5);
  gC1.fillRect(25, 21, 3, 4);

  // Camisa escolar blanca (sin bolso/morral, libre y atlético)
  gC1.fillStyle(0xf8f9fa, 1);
  gC1.fillRoundedRect(9, 15, 14, 13, 3);
  gC1.fillStyle(0xd0d5dd, 1);
  gC1.fillRect(14, 15, 4, 3); // Cuello de la chemise

  // Pierna delantera (derecha) rodilla arriba abrazando el tronco
  gC1.fillStyle(0x1a237e, 1);
  gC1.fillRoundedRect(15, 25, 8, 8, 2);
  gC1.fillStyle(0xd7a17c, 1);
  gC1.fillRect(19, 31, 6, 6);
  gC1.fillStyle(0x4e342e, 1);
  gC1.fillRoundedRect(21, 36, 7, 5, 2);

  // Brazo delantero (derecho) estirado ALTO trepando y agarrando corteza
  gC1.lineStyle(4, 0xd7a17c, 1);
  gC1.beginPath();
  gC1.moveTo(18, 17);
  gC1.lineTo(23, 11);
  gC1.lineTo(27, 8);
  gC1.strokePath();
  gC1.fillStyle(0xd7a17c, 1);
  gC1.fillCircle(27, 8, 3.8);
  gC1.fillRect(28, 6, 3, 4.5); // Dedos agarrando

  // Cabeza del chamito (Cara normal de niño venezolano, piel limpia, CERO máscara)
  // 1. Base de la cabeza y cuello
  gC1.fillStyle(0xd7a17c, 1); // Piel mestiza venezolana
  gC1.fillCircle(18, 11, 7.5);
  // Orejita
  gC1.fillCircle(11, 11, 2.5);
  gC1.fillStyle(0xbe8b68, 1);
  gC1.fillCircle(11, 11, 1.2);

  // 2. Cabello negro natural (ÚNICAMENTE en coronilla y atrás, cara 100% despejada y limpia)
  gC1.fillStyle(0x212121, 1);
  gC1.fillEllipse(17, 5.5, 7.5, 4); // Parte superior del cráneo
  gC1.fillRoundedRect(11, 5, 5, 6, 2); // Nuca / parte trasera
  gC1.fillTriangle(18, 4, 23, 3, 20, 6.8); // Pequeño mechón en la frente alta

  // 3. Rasgos faciales normales y nítidos sobre la piel limpia
  // Cejita
  gC1.lineStyle(1.2, 0x4a2e18, 1);
  gC1.lineBetween(17.5, 8.2, 20.5, 8.0);

  // Ojo alegre normal (esclerótica blanca + iris oscuro + brillo)
  gC1.fillStyle(0xffffff, 1);
  gC1.fillEllipse(19.2, 10.5, 2.8, 2.2);
  gC1.fillStyle(0x1a0f0a, 1);
  gC1.fillCircle(19.8, 10.5, 1.3);
  gC1.fillStyle(0xffffff, 1);
  gC1.fillRect(20, 9.8, 1, 1);

  // Naricita sutil
  gC1.fillStyle(0xc28763, 1);
  gC1.fillCircle(24, 11.5, 1.2);

  // Sonrisa de trepar
  gC1.lineStyle(1.4, 0x5d4037, 1);
  gC1.beginPath();
  gC1.arc(19, 14, 2.4, 0.15, Math.PI * 0.85, false);
  gC1.strokePath();

  // Mejilla sonrosada
  gC1.fillStyle(0xe57373, 0.4);
  gC1.fillCircle(16.5, 13, 2);

  gC1.generateTexture('tex_chamito_climb1', 38, 46);
  gC1.generateTexture('tex_chamito', 38, 46); // Compatible con la textura base
  gC1.destroy();

  // 1B. Chamito Trepador - Cuadro 2 (Brazo izquierdo arriba, rodilla izquierda flexionada, alternancia activa estilo mono)
  const gC2 = scene.make.graphics({ x: 0, y: 0, add: false });
  // Pierna delantera (derecha) empujando hacia abajo
  gC2.fillStyle(0x1a237e, 1);
  gC2.fillRoundedRect(14, 25, 7, 9, 2);
  gC2.fillStyle(0xd7a17c, 1);
  gC2.fillRect(15, 33, 5, 8);
  gC2.fillStyle(0x4e342e, 1);
  gC2.fillRoundedRect(13, 40, 7, 5, 2);

  // Pierna trasera (izquierda) rodilla arriba abrazando el tronco
  gC2.fillStyle(0x101758, 1);
  gC2.fillRoundedRect(11, 24, 7, 8, 2);
  gC2.fillStyle(0xbe8b68, 1);
  gC2.fillRect(17, 29, 6, 7);
  gC2.fillStyle(0x38241f, 1);
  gC2.fillRoundedRect(19, 35, 7, 5, 2);

  // Brazo trasero (izquierdo) estirado ALTO agarrando corteza arriba
  gC2.lineStyle(3.5, 0xbe8b68, 1);
  gC2.beginPath();
  gC2.moveTo(15, 16);
  gC2.lineTo(21, 10);
  gC2.lineTo(26, 7);
  gC2.strokePath();
  gC2.fillStyle(0xbe8b68, 1);
  gC2.fillCircle(26, 7, 3.5);
  gC2.fillRect(27, 5, 2.5, 4);

  // Camisa escolar blanca (ligero rebote vertical de 1px por el paso de trepada)
  gC2.fillStyle(0xf8f9fa, 1);
  gC2.fillRoundedRect(9, 14, 14, 13, 3);
  gC2.fillStyle(0xd0d5dd, 1);
  gC2.fillRect(14, 14, 4, 3);

  // Brazo delantero (derecho) flexionado a media altura haciendo palanca hacia arriba
  gC2.lineStyle(4, 0xd7a17c, 1);
  gC2.beginPath();
  gC2.moveTo(18, 16);
  gC2.lineTo(22, 21);
  gC2.lineTo(25, 23);
  gC2.strokePath();
  gC2.fillStyle(0xd7a17c, 1);
  gC2.fillCircle(25, 23, 3.8);
  gC2.fillRect(26, 21, 3, 4.5);

  // Cabeza del chamito (Cara normal, sube 1px con el impulso, piel limpia)
  // 1. Base de la cabeza y cuello
  gC2.fillStyle(0xd7a17c, 1);
  gC2.fillCircle(18, 10, 7.5);
  // Orejita
  gC2.fillCircle(11, 10, 2.5);
  gC2.fillStyle(0xbe8b68, 1);
  gC2.fillCircle(11, 10, 1.2);

  // 2. Cabello negro natural (coronilla y parte trasera, cara despejada)
  gC2.fillStyle(0x212121, 1);
  gC2.fillEllipse(17, 4.5, 7.5, 4);
  gC2.fillRoundedRect(11, 4, 5, 6, 2);
  gC2.fillTriangle(18, 3, 23, 2, 20, 5.8);

  // 3. Rasgos faciales normales y nítidos
  // Cejita
  gC2.lineStyle(1.2, 0x4a2e18, 1);
  gC2.lineBetween(17.5, 7.2, 20.5, 7.0);

  // Ojo alegre normal
  gC2.fillStyle(0xffffff, 1);
  gC2.fillEllipse(19.2, 9.5, 2.8, 2.2);
  gC2.fillStyle(0x1a0f0a, 1);
  gC2.fillCircle(19.8, 9.5, 1.3);
  gC2.fillStyle(0xffffff, 1);
  gC2.fillRect(20, 8.8, 1, 1);

  // Naricita sutil
  gC2.fillStyle(0xc28763, 1);
  gC2.fillCircle(24, 10.5, 1.2);

  // Sonrisa
  gC2.lineStyle(1.4, 0x5d4037, 1);
  gC2.beginPath();
  gC2.arc(19, 13, 2.4, 0.15, Math.PI * 0.85, false);
  gC2.strokePath();

  // Mejilla sonrosada
  gC2.fillStyle(0xe57373, 0.4);
  gC2.fillCircle(16.5, 12, 2);

  gC2.generateTexture('tex_chamito_climb2', 38, 46);
  gC2.destroy();

  // 2. Chamito golpeado / cayendo (Sin bolso, brazos abiertos en susto, ojos X X, boca en O)
  const gCH = scene.make.graphics({ x: 0, y: 0, add: false });
  // Piernas abiertas pataleando
  gCH.fillStyle(0x1a237e, 1);
  gCH.fillRect(9, 27, 6, 11);
  gCH.fillRect(21, 27, 6, 11);
  gCH.fillStyle(0x4e342e, 1);
  gCH.fillRect(7, 37, 7, 5);
  gCH.fillRect(22, 37, 7, 5);

  // Camisa escolar blanca limpia (sin bolso)
  gCH.fillStyle(0xf8f9fa, 1);
  gCH.fillRoundedRect(10, 16, 16, 13, 3);

  // Brazos abiertos de susto
  gCH.fillStyle(0xd7a17c, 1);
  gCH.fillCircle(28, 16, 4);
  gCH.fillCircle(7, 16, 4);

  // Cabeza (Cara normal despejada)
  gCH.fillStyle(0xd7a17c, 1);
  gCH.fillCircle(18, 10, 7.5);
  // Cabello solo en coronilla y atrás
  gCH.fillStyle(0x212121, 1);
  gCH.fillEllipse(17, 4.5, 7.5, 4);
  gCH.fillRoundedRect(11, 4, 5, 6, 2);

  // Ojos X X sobre piel limpia
  gCH.lineStyle(1.8, 0x000000, 1);
  gCH.beginPath();
  gCH.moveTo(14, 7); gCH.lineTo(18, 11);
  gCH.moveTo(18, 7); gCH.lineTo(14, 11);
  gCH.moveTo(19, 7); gCH.lineTo(23, 11);
  gCH.moveTo(23, 7); gCH.lineTo(19, 11);
  gCH.strokePath();

  // Boca abierta "O"
  gCH.fillStyle(0x3e2723, 1);
  gCH.fillCircle(18, 14, 2.5);

  gCH.generateTexture('tex_chamito_hurt', 38, 46);
  gCH.destroy();

  // 3. Mango Criollo Maduro
  const gM = scene.make.graphics({ x: 0, y: 0, add: false });
  gM.fillStyle(0x7cb342, 1);
  gM.fillEllipse(10, 14, 9, 12);
  gM.fillStyle(0xffb300, 1);
  gM.fillEllipse(13, 14, 11, 13);
  gM.fillStyle(0xd32f2f, 0.95);
  gM.fillEllipse(16, 14, 8, 11);

  gM.fillStyle(0xffffff, 0.5);
  gM.fillCircle(11, 10, 2.5);

  gM.fillStyle(0x5d4037, 1);
  gM.fillRect(12, 2, 2, 4);
  gM.fillStyle(0x2e7d32, 1);
  gM.fillTriangle(14, 3, 21, 1, 17, 6);

  gM.generateTexture('tex_mango', 26, 28);
  gM.destroy();

  // 4. AREPA VENEZOLANA DORADA (Item de Poder Especial Tostadito)
  const gA = scene.make.graphics({ x: 0, y: 0, add: false });
  // Sombra suave
  gA.fillStyle(0x000000, 0.35);
  gA.fillCircle(14, 15, 12);
  // Masa de maíz dorado y tostado
  gA.fillStyle(0xd99b26, 1);
  gA.fillCircle(14, 13, 12);
  gA.fillStyle(0xf5cb5c, 1);
  gA.fillCircle(14, 13, 10.5);
  gA.fillStyle(0xfff194, 0.9);
  gA.fillCircle(13, 12, 7.5);
  // Quemaditos de budare tostados y crujientes
  gA.lineStyle(2, 0x5d4037, 0.95);
  gA.lineBetween(7, 9, 21, 9);
  gA.lineBetween(5, 13, 23, 13);
  gA.lineBetween(8, 17, 20, 17);
  // Brillo de mantequilla derretida
  gA.fillStyle(0xffffff, 0.95);
  gA.fillCircle(10, 8, 2);
  // Chispas doradas de poder alrededor de la arepa
  gA.fillStyle(0xffd700, 1);
  gA.fillRect(1, 13, 3, 2);
  gA.fillRect(24, 13, 3, 2);
  gA.fillRect(13, 1, 2, 3);
  gA.fillRect(13, 24, 2, 3);
  gA.generateTexture('tex_arepa', 28, 28);
  gA.generateTexture('tex_mango_gold', 28, 28); // Compatibilidad
  gA.destroy();

  // 5. MINI AREPITA TOSTADA DE PODER (Escudo sagrado de poder criollo con budare y mantequilla)
  const gMA = scene.make.graphics({ x: 0, y: 0, add: false });
  // Halo exterior dorado suave
  gMA.fillStyle(0xffd54f, 0.4);
  gMA.fillCircle(11, 11, 10.5);
  // Masa de maíz dorada y tostadita
  gMA.fillStyle(0xd99b26, 1);
  gMA.fillCircle(11, 11, 8.5);
  gMA.fillStyle(0xf5cb5c, 1);
  gMA.fillCircle(11, 11, 7.2);
  gMA.fillStyle(0xfff194, 0.95);
  gMA.fillCircle(10, 10, 5);
  // Quemaditos de budare crujientes
  gMA.lineStyle(1.6, 0x5d4037, 1);
  gMA.lineBetween(6, 8, 16, 8);
  gMA.lineBetween(5, 11, 17, 11);
  gMA.lineBetween(7, 14, 15, 14);
  // Brillo de mantequilla derretida
  gMA.fillStyle(0xffffff, 1);
  gMA.fillCircle(8, 7, 1.5);
  gMA.generateTexture('tex_mini_arepa', 22, 22);
  gMA.generateTexture('tex_star', 22, 22); // Compatibilidad
  gMA.destroy();

  // 5. HORMIGAS EN VISTA DE PERFIL (DE LADO NORMAL) TREPANDO CON ANIMACIÓN ACTIVA DE 2 CUADROS
  function createSideAntTexture(name, mainColor, darkColor, eyeColor, isGiant = false) {
    const w = isGiant ? 24 : 20;
    const h = isGiant ? 34 : 28;

    [1, 2].forEach((frame) => {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const ox = isGiant ? 2 : 0;
      const oy = isGiant ? 3 : 0;

      // A. Patas lejanas (sombra en segundo plano)
      g.lineStyle(isGiant ? 2 : 1.5, darkColor, 0.85);
      if (frame === 1) {
        g.lineBetween(10 + ox, 14 + oy, 16 + ox, 10 + oy);
        g.lineBetween(12 + ox, 18 + oy, 7 + ox, 16 + oy);
        g.lineBetween(13 + ox, 21 + oy, 17 + ox, 25 + oy);
      } else {
        g.lineBetween(10 + ox, 14 + oy, 7 + ox, 9 + oy);
        g.lineBetween(12 + ox, 18 + oy, 17 + ox, 16 + oy);
        g.lineBetween(13 + ox, 21 + oy, 14 + ox, 24 + oy);
      }

      // B. Abdomen bulboso arqueado en perfil lateral (Gaster)
      g.fillStyle(mainColor, 1);
      g.fillEllipse(8 + ox, 7 + oy, isGiant ? 12 : 9, isGiant ? 15 : 12);
      g.lineStyle(1.2, darkColor, 0.9);
      g.lineBetween(4 + ox, 6 + oy, 12 + ox, 6 + oy);
      g.lineBetween(3 + ox, 9 + oy, 13 + ox, 9 + oy);

      // C. Cintura fina / Nodo (Pecíolo)
      g.fillStyle(darkColor, 1);
      g.fillCircle(10 + ox, 14 + oy, isGiant ? 2.5 : 2);

      // D. Tórax muscular en perfil
      g.fillStyle(mainColor, 1);
      g.fillEllipse(11 + ox, 18 + oy, isGiant ? 7 : 5.5, isGiant ? 9 : 7);

      // E. Cabeza mirando hacia abajo abrazando la corteza
      g.fillStyle(darkColor, 1);
      g.fillCircle(13 + ox, 23 + oy, isGiant ? 5 : 4);

      // Ojo brillante
      g.fillStyle(eyeColor, 1);
      g.fillCircle(12 + ox, 22.5 + oy, 1.4);
      g.fillStyle(0x000000, 1);
      g.fillCircle(12 + ox, 23 + oy, 0.7);

      // Mandíbulas tenaza mordiendo hacia la madera
      g.lineStyle(isGiant ? 2 : 1.5, 0xffffff, 1);
      g.lineBetween(13 + ox, 26 + oy, 16 + ox, 28 + oy);
      g.lineBetween(15 + ox, 25 + oy, 18 + ox, 27 + oy);

      // Antena arqueada hacia abajo
      g.lineStyle(1.2, mainColor, 1);
      g.lineBetween(13 + ox, 21 + oy, 16 + ox, 20 + oy);
      g.lineBetween(16 + ox, 20 + oy, 18 + ox, 22 + oy);

      // F. Patas cercanas activas agarrando corteza (paso alternado en perfil)
      g.lineStyle(isGiant ? 2.2 : 1.6, mainColor, 1);
      if (frame === 1) {
        g.lineBetween(13 + ox, 21 + oy, 18 + ox, 24 + oy); // Delantera
        g.lineBetween(11 + ox, 18 + oy, 6 + ox, 15 + oy);  // Media
        g.lineBetween(10 + ox, 14 + oy, 17 + ox, 12 + oy); // Trasera
      } else {
        g.lineBetween(13 + ox, 21 + oy, 14 + ox, 23 + oy); // Delantera
        g.lineBetween(11 + ox, 18 + oy, 18 + ox, 18 + oy); // Media
        g.lineBetween(10 + ox, 14 + oy, 7 + ox, 10 + oy);  // Trasera
      }

      g.generateTexture(`${name}_${frame}`, w, h);
      if (frame === 1) g.generateTexture(name, w, h); // Compatibilidad retro
      g.destroy();
    });
  }

  // Generar las 4 especies de hormigas en vista de perfil con sus 2 cuadros de caminata
  createSideAntTexture('tex_ant_red', 0xd32f2f, 0x8e0000, 0xffffff);
  createSideAntTexture('tex_ant_black', 0x37474f, 0x1a2327, 0xffffff);
  createSideAntTexture('tex_ant_fire', 0xff5722, 0xbf360c, 0xffff00);
  createSideAntTexture('tex_ant_giant', 0x7f0000, 0x4a0000, 0xffff00, true);

  // 8. PLATILLO VOLADOR ALIENÍGENA (Enemigo en el Espacio)
  const gU1 = scene.make.graphics({ x: 0, y: 0, add: false });
  // Haz de energía inferior
  gU1.fillStyle(0x00e5ff, 0.35);
  gU1.fillTriangle(13, 16, 4, 25, 22, 25);
  // Disco metálico
  gU1.fillStyle(0x00e5ff, 1);
  gU1.fillEllipse(13, 14, 24, 9);
  gU1.fillStyle(0x00838f, 1);
  gU1.fillEllipse(13, 14, 18, 6);
  // Cúpula transparente
  gU1.fillStyle(0xb2ebf2, 0.85);
  gU1.fillCircle(13, 9, 6.5);
  // Marcianito verde adentro con grandes ojos negros
  gU1.fillStyle(0x76ff03, 1);
  gU1.fillCircle(13, 9.5, 3.5);
  gU1.fillStyle(0x000000, 1);
  gU1.fillCircle(11.5, 9, 1.2);
  gU1.fillCircle(14.5, 9, 1.2);
  // Luces de neón en el borde
  gU1.fillStyle(0xffeb3b, 1); gU1.fillCircle(6, 15, 1.4);
  gU1.fillStyle(0xff1744, 1); gU1.fillCircle(13, 16, 1.6);
  gU1.fillStyle(0x39ff6e, 1); gU1.fillCircle(20, 15, 1.4);
  gU1.generateTexture('tex_ufo_scout', 26, 26);
  gU1.destroy();

  // 9. NAVE ALIENÍGENA DE ATAQUE VELOZ (Enemigo en el Espacio)
  const gU2 = scene.make.graphics({ x: 0, y: 0, add: false });
  // Alas delta cibernéticas rojas
  gU2.fillStyle(0xd50000, 1);
  gU2.fillTriangle(13, 2, 2, 20, 24, 20);
  // Núcleo de mando oscuro
  gU2.fillStyle(0x212121, 1);
  gU2.fillTriangle(13, 6, 7, 18, 19, 18);
  // Sensor / ojo cibernético amarillo y rojo
  gU2.fillStyle(0xffff00, 1);
  gU2.fillCircle(13, 12, 2.5);
  gU2.fillStyle(0xff1744, 1);
  gU2.fillCircle(13, 12, 1.2);
  // Propulsores de plasma azul
  gU2.fillStyle(0x00e5ff, 0.95);
  gU2.fillTriangle(5, 20, 9, 20, 7, 25);
  gU2.fillTriangle(17, 20, 21, 20, 19, 25);
  gU2.generateTexture('tex_ufo_fighter', 26, 26);
  gU2.destroy();

  // 9B. NAVE NODRIZA ALIENÍGENA (Enemigo espacial imponente)
  const gU3 = scene.make.graphics({ x: 0, y: 0, add: false });
  // Haz de rayos tractor violeta
  gU3.fillStyle(0xe040fb, 0.35);
  gU3.fillTriangle(14, 16, 3, 27, 25, 27);
  // Casco acorazado
  gU3.fillStyle(0x7b1fa2, 1);
  gU3.fillEllipse(14, 14, 26, 11);
  gU3.fillStyle(0xba68c8, 1);
  gU3.fillEllipse(14, 14, 20, 7);
  // Cúpula biocósmica
  gU3.fillStyle(0x18ffff, 0.85);
  gU3.fillCircle(14, 9, 6.5);
  // Núcleo cibernético alien
  gU3.fillStyle(0x76ff03, 1);
  gU3.fillCircle(14, 9, 3.5);
  gU3.fillStyle(0x000000, 1);
  gU3.fillCircle(12.5, 8.5, 1.2);
  gU3.fillCircle(15.5, 8.5, 1.2);
  // Luces de propulsión
  gU3.fillStyle(0xff1744, 1); gU3.fillCircle(6, 16, 1.5);
  gU3.fillStyle(0xffff00, 1); gU3.fillCircle(14, 17, 1.8);
  gU3.fillStyle(0xff1744, 1); gU3.fillCircle(22, 16, 1.5);
  gU3.generateTexture('tex_ufo_cruiser', 28, 28);
  gU3.destroy();
}

// --- HUD SUPERIOR ELEGANTE Y LEGIBLE ---
function createSleekHUD(scene) {
  // Fondo del HUD en Depth 100 (por encima del juego y de las scanlines para máxima nitidez)
  hudGraphics = scene.add.graphics().setDepth(100);

  // Barra de cabecera arcade de 50px de altura con fondo oscuro satinado
  hudGraphics.fillStyle(0x021308, 0.94);
  hudGraphics.fillRect(0, 0, GAME_WIDTH, 50);

  // Borde inferior arcade de neón verde y sutil resplandor
  hudGraphics.lineStyle(2, 0x1fa347, 1);
  hudGraphics.lineBetween(0, 50, GAME_WIDTH, 50);
  hudGraphics.lineStyle(1, 0x39ff6e, 0.5);
  hudGraphics.lineBetween(0, 48, GAME_WIDTH, 48);

  // Separadores verticales entre métricas
  hudGraphics.lineStyle(1, 0x1a4a26, 0.6);
  hudGraphics.lineBetween(112, 6, 112, 44);
  hudGraphics.lineBetween(228, 6, 228, 44);
  hudGraphics.lineBetween(344, 6, 344, 44);

  // Estilos de fuentes claros y grandes
  const labelStyle = { fontFamily: 'monospace', fontSize: '9px', color: '#80e27e', fontStyle: 'bold' };

  // 1. Vidas (Corazones)
  scene.add.text(14, 6, 'VIDAS', labelStyle).setDepth(101);
  hudTexts.lives = scene.add.text(12, 19, '❤️❤️❤️', { fontSize: '18px' }).setDepth(101);

  // 2. Mangos
  scene.add.text(124, 6, 'MANGOS', { ...labelStyle, color: '#ffe600' }).setDepth(101);
  hudTexts.mangos = scene.add.text(122, 19, '0 🥭', {
    fontFamily: 'monospace',
    fontSize: '17px',
    color: '#ffe600',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setDepth(101);

  // 3. Altura (Metros)
  scene.add.text(240, 6, 'ALTURA', labelStyle).setDepth(101);
  hudTexts.altitude = scene.add.text(238, 19, '0m', {
    fontFamily: 'monospace',
    fontSize: '17px',
    color: '#69f0ae',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setDepth(101);

  // 4. Puntaje
  scene.add.text(GAME_WIDTH - 14, 6, 'PUNTAJE', { ...labelStyle, color: '#ffffff' }).setOrigin(1, 0).setDepth(101);
  hudTexts.score = scene.add.text(GAME_WIDTH - 14, 18, '0', {
    fontFamily: 'monospace',
    fontSize: '19px',
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(1, 0).setDepth(101);
}

function drawCRTScanlines(scene) {
  const g = scene.add.graphics().setDepth(99);
  g.lineStyle(1, 0x000000, 0.28);
  // Comenzar scanlines a partir de y = 52 para que el HUD superior quede 100% nítido y legible
  for (let y = 52; y < GAME_HEIGHT; y += 4) {
    g.lineBetween(0, y, GAME_WIDTH, y);
  }
}

// --- BUCLE PRINCIPAL DE PHASER 3 ---
function update(time, delta) {
  const dt = delta / 1000;

  // Menú principal (iniciar con Espacio, Enter o clic)
  if (gameState === STATE_MENU) {
    if (justPressed.START1 || justPressed.RESET) {
      justPressed.START1 = false;
      justPressed.RESET = false;
      startFreshGame();
    }
    return;
  }

  // Pausa con P o Escape
  if (justPressed.P1_1) {
    justPressed.P1_1 = false;
    if (gameState === STATE_PLAYING) {
      gameState = STATE_PAUSED;
      centerMenuText.setText('PAUSA\n\nPresiona P para continuar').setVisible(true);
      return;
    } else if (gameState === STATE_PAUSED) {
      gameState = STATE_PLAYING;
      centerMenuText.setVisible(false);
      return;
    }
  }

  if (gameState === STATE_PAUSED) return;

  // Estado de Caída del Chamito al perder las vidas
  if (gameState === STATE_DYING) {
    // Descartar teclas durante la animación de caída para que no salte el Game Over
    justPressed.START1 = false;
    justPressed.RESET = false;
    justPressed.P1_U = false;

    chamito.deathVy += 26 * dt;
    chamito.y += chamito.deathVy;
    chamito.x += chamito.deathVx;
    chamito.sprite.setRotation(chamito.sprite.rotation + (chamito.deathVx > 0 ? 9 : -9) * dt);
    chamito.sprite.setPosition(chamito.x, chamito.y);

    if (chamito.y > GAME_HEIGHT + 60) {
      triggerGameOver();
    }
    return;
  }

  // Game Over: El juego se detiene aquí y espera a que el jugador vea su récord
  if (gameState === STATE_GAMEOVER) {
    // Si aún está en el cooldown obligatorio de 1.2 segundos, no aceptar teclas para evitar reinicio inmediato accidental
    if (gameOverCooldown > 0) {
      gameOverCooldown -= dt;
      justPressed.START1 = false;
      justPressed.RESET = false;
      justPressed.P1_U = false;
      return;
    }

    // Una vez pasado el cooldown, solo cuando el jugador presione Espacio o Enter se reinicia
    if (justPressed.START1 || justPressed.RESET) {
      justPressed.START1 = false;
      justPressed.RESET = false;
      startFreshGame();
    }
    return;
  }

  // Tecla R como reset opcional en plena partida
  if (justPressed.RESET) {
    justPressed.RESET = false;
    startFreshGame();
    return;
  }

  // --- JUEGO EN EJECUCIÓN ---
  handlePlayerInput(dt);
  updateWorldProgress(dt);
  renderDynamicBackground();
  renderMangoTrunks();
  updateAnts(dt);
  updateMangos(dt);
  updateFloatingTexts(dt);
  updateHUD();
}

function startFreshGame() {
  score = 0;
  mangosCount = 0;
  lives = 3;
  altitude = 0;
  superTimer = 0;
  invulTimer = 0;
  scrollSpeed = 0.5;

  ants.forEach((a) => {
    if (a && a.sprite) a.sprite.destroy();
  });
  mangos.forEach((m) => {
    if (m && m.sprite) m.sprite.destroy();
  });
  floatingTexts.forEach((t) => {
    if (t && t.textObj) t.textObj.destroy();
  });
  starShield.forEach((s) => {
    if (s) s.setVisible(false);
  });
  if (superAuraGraphics) superAuraGraphics.clear();
  ants = [];
  mangos = [];
  floatingTexts = [];

  // Reset del chamito en el piso firme del patio
  chamito.trunk = 1;
  chamito.side = 1;
  chamito.x = TRUNK_X[1] + OFFSET_X;
  chamito.targetX = chamito.x;
  chamito.y = 535;
  chamito.targetY = 470; // Sube al tronco al empezar
  chamito.isDying = false;
  chamito.deathVx = 0;
  chamito.deathVy = 0;
  chamito.climbAnimTimer = 0;
  chamito.climbFrame = 0;
  if (chamito.sprite) {
    chamito.sprite.setTexture('tex_chamito_climb1').setRotation(0).setAngle(0).setPosition(chamito.x, chamito.y).setAlpha(1);
    chamito.sprite.clearTint();
  }

  gameState = STATE_PLAYING;
  if (centerMenuText) centerMenuText.setVisible(false);
  if (sfx) sfx.startBGM();
  broadcastStats();
}

function handlePlayerInput(dt) {
  if (justPressed.P1_L) {
    justPressed.P1_L = false;
    moveChamitoLeft();
  }
  if (justPressed.P1_R) {
    justPressed.P1_R = false;
    moveChamitoRight();
  }

  // Trepar o deslizarse (W / ↑ y S / ↓)
  if (held.P1_U) {
    scrollSpeed = 2.4; // Trepar con ganas
    chamito.targetY = Math.max(160, chamito.targetY - 140 * dt);
  } else if (held.P1_D) {
    scrollSpeed = 0.1; // Deslizarse hacia el suelo
    chamito.targetY = Math.min(520, chamito.targetY + 150 * dt);
  } else {
    scrollSpeed = 0.6; // Desplazamiento suave al descansar
    chamito.targetY += (470 - chamito.targetY) * 0.08;
  }

  chamito.x += (chamito.targetX - chamito.x) * 0.35;
  chamito.y += (chamito.targetY - chamito.y) * 0.25;

  chamito.sprite.setFlipX(chamito.side === 1);
  chamito.sprite.setPosition(chamito.x, chamito.y);

  // Inclinación dinámica de trepador al saltar entre troncos
  const isJumping = Math.abs(chamito.targetX - chamito.x) > 4;
  if (isJumping) {
    const jumpDir = (chamito.targetX > chamito.x) ? 1 : -1;
    chamito.sprite.setAngle(jumpDir * 12);
  } else {
    chamito.sprite.setAngle(0);
  }

  // Animación de trepada activa alternando brazos y piernas (estilo Mono de Movilnet)
  let animRate = 3.2; // Ritmo constante con el avance de la mata
  if (held.P1_U) {
    animRate = 9.5; // Trepada ágil y vigorosa al pulsar arriba
  } else if (held.P1_D) {
    animRate = 5.0; // Deslizamiento
  } else if (isJumping) {
    animRate = 8.0; // Salto entre troncos
  }

  chamito.climbAnimTimer += dt * animRate;
  if (chamito.climbAnimTimer >= 1.0) {
    chamito.climbAnimTimer -= 1.0;
    chamito.climbFrame = (chamito.climbFrame === 0) ? 1 : 0;
    const currentFrameTex = (chamito.climbFrame === 0) ? 'tex_chamito_climb1' : 'tex_chamito_climb2';
    chamito.sprite.setTexture(currentFrameTex);
  }

  if (invulTimer > 0) {
    invulTimer -= dt;
    chamito.sprite.setAlpha(Math.floor(invulTimer * 12) % 2 === 0 ? 0.3 : 1.0);
  } else {
    chamito.sprite.setAlpha(1.0);
  }

  if (superTimer > 0) {
    superTimer -= dt;
    const t = 7.5 - superTimer;

    // 1. Resplandor Solar Dorado de Poder Criollo (Cero colores arcoíris tipo Mario Kart)
    const goldTints = [0xffffff, 0xffea00, 0xffd700, 0xffb300, 0xff9100, 0xffd700];
    const cIdx = Math.floor(t * 14) % goldTints.length;
    chamito.sprite.setTint(goldTints[cIdx]);

    // 2. Aura y Ondas de Choque Calientes de Budare (Efecto de calor y energía expansiva)
    if (superAuraGraphics) {
      superAuraGraphics.clear();

      // Ondas expansivas de calor de budare
      const wavePhase1 = (t * 4.2) % 1.0;
      const r1 = 18 + wavePhase1 * 26;
      const a1 = (1.0 - wavePhase1) * 0.75;
      superAuraGraphics.lineStyle(2.5, 0xffd54f, a1);
      superAuraGraphics.strokeCircle(chamito.x, chamito.y, r1);

      const wavePhase2 = ((t * 4.2) + 0.5) % 1.0;
      const r2 = 18 + wavePhase2 * 26;
      const a2 = (1.0 - wavePhase2) * 0.75;
      superAuraGraphics.lineStyle(1.8, 0xff9800, a2);
      superAuraGraphics.strokeCircle(chamito.x, chamito.y, r2);

      // Núcleo de calor brillante alrededor del Chamito
      const pulse = Math.sin(t * 12);
      const coreR = 24 + pulse * 2.5;
      superAuraGraphics.fillStyle(0xffea00, 0.24 + pulse * 0.08);
      superAuraGraphics.fillCircle(chamito.x, chamito.y, coreR);
      superAuraGraphics.fillStyle(0xff9800, 0.15);
      superAuraGraphics.fillCircle(chamito.x, chamito.y, coreR * 0.75);

      // Chispas de candela / maíz tostado flotando en espiral ascendente
      for (let k = 0; k < 6; k++) {
        const sparkAngle = t * 6.5 + (k * Math.PI / 3);
        const sparkDist = 18 + ((k * 8 + t * 24) % 16);
        const sx = chamito.x + Math.cos(sparkAngle) * sparkDist;
        const sy = chamito.y + Math.sin(sparkAngle) * (sparkDist * 0.8) - 4;
        superAuraGraphics.fillStyle(k % 2 === 0 ? 0xffffff : 0xffd54f, 0.85);
        superAuraGraphics.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
    }

    // 3. Mini Arepitas Doradas Tostadas en órbita 3D alrededor del Chamito
    const arepaAngle = t * 6.5;
    const orbitRadiusX = 32;
    const orbitRadiusY = 22;
    starShield.forEach((arepa, idx) => {
      if (arepa) {
        arepa.setVisible(true);
        const a = arepaAngle + (idx * ((Math.PI * 2) / 3));
        arepa.setPosition(chamito.x + Math.cos(a) * orbitRadiusX, chamito.y + Math.sin(a) * orbitRadiusY);
        arepa.setRotation(arepaAngle * 2.0);
        // Profundidad 3D: oculta tras el chamito cuando órbita por detrás, visible encima cuando pasa al frente
        arepa.setDepth(Math.sin(a) > 0 ? 25 : 18);
      }
    });
  } else {
    chamito.sprite.clearTint();
    starShield.forEach((star) => { if (star) star.setVisible(false); });
    if (superAuraGraphics) superAuraGraphics.clear();
  }
}

function moveChamitoLeft() {
  if (chamito.side === 1) {
    chamito.side = -1;
    sfx.jump();
  } else if (chamito.trunk > 0) {
    chamito.trunk--;
    chamito.side = 1;
    sfx.jump();
  }
  chamito.targetX = TRUNK_X[chamito.trunk] + chamito.side * OFFSET_X;
}

function moveChamitoRight() {
  if (chamito.side === -1) {
    chamito.side = 1;
    sfx.jump();
  } else if (chamito.trunk < NUM_TRUNKS - 1) {
    chamito.trunk++;
    chamito.side = -1;
    sfx.jump();
  }
  chamito.targetX = TRUNK_X[chamito.trunk] + chamito.side * OFFSET_X;
}

function updateWorldProgress(dt) {
  // Progresión continua de altitud y fondo:
  // Avanza de forma fluida y visible aún cuando el jugador se detiene (poco a poco), y se acelera con fuerza al trepar arriba
  const heightBonus = 1.0 + Math.max(0, (480 - chamito.y) / 220) * 1.3;
  const climbEffort = held.P1_U ? 3.4 : (held.P1_D ? 0.35 : 1.25);
  const effectiveClimb = climbEffort * heightBonus;

  altitude += effectiveClimb * dt * 2.2; // Avance constante continuo (en reposo sube a ~2.8 m/s, trepando arriba a ~19 m/s)
  score += Math.round(effectiveClimb * dt * 3.8);

  if (altitude > bestAltitude) {
    bestAltitude = Math.floor(altitude);
  }

  // Spawn de Oleadas de Enemigos por los 8 carriles (variando entre 1, 2, 4, 6 y 8)
  antSpawnTimer += dt;
  const isSpace = altitude >= 850;
  // Intervalo dinámico de oleadas: entre 1.05s y 1.70s para mantener la pantalla llena y variada
  const waveInterval = isSpace
    ? Math.max(0.95, 1.55 - (altitude - 850) * 0.0004)
    : Math.max(1.05, 1.75 - altitude * 0.0008);
  if (antSpawnTimer > waveInterval) {
    antSpawnTimer = 0;
    spawnAnt();
  }

  // Spawn Mangos y Arepas
  mangoSpawnTimer += dt;
  if (mangoSpawnTimer > 1.9) {
    mangoSpawnTimer = 0;
    spawnMango();
  }
}

// Helper de interpolación de color RGB suave
function lerpColor(c1, c2, t) {
  t = Math.max(0, Math.min(1, t));
  const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
  const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

// --- RENDER DEL FONDO DINÁMICO CONTINUO (BARRIO -> CIUDAD -> EL ÁVILA -> NUBES Y AVIONES -> TIERRA -> ESPACIO -> AGUJERO NEGRO) ---
function renderDynamicBackground() {
  if (!bgGraphics) return;
  bgGraphics.clear();

  const alt = altitude;
  const timeSec = (currentScene && currentScene.time) ? (currentScene.time.now * 0.001) : 0;

  // 1. GRADIENTE DE CIELO CONTINUO (Día -> Atardecer caraqueño -> Alta atmósfera -> Espacio)
  let skyTop, skyBot;
  if (alt < 450) {
    // Día diurno caraqueño despejado
    skyTop = 0x1976d2;
    skyBot = 0x64b5f6;
  } else if (alt < 1050) {
    // Atardecer cálido caraqueño sobre El Ávila
    const t = (alt - 450) / 600;
    skyTop = lerpColor(0x1976d2, 0x0d2244, t);
    skyBot = lerpColor(0x64b5f6, 0xf57c00, t);
  } else if (alt < 1850) {
    // Alta atmósfera / Estratósfera
    const t = (alt - 1050) / 800;
    skyTop = lerpColor(0x0d2244, 0x000000, t);
    skyBot = lerpColor(0xf57c00, 0x08152e, t);
  } else if (alt < 2700) {
    // Espacio profundo con sutil nebulosa violeta
    const t = (alt - 1850) / 850;
    skyTop = 0x000000;
    skyBot = lerpColor(0x08152e, 0x140528, t);
  } else {
    // Espacio negro infinito final
    skyTop = 0x000000;
    skyBot = 0x000000;
  }

  bgGraphics.fillGradientStyle(skyTop, skyTop, skyBot, skyBot, 1);
  bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // 2. MONTAÑA EL ÁVILA (VISIBLE DESDE EL INICIO 0m, SE DESVANECE AL LLEGAR A LAS NUBES Y NUNCA LLEGA AL ESPACIO)
  const avilaY = 250 + (alt * 0.95);
  if (alt < 600 && avilaY < GAME_HEIGHT + 50) {
    const avilaAlpha = alt > 420 ? Math.max(0, 1 - (alt - 420) / 180) : 1.0;
    // Silueta majestuosa de El Ávila
    bgGraphics.fillStyle(0x0e3d1c, 0.95 * avilaAlpha);
    bgGraphics.beginPath();
    bgGraphics.moveTo(0, avilaY + 95);
    bgGraphics.lineTo(105, avilaY - 35);
    bgGraphics.lineTo(235, avilaY + 15);
    bgGraphics.lineTo(355, avilaY - 75); // Pico Naiguatá / Hotel Humboldt
    bgGraphics.lineTo(480, avilaY - 15);
    bgGraphics.lineTo(480, GAME_HEIGHT);
    bgGraphics.lineTo(0, GAME_HEIGHT);
    bgGraphics.closePath();
    bgGraphics.fillPath();

    // Antena del Teleférico / Humboldt en la cima
    bgGraphics.lineStyle(1.6, 0xffffff, 0.85 * avilaAlpha);
    bgGraphics.lineBetween(355, avilaY - 75, 355, avilaY - 96);
    bgGraphics.fillStyle(0xff1744, avilaAlpha);
    bgGraphics.fillCircle(355, avilaY - 97, 2); // Baliza roja de la antena
  }

  // 3. CIUDAD DE CARACAS (METRÓPOLIS MONUMENTAL: PARQUE CENTRAL, LA PREVISORA, CRISTAL Y AUTOPISTA)
  const cityY = 330 + (alt * 1.25);
  if (alt < 480 && cityY < GAME_HEIGHT + 240 && cityY > -220) {
    // A. Resplandor nocturno y cálido de la metrópolis en el valle
    bgGraphics.fillStyle(0xff7043, 0.22);
    bgGraphics.fillEllipse(240, cityY + 45, GAME_WIDTH * 1.25, 170);
    bgGraphics.fillStyle(0xffb300, 0.14);
    bgGraphics.fillEllipse(240, cityY + 15, GAME_WIDTH * 0.9, 110);

    // B. Siluetas de Rascacielos Lejanos (Capa de Profundidad 1 - Azul Noche)
    const farTowers = [
      { x: 0, w: 32, h: 90 }, { x: 32, w: 24, h: 70 }, { x: 56, w: 34, h: 120 },
      { x: 135, w: 42, h: 95 }, { x: 177, w: 28, h: 80 }, { x: 220, w: 36, h: 105 },
      { x: 305, w: 32, h: 85 }, { x: 337, w: 48, h: 125 }, { x: 425, w: 55, h: 95 }
    ];
    bgGraphics.fillStyle(0x111c2a, 0.9);
    farTowers.forEach((t) => {
      bgGraphics.fillRect(t.x, cityY - t.h + 80, t.w, t.h);
      // Luces lejanas de advertencia aeronáutica en la cúspide
      bgGraphics.fillStyle(0xff1744, 0.85);
      bgGraphics.fillCircle(t.x + t.w / 2, cityY - t.h + 78, 1.4);
      bgGraphics.fillStyle(0x111c2a, 0.9);
    });

    // C. Rascacielos Principales y Monumentos Icónicos de Caracas (Capa de Profundidad 2)

    // 1. TORRES GEMELAS DE PARQUE CENTRAL (Torre Este en x: 82 y Torre Oeste en x: 258)
    const twinTowersX = [82, 258];
    twinTowersX.forEach((tx) => {
      const th = 215;
      const tw = 48;
      const topY = cityY - th + 80;

      // Estructura octogonal de concreto armado
      bgGraphics.fillStyle(0x1e2d42, 1);
      bgGraphics.fillRect(tx, topY, tw, th);

      // Pilares estructurales verticales (columnas exteriores icónicas)
      bgGraphics.fillStyle(0x2d3e56, 1);
      bgGraphics.fillRect(tx + 4, topY, 8, th);
      bgGraphics.fillRect(tx + tw - 12, topY, 8, th);
      bgGraphics.fillStyle(0x415a77, 1);
      bgGraphics.fillRect(tx + 18, topY, tw - 36, th);

      // Antena de telecomunicaciones en la cima
      bgGraphics.lineStyle(1.8, 0xffffff, 0.95);
      bgGraphics.lineBetween(tx + tw / 2, topY, tx + tw / 2, topY - 32);
      bgGraphics.lineStyle(1.2, 0xff1744, 1);
      bgGraphics.lineBetween(tx + tw / 2 - 4, topY - 14, tx + tw / 2 + 4, topY - 14);
      // Luz roja estroboscópica en la punta de la antena
      bgGraphics.fillStyle(0xff1744, 1);
      bgGraphics.fillCircle(tx + tw / 2, topY - 33, (Math.floor(timeSec * 3) % 2 === 0 ? 2.5 : 1.5));

      // Ventanas iluminadas de oficinas activas (matriz densa realista)
      for (let wy = topY + 12; wy < cityY + 70; wy += 9) {
        for (let wx = tx + 5; wx < tx + tw - 6; wx += 6) {
          const rand = Math.sin(wx * 17.3 + wy * 31.7);
          if (rand > 0.1) {
            bgGraphics.fillStyle(rand > 0.65 ? 0xffea00 : (rand > 0.35 ? 0x80d8ff : 0xffffff), 0.85);
            bgGraphics.fillRect(wx, wy, 3.5, 4.5);
          }
        }
      }
    });

    // 2. TORRE LA PREVISORA (Con su célebre reloj gigante iluminado en la cúspide)
    const prevX = 178, prevW = 42, prevH = 175;
    const prevTopY = cityY - prevH + 80;
    // Cuerpo del edificio
    bgGraphics.fillStyle(0x2b3543, 1);
    bgGraphics.fillRect(prevX, prevTopY + 22, prevW, prevH - 22);
    // Cúpula piramidal de La Previsora
    bgGraphics.fillStyle(0x1f2732, 1);
    bgGraphics.fillTriangle(prevX, prevTopY + 22, prevX + prevW, prevTopY + 22, prevX + prevW / 2, prevTopY);

    // EL GRAN RELOJ DE LA PREVISORA (Símbolo lumínico de Caracas)
    bgGraphics.fillStyle(0xffd700, 1);
    bgGraphics.fillCircle(prevX + prevW / 2, prevTopY + 14, 8);
    bgGraphics.fillStyle(0xfff59d, 1);
    bgGraphics.fillCircle(prevX + prevW / 2, prevTopY + 14, 6.5);
    // Agujas del reloj
    bgGraphics.lineStyle(1.4, 0x000000, 1);
    bgGraphics.lineBetween(prevX + prevW / 2, prevTopY + 14, prevX + prevW / 2, prevTopY + 9);
    bgGraphics.lineBetween(prevX + prevW / 2, prevTopY + 14, prevX + prevW / 2 + 4, prevTopY + 14);

    // Ventanas de La Previsora
    for (let wy = prevTopY + 28; wy < cityY + 70; wy += 10) {
      for (let wx = prevX + 6; wx < prevX + prevW - 6; wx += 7) {
        if (Math.sin(wx * 23.1 + wy * 19.3) > 0.15) {
          bgGraphics.fillStyle(0xffe082, 0.8);
          bgGraphics.fillRect(wx, wy, 4, 5);
        }
      }
    }

    // 3. TORRES FINANCIERAS DE CRISTAL (Fachadas de vidrio reflectante cian y helipuerto)
    const glassTowers = [
      { x: 22, w: 46, h: 145, color: 0x006064 },
      { x: 335, w: 44, h: 185, color: 0x004d40 },
      { x: 405, w: 56, h: 155, color: 0x1a237e },
    ];
    glassTowers.forEach((gt) => {
      const gTopY = cityY - gt.h + 80;
      // Fachada vidriada
      bgGraphics.fillStyle(gt.color, 1);
      bgGraphics.fillRect(gt.x, gTopY, gt.w, gt.h);

      // Líneas de muro cortina de vidrio reflectante en cian neón
      bgGraphics.lineStyle(1, 0x00e5ff, 0.45);
      for (let vx = gt.x + 6; vx < gt.x + gt.w; vx += 7) {
        bgGraphics.lineBetween(vx, gTopY, vx, cityY + 70);
      }
      for (let hy = gTopY + 8; hy < cityY + 70; hy += 12) {
        bgGraphics.lineBetween(gt.x, hy, gt.x + gt.w, hy);
      }

      // Helipuerto en la azotea de la torre 335
      if (gt.x === 335) {
        bgGraphics.fillStyle(0x37474f, 1);
        bgGraphics.fillRect(gt.x + 6, gTopY - 6, gt.w - 12, 6);
        // Letra H iluminada
        bgGraphics.lineStyle(1.4, 0xffea00, 0.9);
        bgGraphics.strokeCircle(gt.x + gt.w / 2, gTopY - 3, 5);
      }
    });

    // 4. LETRERO DE NEÓN URBANO "CARACAS" Y PANTALLA GIGANTE
    const signX = 345, signY = cityY - 185 + 68;
    const neonColor = (Math.floor(timeSec * 2) % 2 === 0) ? 0x00e5ff : 0xf50057;
    bgGraphics.lineStyle(2, neonColor, 0.95);
    bgGraphics.strokeRect(signX, signY, 26, 12);
    bgGraphics.fillStyle(neonColor, 0.85);
    bgGraphics.fillRect(signX + 3, signY + 3, 20, 6);

    // 5. AUTOPISTA FRANCISCO FAJARDO Y TRÁFICO URBANO DINÁMICO (RÍOS DE LUZ)
    const hwyY = cityY + 70;
    // Viaducto de concreto elevado
    bgGraphics.fillStyle(0x1a242f, 1);
    bgGraphics.fillRect(0, hwyY, GAME_WIDTH, 14);
    bgGraphics.lineStyle(1.5, 0x455a64, 0.8);
    bgGraphics.lineBetween(0, hwyY, GAME_WIDTH, hwyY);
    bgGraphics.lineBetween(0, hwyY + 14, GAME_WIDTH, hwyY + 14);

    // Postes de alumbrado con vapor de sodio dorado
    bgGraphics.fillStyle(0xffb300, 0.8);
    for (let lx = 15; lx < GAME_WIDTH; lx += 45) {
      bgGraphics.lineStyle(1, 0x78909c, 0.6);
      bgGraphics.lineBetween(lx, hwyY - 8, lx, hwyY);
      bgGraphics.fillCircle(lx, hwyY - 8, 2);
    }

    // VEHÍCULOS EN MOVIMIENTO REAL (FAROS BLANCOS/ORO HACIA EL ESTE, LUCES ROJAS HACIA EL OESTE)
    // Carril 1: Hacia el este (faros dorados/blancos rápidos)
    bgGraphics.fillStyle(0xfff59d, 1);
    for (let i = 0; i < 9; i++) {
      const cx = ((timeSec * 115 + i * 58) % (GAME_WIDTH + 50)) - 25;
      bgGraphics.fillRect(cx, hwyY + 3, 7, 2.5);
      // Haz de luz frontal
      bgGraphics.fillStyle(0xffffff, 0.4);
      bgGraphics.fillRect(cx + 7, hwyY + 3.5, 12, 1.5);
      bgGraphics.fillStyle(0xfff59d, 1);
    }

    // Carril 2: Hacia el oeste (luces traseras rojas continuas)
    bgGraphics.fillStyle(0xff1744, 1);
    for (let i = 0; i < 9; i++) {
      const cx = GAME_WIDTH - (((timeSec * 105 + i * 54) % (GAME_WIDTH + 50)) - 25);
      bgGraphics.fillRect(cx, hwyY + 8, 6, 2.5);
      // Haz de estela roja
      bgGraphics.fillStyle(0xd50000, 0.4);
      bgGraphics.fillRect(cx + 6, hwyY + 8.5, 10, 1.5);
      bgGraphics.fillStyle(0xff1744, 1);
    }
  }

  // 4. BARRIO CARAQUEÑO Y PATIO FIRME (PRIMER PLANO TERRESTRE)
  const barrioY = 320 + (alt * 1.5);
  const groundY = 570 + (alt * 1.5);

  if (groundY < GAME_HEIGHT + 100) {
    // Piso de baldosas de patio
    bgGraphics.fillStyle(0x546e7a, 1);
    bgGraphics.fillRect(0, groundY, GAME_WIDTH, GAME_HEIGHT - groundY);
    bgGraphics.fillStyle(0x388e3c, 1);
    bgGraphics.fillRect(0, groundY - 6, GAME_WIDTH, 8);

    // Raíces gruesas de la mata de mango
    bgGraphics.fillStyle(0x3e2723, 1);
    TRUNK_X.forEach((tx) => {
      bgGraphics.fillTriangle(tx - 20, groundY + 12, tx, groundY - 14, tx + 20, groundY + 12);
    });
  }

  if (alt < 260 && barrioY < GAME_HEIGHT + 250 && barrioY > -250) {
    // Casa izquierda de ladrillos rojos
    bgGraphics.fillStyle(0xb73a1e, 1);
    bgGraphics.fillRect(10, barrioY, 150, 240);
    bgGraphics.lineStyle(1.2, 0x8d6e63, 0.7);
    for (let ly = barrioY + 16; ly < barrioY + 240; ly += 18) {
      bgGraphics.lineBetween(10, ly, 160, ly);
    }
    // Techo de zinc
    bgGraphics.fillStyle(0x90a4ae, 1);
    bgGraphics.fillRect(5, barrioY - 10, 165, 14);
    bgGraphics.fillStyle(0x78909c, 1);
    for (let zx = 10; zx < 165; zx += 12) {
      bgGraphics.fillRect(zx, barrioY - 10, 5, 14);
    }
    // Tanque azul
    bgGraphics.fillStyle(0x0277bd, 1);
    bgGraphics.fillRoundedRect(35, barrioY - 42, 38, 32, 4);
    bgGraphics.fillStyle(0x01579b, 1);
    bgGraphics.fillRect(32, barrioY - 45, 44, 6);

    // Casa derecha con platabanda
    bgGraphics.fillStyle(0xc0392b, 1);
    bgGraphics.fillRect(320, barrioY + 25, 150, 230);
    bgGraphics.lineStyle(1.2, 0x8d6e63, 0.7);
    for (let ly = barrioY + 40; ly < barrioY + 250; ly += 18) {
      bgGraphics.lineBetween(320, ly, 470, ly);
    }
    bgGraphics.fillStyle(0x90a4ae, 1);
    bgGraphics.fillRect(315, barrioY + 15, 160, 14);
    bgGraphics.fillStyle(0x0277bd, 1);
    bgGraphics.fillRoundedRect(350, barrioY - 17, 38, 32, 4);
    bgGraphics.fillStyle(0x01579b, 1);
    bgGraphics.fillRect(347, barrioY - 20, 44, 6);

    // Doña en la ventana con rulos
    bgGraphics.fillStyle(0x212121, 1);
    bgGraphics.fillRect(45, barrioY + 45, 38, 42);
    bgGraphics.lineStyle(1.6, 0xffffff, 0.8);
    bgGraphics.lineBetween(54, barrioY + 45, 54, barrioY + 87);
    bgGraphics.lineBetween(64, barrioY + 45, 64, barrioY + 87);
    bgGraphics.lineBetween(74, barrioY + 45, 74, barrioY + 87);
    bgGraphics.fillStyle(0xd7a17c, 1);
    bgGraphics.fillCircle(64, barrioY + 63, 8);
    bgGraphics.fillStyle(0xf06292, 1);
    bgGraphics.fillCircle(58, barrioY + 56, 3.5);
    bgGraphics.fillCircle(64, barrioY + 54, 3.5);
    bgGraphics.fillCircle(70, barrioY + 56, 3.5);
    bgGraphics.fillStyle(0xffd54f, 1);
    bgGraphics.fillRect(56, barrioY + 71, 16, 16);

    // Cables de luz y tendedero tricolor
    bgGraphics.lineStyle(1.4, 0x212121, 0.7);
    bgGraphics.lineBetween(0, barrioY + 15, GAME_WIDTH, barrioY + 55);
    bgGraphics.lineStyle(1, 0xffffff, 0.6);
    bgGraphics.lineBetween(170, barrioY + 75, 310, barrioY + 90);
    bgGraphics.fillStyle(0xffd600, 1); bgGraphics.fillRect(200, barrioY + 79, 14, 16);
    bgGraphics.fillStyle(0x1565c0, 1); bgGraphics.fillRect(230, barrioY + 83, 14, 16);
    bgGraphics.fillStyle(0xd32f2f, 1); bgGraphics.fillRect(260, barrioY + 87, 14, 16);
  }

  // 5. NUBES Y AVIONES PASANDO EN EL FONDO (420m a 1100m, descienden con paralaje suave)
  if (alt >= 420 && alt <= 1100) {
    const cloudY = 160 + ((alt - 420) * 0.85);
    if (cloudY < GAME_HEIGHT + 140) {
      bgGraphics.fillStyle(0xffffff, 0.45);
      // Grupo de nubes 1
      bgGraphics.fillCircle(70, cloudY + 80, 45);
      bgGraphics.fillCircle(120, cloudY + 70, 58);
      bgGraphics.fillCircle(170, cloudY + 85, 42);
      // Grupo de nubes 2
      bgGraphics.fillCircle(330, cloudY - 60, 48);
      bgGraphics.fillCircle(380, cloudY - 70, 62);
      bgGraphics.fillCircle(430, cloudY - 55, 45);

      // AVIONES PASANDO EN EL FONDO DE LAS NUBES
      if (alt >= 500 && alt <= 1000) {
        const planeX = ((timeSec * 75) % (GAME_WIDTH + 140)) - 70;
        const planeY = cloudY + 20;

        // Estela de vapor del avión
        bgGraphics.lineStyle(2, 0xffffff, 0.45);
        bgGraphics.lineBetween(planeX - 45, planeY, planeX - 10, planeY);

        // Fuselaje del avión
        bgGraphics.fillStyle(0xffffff, 0.95);
        bgGraphics.fillRoundedRect(planeX - 12, planeY - 3, 28, 6, 2);
        // Alas
        bgGraphics.fillTriangle(planeX - 2, planeY - 14, planeX + 8, planeY - 3, planeX - 2, planeY - 3);
        bgGraphics.fillTriangle(planeX - 2, planeY + 14, planeX + 8, planeY + 3, planeX - 2, planeY + 3);
        // Cola tricolor venezolana
        bgGraphics.fillStyle(0xffd600, 1); bgGraphics.fillRect(planeX - 11, planeY - 7, 3, 2);
        bgGraphics.fillStyle(0x1565c0, 1); bgGraphics.fillRect(planeX - 11, planeY - 5, 3, 2);
        bgGraphics.fillStyle(0xd32f2f, 1); bgGraphics.fillRect(planeX - 11, planeY - 3, 3, 2);

        // Luz roja intermitente en el ala
        if (Math.floor(timeSec * 4) % 2 === 0) {
          bgGraphics.fillStyle(0xff1744, 1);
          bgGraphics.fillCircle(planeX - 2, planeY - 14, 2);
        }
      }
    }
  }

  // 6. ESPACIO CON ESTRELLAS, SATÉLITE Y PLANETA TIERRA (MUNDO) ABAJO (1050m+)
  if (alt >= 1050) {
    // Estrellas titilantes en el espacio
    const starCount = Math.min(65, 25 + Math.floor((alt - 1050) * 0.03));
    bgGraphics.fillStyle(0xffffff, 0.95);
    for (let i = 0; i < starCount; i++) {
      const sx = ((i * 73) % GAME_WIDTH);
      const sy = (((i * 97) + alt * 0.2) % GAME_HEIGHT);
      const twinkle = (Math.floor(timeSec * 3 + i) % 3 === 0) ? 2.5 : 1.2;
      bgGraphics.fillCircle(sx, sy, twinkle);
    }

    // CURVATURA DEL PLANETA TIERRA (EL MUNDO) ABAJO (1200m a 2400m - Sin montaña, solo la Tierra en el espacio)
    if (alt >= 1200 && alt <= 2400) {
      const earthY = 620 + ((alt - 1200) * 0.35);
      if (earthY > 160 && earthY < GAME_HEIGHT + 450) {
        // Brillo atmosférico azul
        bgGraphics.lineStyle(6, 0x00e5ff, 0.5);
        bgGraphics.strokeCircle(240, earthY + 360, 400);

        // Océanos azules de la Tierra
        bgGraphics.fillStyle(0x1565c0, 0.9);
        bgGraphics.fillCircle(240, earthY + 360, 396);

        // Continentes verdes (Suramérica / Venezuela)
        bgGraphics.fillStyle(0x2e7d32, 0.85);
        bgGraphics.fillEllipse(220, earthY - 10, 85, 45);
        bgGraphics.fillEllipse(280, earthY + 15, 65, 35);

        // Remolinos de nubes blancas en la Tierra
        bgGraphics.fillStyle(0xffffff, 0.4);
        bgGraphics.fillEllipse(180, earthY - 20, 60, 15);
        bgGraphics.fillEllipse(260, earthY + 5, 80, 18);
      }
    }

    // SATÉLITE SIMÓN BOLÍVAR ORBITANDO
    if (alt >= 1100 && alt <= 2000) {
      const satY = ((alt * 0.3) % 460) + 80;
      bgGraphics.fillStyle(0xffd700, 1);
      bgGraphics.fillRect(360, satY, 22, 16);
      bgGraphics.fillStyle(0x0288d1, 1);
      bgGraphics.fillRect(328, satY + 4, 28, 8);
      bgGraphics.fillRect(386, satY + 4, 28, 8);
      bgGraphics.lineStyle(1.5, 0xffffff, 1);
      bgGraphics.lineBetween(371, satY, 371, satY - 8);
      bgGraphics.strokeCircle(371, satY - 10, 4);
    }
  }

  // 7. OTROS MUNDOS Y PLANETAS LEJANOS (1800m a 2900m)
  if (alt >= 1800 && alt <= 3000) {
    const planetY = 240 + ((alt - 2200) * 0.25);

    // Planeta extraterrestre anillado (tipo Saturno cósmico)
    if (planetY > -100 && planetY < GAME_HEIGHT + 100) {
      bgGraphics.fillStyle(0x7b1fa2, 0.9);
      bgGraphics.fillCircle(90, planetY, 28);
      bgGraphics.fillStyle(0xba68c8, 0.85);
      bgGraphics.fillCircle(85, planetY - 4, 18);
      // Anillos holográficos inclinados
      bgGraphics.lineStyle(3, 0x00e5ff, 0.85);
      bgGraphics.strokeEllipse(90, planetY, 78, 18);
      bgGraphics.lineStyle(1.5, 0xffd54f, 0.7);
      bgGraphics.strokeEllipse(90, planetY, 90, 22);
    }

    // Luna alienígena carmesí lejana
    const moonY = 330 + ((alt - 2400) * 0.28);
    if (moonY > -80 && moonY < GAME_HEIGHT + 80) {
      bgGraphics.fillStyle(0xc62828, 0.9);
      bgGraphics.fillCircle(400, moonY, 18);
      bgGraphics.fillStyle(0x8e0000, 0.8);
      bgGraphics.fillCircle(396, moonY - 3, 5);
      bgGraphics.fillCircle(405, moonY + 4, 4);
    }
  }

  // 8. AGUJERO NEGRO GIRATORIO Y ESPACIO FINAL (2500m+)
  if (alt >= 2500) {
    // Nebulosa violeta y cian
    bgGraphics.fillStyle(0x8e24aa, 0.25);
    bgGraphics.fillCircle(140, 260, 130);
    bgGraphics.fillStyle(0x00bcd4, 0.2);
    bgGraphics.fillCircle(340, 360, 110);

    const holeY = 190 + ((alt - 3000) * 0.12);
    if (holeY > -100 && holeY < GAME_HEIGHT + 100) {
      // Disco de acreción giratorio con fuego cósmico
      bgGraphics.lineStyle(5, 0xff6d00, 0.85);
      bgGraphics.strokeEllipse(240, holeY, 82, 26);
      bgGraphics.lineStyle(2.5, 0xffeb3b, 0.95);
      bgGraphics.strokeEllipse(240, holeY, 94, 30);
      bgGraphics.lineStyle(1.5, 0xffffff, 0.75);
      bgGraphics.strokeEllipse(240, holeY, 104, 34);

      // Horizonte de sucesos negro absoluto
      bgGraphics.fillStyle(0x000000, 1);
      bgGraphics.fillCircle(240, holeY, 24);
    }
  }
}

// --- RENDER DE LOS 4 TRONCOS DE LA MATA DE MANGO ---
function renderMangoTrunks() {
  if (!treeGraphics) return;
  treeGraphics.clear();

  const trunkWidth = 28; // Ancho generoso: las hormigas (18px) caben 100% encima
  const segmentHeight = 80;
  const scrollOffset = (altitude * 2.5) % segmentHeight;

  // Si el piso está en pantalla al inicio, los troncos nacen del piso
  const groundY = 570 + (altitude * 1.5);
  const startTrunkY = groundY < GAME_HEIGHT ? groundY : GAME_HEIGHT;

  TRUNK_X.forEach((tx) => {
    // Sombra del tronco
    treeGraphics.fillStyle(0x020a04, 0.45);
    treeGraphics.fillRect(tx - trunkWidth / 2 + 5, 0, trunkWidth, startTrunkY);

    // Madera de mango cálida
    treeGraphics.fillStyle(0x4e3629, 1);
    treeGraphics.fillRect(tx - trunkWidth / 2, 0, trunkWidth, startTrunkY);

    // Vetas de madera
    treeGraphics.fillStyle(0x6d4c41, 1);
    treeGraphics.fillRect(tx - trunkWidth / 2 + 4, 0, 10, startTrunkY);
    treeGraphics.fillStyle(0x8d6e63, 0.85);
    treeGraphics.fillRect(tx - trunkWidth / 2 + 7, 0, 3, startTrunkY);

    // Nudos de la corteza
    treeGraphics.fillStyle(0x3e2723, 1);
    treeGraphics.lineStyle(2, 0x8d6e63, 0.8);
    for (let y = -segmentHeight; y < startTrunkY; y += segmentHeight) {
      const nodeY = y + scrollOffset;
      if (nodeY < startTrunkY) {
        treeGraphics.fillEllipse(tx, nodeY, trunkWidth + 4, 6);
        treeGraphics.strokeEllipse(tx, nodeY, trunkWidth + 4, 6);
      }
    }

    // Hojitas verdes de mango a los lados
    treeGraphics.fillStyle(0x2e7d32, 0.9);
    for (let y = -segmentHeight * 1.5; y < startTrunkY; y += 140) {
      const leafY = y + scrollOffset;
      if (leafY < startTrunkY - 20) {
        treeGraphics.fillTriangle(tx + 14, leafY, tx + 28, leafY - 5, tx + 23, leafY + 5);
        treeGraphics.fillTriangle(tx - 14, leafY + 50, tx - 28, leafY + 45, tx - 23, leafY + 55);
      }
    }
  });
}

function spawnAnt() {
  if (!currentScene) return;
  const isSpaceShip = altitude >= 850;

  // 8 Carriles posibles (4 matas de mango × 2 lados cada una: izquierda y derecha)
  const allLanes = [
    { tIdx: 0, side: -1 }, { tIdx: 0, side: 1 },
    { tIdx: 1, side: -1 }, { tIdx: 1, side: 1 },
    { tIdx: 2, side: -1 }, { tIdx: 2, side: 1 },
    { tIdx: 3, side: -1 }, { tIdx: 3, side: 1 },
  ];

  // Variación dinámica de oleadas: pueden bajar 1, 2, 4, 6 o hasta 7-8 enemigos por ráfagas
  let count = 2;
  const r = Math.random();
  if (altitude < 80) {
    count = r < 0.4 ? 1 : (r < 0.85 ? 2 : 3);
  } else if (altitude < 300) {
    if (r < 0.25) count = 1 + Math.floor(Math.random() * 2); // 1 o 2 (respiro)
    else if (r < 0.70) count = 3 + Math.floor(Math.random() * 2); // 3 o 4
    else count = 5 + Math.floor(Math.random() * 2); // 5 o 6 (enjambre)
  } else {
    // A alturas mayores: oleadas dinámicas con momentos de gran enjambre
    if (r < 0.18) count = 1 + Math.floor(Math.random() * 2); // 1 o 2 (respiro)
    else if (r < 0.55) count = 3 + Math.floor(Math.random() * 2); // 3 o 4 (estándar)
    else if (r < 0.88) count = 5 + Math.floor(Math.random() * 2); // 5 o 6 (enjambre bravo)
    else count = 7; // 7 carriles ocupados, dejando 1 vía libre de escape
  }

  // Mezclar los 8 carriles al azar
  for (let i = allLanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allLanes[i], allLanes[j]] = [allLanes[j], allLanes[i]];
  }
  const selectedLanes = allLanes.slice(0, count);

  // La velocidad base escala fuertemente según la altitud recorrida (¡mientras más arriba, más rápido bajan!)
  // Y es constante y autónoma: ¡NUNCA se pone lenta cuando el jugador para de trepar!
  const baseSpeed = 135 + Math.min(320, altitude * 0.22);

  selectedLanes.forEach((lane, idx) => {
    const { tIdx, side } = lane;
    const rType = Math.random();

    let speed = baseSpeed;
    let tex1, tex2;
    let isGiant = false;

    if (!isSpaceShip) {
      if (rType < 0.38) {
        tex1 = 'tex_ant_red_1';
        tex2 = 'tex_ant_red_2';
      } else if (rType < 0.65) {
        tex1 = 'tex_ant_black_1';
        tex2 = 'tex_ant_black_2';
        speed *= 1.2;
      } else if (rType < 0.85) {
        tex1 = 'tex_ant_fire_1';
        tex2 = 'tex_ant_fire_2';
        speed *= 1.4;
      } else {
        // Hormiga grande / Bachaco bravo en perfil de lado
        tex1 = 'tex_ant_giant_1';
        tex2 = 'tex_ant_giant_2';
        speed *= 1.1;
        isGiant = true;
      }
    } else {
      if (rType < 0.45) {
        tex1 = 'tex_ufo_scout';
        speed *= 1.35;
      } else if (rType < 0.75) {
        tex1 = 'tex_ufo_fighter';
        speed *= 1.6;
      } else {
        tex1 = 'tex_ufo_cruiser';
        speed *= 1.25;
        isGiant = true;
      }
      tex2 = null;
    }

    // Variación sutil de velocidad individual
    speed *= (0.94 + Math.random() * 0.14);

    const enemyX = TRUNK_X[tIdx] + side * (isSpaceShip ? 8 : (isGiant ? 7 : 6));
    // Escalonamiento vertical inteligente: crea cascadas zigzagueantes para que el jugador pueda maniobrar
    const staggerY = (idx * 26) + Math.floor(Math.random() * 20);
    const spawnY = -32 - staggerY;
    const sprite = currentScene.add.sprite(enemyX, spawnY, tex1).setDepth(15);
    sprite.setFlipX(side === 1);
    ants.push({ tIdx, side, speed, isSpaceShip, isGiant, tex1, tex2, animTimer: Math.random(), animFrame: 0, sprite });
  });
}

function spawnMango() {
  if (!currentScene) return;
  const tIdx = Math.floor(Math.random() * NUM_TRUNKS);
  const side = Math.random() < 0.5 ? -1 : 1;
  // 12% de probabilidad de que aparezca una rica AREPA DORADA si no tiene el poder activo
  const isArepa = Math.random() < 0.12 && superTimer <= 0;
  const tex = isArepa ? 'tex_arepa' : 'tex_mango';

  // Velocidad de caída autónoma según la altitud
  const speed = 105 + Math.min(220, altitude * 0.14);
  const sprite = currentScene.add.sprite(TRUNK_X[tIdx] + side * OFFSET_X, -28, tex).setDepth(12);
  mangos.push({ tIdx, side, isArepa, speed, sprite });
}

function updateAnts(dt) {
  for (let i = ants.length - 1; i >= 0; i--) {
    const a = ants[i];
    // Velocidad de caída autónoma: determinada puramente por los metros acumulados (NO cambia cuando el chamito sube o para)
    a.sprite.y += a.speed * dt;

    // Animación de caminata de lado trepando por el tronco
    if (!a.isSpaceShip && a.tex1 && a.tex2) {
      a.animTimer += dt * (a.speed * 0.045);
      if (a.animTimer >= 1.0) {
        a.animTimer -= 1.0;
        a.animFrame = (a.animFrame === 0) ? 1 : 0;
        a.sprite.setTexture(a.animFrame === 0 ? a.tex1 : a.tex2);
      }
    }
    a.sprite.setFlipX(a.side === 1);

    // Colisión con el chamito
    const dy = Math.abs(a.sprite.y - chamito.y);

    if (a.tIdx === chamito.trunk && a.side === chamito.side && dy < (a.isGiant ? 34 : 28)) {
      if (superTimer > 0) {
        sfx.smash();
        const points = a.isGiant ? 100 : 50;
        score += points;
        const smashPhrases = a.isGiant
          ? ['🫓 ¡BACHACO TOSTADO! +100', '💥 ¡NODRIZA DESTRUIDA! +100']
          : ['🫓 ¡TOSTADA! +50', '🔥 ¡BUDARE POWER! +50', '💥 ¡PODER CRIOLLO! +50'];
        const msg = smashPhrases[Math.floor(Math.random() * smashPhrases.length)];
        addFloatingText(msg, a.sprite.x, a.sprite.y, '#ffd54f');
        a.sprite.destroy();
        ants.splice(i, 1);
        broadcastStats();
        continue;
      } else if (invulTimer <= 0) {
        sfx.hurt();
        lives--;
        invulTimer = 1.6;

        if (lives <= 0) {
          triggerChamitoDeath();
          return;
        }
      }
    }

    if (a.sprite.y > GAME_HEIGHT + 35) {
      a.sprite.destroy();
      ants.splice(i, 1);
    }
  }
}

function updateMangos(dt) {
  for (let i = mangos.length - 1; i >= 0; i--) {
    const m = mangos[i];
    // Velocidad autónoma constante según los metros (NO cambia si el chamito sube o para)
    m.sprite.y += (m.speed || 115) * dt;

    const dy = Math.abs(m.sprite.y - chamito.y);

    if (m.tIdx === chamito.trunk && m.side === chamito.side && dy < 32) {
      if (m.isArepa) {
        sfx.golden();
        superTimer = 7.5;
        score += 150;
        addFloatingText('🫓 ¡AREPA PODEROSA! +150', chamito.x, chamito.y - 30, '#ffd700');
      } else {
        mangosCount++;
        sfx.munch();
        score += 20;
        addFloatingText('+20 🥭', m.sprite.x, m.sprite.y, '#81c784');
      }
      m.sprite.destroy();
      mangos.splice(i, 1);
      broadcastStats();
      continue;
    }

    if (m.sprite.y > GAME_HEIGHT + 35) {
      m.sprite.destroy();
      mangos.splice(i, 1);
    }
  }
}

function addFloatingText(text, x, y, color = '#ffffff') {
  if (!currentScene) return;
  const t = currentScene.add.text(x, y, text, {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: color,
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(45);
  floatingTexts.push({ textObj: t, life: 1.0 });
}

function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.textObj.y -= 35 * dt;
    ft.life -= dt * 1.5;
    ft.textObj.setAlpha(Math.max(0, ft.life));
    if (ft.life <= 0) {
      ft.textObj.destroy();
      floatingTexts.splice(i, 1);
    }
  }
}

function triggerChamitoDeath() {
  gameState = STATE_DYING;
  superTimer = 0;
  starShield.forEach((s) => s && s.setVisible(false));
  if (superAuraGraphics) superAuraGraphics.clear();
  sfx.stopBGM();
  sfx.chamitoFall();

  chamito.isDying = true;
  chamito.deathVy = -9.0;
  chamito.deathVx = chamito.side === 1 ? 3.5 : -3.5;
  chamito.sprite.setTexture('tex_chamito_hurt');
}

function triggerGameOver() {
  gameState = STATE_GAMEOVER;
  gameOverCooldown = 1.2; // 1.2s de pausa obligatoria para no reiniciar por accidente
  justPressed.START1 = false;
  justPressed.RESET = false;
  justPressed.P1_U = false;

  sfx.gameOver();

  if (score > highScore) {
    highScore = score;
    getStorage().set('chamito_high_score', highScore);
  }
  if (Math.floor(altitude) > bestAltitude) {
    bestAltitude = Math.floor(altitude);
    getStorage().set('chamito_best_altitude', bestAltitude);
  }

  broadcastStats();

  centerMenuText.setText(
    `¡FIN DEL JUEGO!\n\nPUNTAJE: ${score}\nMANGOS: ${mangosCount}\nALTURA: ${Math.floor(altitude)}m\n\nPresiona ESPACIO o ENTER\npara continuar`
  ).setVisible(true);
}

function updateHUD() {
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️' : '🖤';
  hudTexts.lives.setText(hearts);
  hudTexts.mangos.setText(`${mangosCount} 🥭`);
  hudTexts.altitude.setText(`${Math.floor(altitude)}m`);
  if (superTimer > 0) {
    hudTexts.score.setText(`${score} 🫓`);
    hudTexts.score.setColor('#ffd54f');
  } else {
    hudTexts.score.setText(`${score}`);
    hudTexts.score.setColor('#ffffff');
  }
}

function showMenuUI(visible) {
  if (visible) {
    centerMenuText.setText(
      'CHAMITO\n★ LA MATA DE MANGO ★\n\nEsquiva las hormigas\ny agarra los mangos\n\nPresiona ESPACIO o ENTER\npara jugar'
    ).setVisible(true);
  }
}

function broadcastStats() {
  if (typeof window !== 'undefined') {
    window.chamitoStats = {
      score: score,
      highScore: highScore,
      altitude: Math.floor(altitude),
      bestAltitude: bestAltitude,
      mangos: mangosCount,
    };
    if (window.updateHtmlCards) {
      window.updateHtmlCards();
    }
  }
}
