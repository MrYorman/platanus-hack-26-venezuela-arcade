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

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[key.length === 1 ? key.toLowerCase() : key] = arcadeCode;
  }
}

const held = Object.create(null);
const justPressed = Object.create(null);

window.addEventListener('keydown', (e) => {
  const norm = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = KEYBOARD_TO_ARCADE[norm];
  if (code) {
    if (!held[code]) justPressed[code] = true;
    held[code] = true;
  }
  if (norm === 'r') {
    justPressed.RESET = true;
  }
});

window.addEventListener('keyup', (e) => {
  const norm = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = KEYBOARD_TO_ARCADE[norm];
  if (code) held[code] = false;
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

// --- Audio Sintetizado (Web Audio API - Sin archivos externos) ---
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
    // Salto cómico sorprendido hacia arriba y silbido al caer de la mata de mango
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
    const bass = [130, 130, 164, 164, 146, 146, 196, 174];
    const lead = [523, 659, 784, 659, 587, 698, 784, 880];
    const tick = () => {
      if (!this.muted && this.ctx) {
        this.playTone(bass[this.bgmStep % bass.length], 'triangle', 0.09, 0.05);
        if (this.bgmStep % 2 === 0) {
          this.playTone(lead[(this.bgmStep / 2) % lead.length], 'square', 0.07, 0.03);
        }
      }
      this.bgmStep++;
      this.bgmTimer = setTimeout(tick, 180);
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
const TRUNK_X = [80, 180, 300, 400]; // 4 Troncos de la mata de mango repartidos en 480px
const OFFSET_X = 24; // Distancia al abrazar el tronco

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
let scrollSpeed = 2.0;

// Objeto del Chamito (Jugador único)
let chamito = {
  trunk: 1,
  side: 1,
  x: TRUNK_X[1] + OFFSET_X,
  targetX: TRUNK_X[1] + OFFSET_X,
  y: 470,
  targetY: 470,
  sprite: null,
  isDying: false,
  deathVx: 0,
  deathVy: 0,
  animTick: 0,
};

let ants = [];
let mangos = [];
let floatingTexts = [];
let antSpawnTimer = 0;
let mangoSpawnTimer = 0;

// Capas de fondo
let bgGraphics;
let treeGraphics;
let hudGraphics;
let hudTexts = {};
let centerMenuText;

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

  // Generar texturas de forma 100% procedimental
  generateProceduralTextures(this);

  // 1. Capas Gráficas
  bgGraphics = this.add.graphics().setDepth(1);
  treeGraphics = this.add.graphics().setDepth(5);

  // 2. Sprite del Chamito
  chamito.sprite = this.add.sprite(chamito.x, chamito.y, 'tex_chamito').setDepth(20);

  // 3. HUD elegante superior (solo 42px de alto, NO cards adentro!)
  createSleekHUD(this);

  // 4. Scanlines CRT del canvas
  drawCRTScanlines(this);

  // 5. Menú Inicial
  centerMenuText = this.add.text(240, 320, '', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#ffe600',
    align: 'center',
    backgroundColor: '#031208',
    padding: { x: 18, y: 14 },
    lineSpacing: 6,
  }).setOrigin(0.5).setDepth(50);

  showMenuUI(true);
}

// --- GENERACIÓN DE TEXTURAS PROCEDURALES ---
function generateProceduralTextures(scene) {
  // 1. Chamito (Niño con morral tricolor venezolano)
  const gC = scene.make.graphics({ x: 0, y: 0, add: false });
  
  // Shorts azul escolar
  gC.fillStyle(0x1a237e, 1);
  gC.fillRect(11, 27, 6, 12);
  gC.fillRect(19, 27, 6, 12);
  // Zapatitos marrones
  gC.fillStyle(0x4e342e, 1);
  gC.fillRect(10, 38, 7, 5);
  gC.fillRect(19, 38, 7, 5);

  // Camisa escolar blanca/beige
  gC.fillStyle(0xf5f5f5, 1);
  gC.fillRoundedRect(10, 16, 16, 13, 3);

  // Morral tricolor en la espalda
  // Franja Amarilla
  gC.fillStyle(0xffd600, 1);
  gC.fillRect(2, 17, 8, 4);
  // Franja Azul con estrellitas
  gC.fillStyle(0x1565c0, 1);
  gC.fillRect(2, 21, 8, 4);
  gC.fillStyle(0xffffff, 1);
  gC.fillRect(4, 22, 1.5, 1.5);
  gC.fillRect(7, 22, 1.5, 1.5);
  // Franja Roja
  gC.fillStyle(0xd32f2f, 1);
  gC.fillRect(2, 25, 8, 4);

  // Brazos agarrando el tronco
  gC.fillStyle(0xd7a17c, 1);
  gC.fillCircle(25, 19, 4);
  gC.fillCircle(25, 26, 4);

  // Cabeza del chamito
  gC.fillStyle(0xd7a17c, 1);
  gC.fillCircle(18, 10, 8);
  // Cabello negro peinado hacia un lado
  gC.fillStyle(0x212121, 1);
  gC.fillCircle(17, 6, 7.5);
  gC.fillCircle(21, 7, 5.5);
  gC.fillCircle(13, 8, 5.5);

  // Orejita
  gC.fillStyle(0xd7a17c, 1);
  gC.fillCircle(10, 10, 2.5);

  // Ojo alegre
  gC.fillStyle(0xffffff, 1);
  gC.fillCircle(20, 9, 2.5);
  gC.fillStyle(0x000000, 1);
  gC.fillCircle(21, 9, 1.4);

  // Sonrisa
  gC.lineStyle(1.4, 0x5d4037, 1);
  gC.beginPath();
  gC.arc(20, 13, 2.5, 0.2, Math.PI * 0.9, false);
  gC.strokePath();

  gC.generateTexture('tex_chamito', 38, 46);
  gC.destroy();

  // 2. Chamito golpeado / cayendo (Ojos X X, boca en O)
  const gCH = scene.make.graphics({ x: 0, y: 0, add: false });
  gCH.fillStyle(0x1a237e, 1);
  gCH.fillRect(11, 27, 6, 12);
  gCH.fillRect(19, 27, 6, 12);
  gCH.fillStyle(0x4e342e, 1);
  gCH.fillRect(10, 38, 7, 5);
  gCH.fillRect(19, 38, 7, 5);

  gCH.fillStyle(0xf5f5f5, 1);
  gCH.fillRoundedRect(10, 16, 16, 13, 3);

  // Morral tricolor
  gCH.fillStyle(0xffd600, 1);
  gCH.fillRect(2, 17, 8, 4);
  gCH.fillStyle(0x1565c0, 1);
  gCH.fillRect(2, 21, 8, 4);
  gCH.fillStyle(0xffffff, 1);
  gCH.fillRect(4, 22, 1.5, 1.5);
  gCH.fillRect(7, 22, 1.5, 1.5);
  gCH.fillStyle(0xd32f2f, 1);
  gCH.fillRect(2, 25, 8, 4);

  // Brazos abiertos por la caída
  gCH.fillStyle(0xd7a17c, 1);
  gCH.fillCircle(27, 16, 4);
  gCH.fillCircle(8, 16, 4);

  // Cabeza
  gCH.fillStyle(0xd7a17c, 1);
  gCH.fillCircle(18, 10, 8);
  gCH.fillStyle(0x212121, 1);
  gCH.fillCircle(17, 6, 7.5);
  gCH.fillCircle(21, 7, 5.5);
  gCH.fillCircle(13, 8, 5.5);

  // Ojos X X
  gCH.lineStyle(1.8, 0x000000, 1);
  gCH.beginPath();
  gCH.moveTo(14, 7); gCH.lineTo(18, 11);
  gCH.moveTo(18, 7); gCH.lineTo(14, 11);
  gCH.moveTo(19, 7); gCH.lineTo(23, 11);
  gCH.moveTo(23, 7); gCH.lineTo(19, 11);
  gCH.strokePath();

  // Boca abierta "O" de susto
  gCH.fillStyle(0x3e2723, 1);
  gCH.fillCircle(18, 14, 2.5);

  gCH.generateTexture('tex_chamito_hurt', 38, 46);
  gCH.destroy();

  // 3. Mango Criollo Maduro (Silueta inconfundible con degradado verde, amarillo, rojo)
  const gM = scene.make.graphics({ x: 0, y: 0, add: false });
  gM.fillStyle(0x7cb342, 1);
  gM.fillEllipse(10, 14, 9, 12);
  gM.fillStyle(0xffb300, 1);
  gM.fillEllipse(13, 14, 11, 13);
  gM.fillStyle(0xd32f2f, 0.92);
  gM.fillEllipse(16, 14, 8, 11);

  // Brillo
  gM.fillStyle(0xffffff, 0.45);
  gM.fillCircle(11, 10, 2.5);

  // Tallito y hoja
  gM.fillStyle(0x5d4037, 1);
  gM.fillRect(12, 2, 2, 4);
  gM.fillStyle(0x2e7d32, 1);
  gM.fillTriangle(14, 3, 21, 1, 17, 6);

  gM.generateTexture('tex_mango', 26, 28);
  gM.destroy();

  // 4. Mango de Oro (Super Mango invencible con aura)
  const gMG = scene.make.graphics({ x: 0, y: 0, add: false });
  gMG.fillStyle(0xffd700, 1);
  gMG.fillCircle(13, 13, 12);
  gMG.fillStyle(0xffea00, 1);
  gMG.fillCircle(13, 13, 9);
  gMG.fillStyle(0xffffff, 1);
  gMG.fillCircle(10, 9, 3.5);
  // Destellos estelares
  gMG.lineStyle(1.6, 0xffffff, 1);
  gMG.beginPath();
  gMG.moveTo(13, 1); gMG.lineTo(13, 5);
  gMG.moveTo(13, 21); gMG.lineTo(13, 25);
  gMG.moveTo(1, 13); gMG.lineTo(5, 13);
  gMG.moveTo(21, 13); gMG.lineTo(25, 13);
  gMG.strokePath();

  gMG.generateTexture('tex_mango_gold', 26, 26);
  gMG.destroy();

  // 5. Hormiga Roja Caraqueña (Grande, anatómica y bien definida)
  const gAR = scene.make.graphics({ x: 0, y: 0, add: false });
  // Abdomen trasero
  gAR.fillStyle(0xd32f2f, 1);
  gAR.fillEllipse(12, 7, 8, 11);
  // Rayas del abdomen
  gAR.lineStyle(1, 0xb71c1c, 0.9);
  gAR.lineBetween(8, 6, 16, 6);
  gAR.lineBetween(8, 9, 16, 9);

  // Tórax
  gAR.fillStyle(0xb71c1c, 1);
  gAR.fillEllipse(12, 15, 6, 7);

  // Cabeza delantera
  gAR.fillStyle(0xc62828, 1);
  gAR.fillCircle(12, 22, 5.5);

  // Ojitos
  gAR.fillStyle(0xffffff, 1);
  gAR.fillCircle(10, 21, 1.4);
  gAR.fillCircle(14, 21, 1.4);
  gAR.fillStyle(0x000000, 1);
  gAR.fillCircle(10, 22, 0.9);
  gAR.fillCircle(14, 22, 0.9);

  // Mandíbulas afiladas
  gAR.lineStyle(1.5, 0xffffff, 1);
  gAR.beginPath();
  gAR.moveTo(10, 26); gAR.lineTo(8, 29);
  gAR.moveTo(14, 26); gAR.lineTo(16, 29);
  gAR.strokePath();

  // Antenas
  gAR.lineStyle(1.4, 0xb71c1c, 1);
  gAR.beginPath();
  gAR.moveTo(10, 20); gAR.lineTo(6, 16);
  gAR.moveTo(14, 20); gAR.lineTo(18, 16);
  gAR.strokePath();

  // 6 Patas articuladas
  gAR.lineStyle(1.8, 0xd32f2f, 1);
  gAR.beginPath();
  // Patas delanteras
  gAR.moveTo(12, 19); gAR.lineTo(3, 16);
  gAR.moveTo(12, 19); gAR.lineTo(21, 16);
  // Patas medias
  gAR.moveTo(12, 15); gAR.lineTo(2, 15);
  gAR.moveTo(12, 15); gAR.lineTo(22, 15);
  // Patas traseras
  gAR.moveTo(12, 11); gAR.lineTo(3, 8);
  gAR.moveTo(12, 11); gAR.lineTo(21, 8);
  gAR.strokePath();

  gAR.generateTexture('tex_ant_red', 24, 32);
  gAR.destroy();

  // 6. Hormiga Negra Guerrera
  const gAB = scene.make.graphics({ x: 0, y: 0, add: false });
  gAB.fillStyle(0x212121, 1);
  gAB.fillEllipse(13, 8, 9, 12);
  gAB.fillStyle(0x111111, 1);
  gAB.fillEllipse(13, 16, 7, 8);
  gAB.fillStyle(0x000000, 1);
  gAB.fillCircle(13, 24, 6);

  gAB.fillStyle(0xffffff, 1);
  gAB.fillCircle(11, 23, 1.5);
  gAB.fillCircle(15, 23, 1.5);

  gAB.lineStyle(1.5, 0xffffff, 1);
  gAB.beginPath();
  gAB.moveTo(11, 28); gAB.lineTo(9, 31);
  gAB.moveTo(15, 28); gAB.lineTo(17, 31);
  gAB.strokePath();

  gAB.lineStyle(1.8, 0x424242, 1);
  gAB.beginPath();
  gAB.moveTo(13, 21); gAB.lineTo(3, 17);
  gAB.moveTo(13, 21); gAB.lineTo(23, 17);
  gAB.moveTo(13, 16); gAB.lineTo(2, 16);
  gAB.moveTo(13, 16); gAB.lineTo(24, 16);
  gAB.moveTo(13, 12); gAB.lineTo(3, 9);
  gAB.moveTo(13, 12); gAB.lineTo(23, 9);
  gAB.strokePath();

  gAB.generateTexture('tex_ant_black', 26, 34);
  gAB.destroy();

  // 7. Hormiga de Fuego Bala
  const gAF = scene.make.graphics({ x: 0, y: 0, add: false });
  gAF.fillStyle(0xff6d00, 1);
  gAF.fillEllipse(12, 7, 8, 11);
  gAF.fillStyle(0xdd2c00, 1);
  gAF.fillEllipse(12, 15, 6, 7);
  gAF.fillStyle(0xbf360c, 1);
  gAF.fillCircle(12, 22, 5.5);

  gAF.fillStyle(0xffff00, 1);
  gAF.fillCircle(10, 21, 1.5);
  gAF.fillCircle(14, 21, 1.5);

  gAF.lineStyle(1.8, 0xff9100, 1);
  gAF.beginPath();
  gAF.moveTo(12, 19); gAF.lineTo(3, 16);
  gAF.moveTo(12, 19); gAF.lineTo(21, 16);
  gAF.moveTo(12, 15); gAF.lineTo(2, 15);
  gAF.moveTo(12, 15); gAF.lineTo(22, 15);
  gAF.moveTo(12, 11); gAF.lineTo(3, 8);
  gAF.moveTo(12, 11); gAF.lineTo(21, 8);
  gAF.strokePath();

  gAF.generateTexture('tex_ant_fire', 24, 32);
  gAF.destroy();
}

// --- HUD ELEGANTE SUPERIOR (Sin recuadros gigantes adentro!) ---
function createSleekHUD(scene) {
  hudGraphics = scene.add.graphics().setDepth(30);

  // Barra delgada translúcida (solo 42 px)
  hudGraphics.fillStyle(0x021107, 0.82);
  hudGraphics.fillRect(0, 0, GAME_WIDTH, 42);
  hudGraphics.lineStyle(1.5, 0x1fa347, 1);
  hudGraphics.beginPath();
  hudGraphics.moveTo(0, 42);
  hudGraphics.lineTo(GAME_WIDTH, 42);
  hudGraphics.strokePath();

  const font = { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', fontStyle: 'bold' };

  hudTexts.lives = scene.add.text(12, 12, '❤️❤️❤️', { fontSize: '14px' }).setDepth(31);
  hudTexts.mangos = scene.add.text(110, 13, '0 🥭', { fontFamily: 'monospace', fontSize: '13px', color: '#ffe600', fontStyle: 'bold' }).setDepth(31);
  hudTexts.altitude = scene.add.text(210, 13, '0m', { fontFamily: 'monospace', fontSize: '13px', color: '#80e27e' }).setDepth(31);
  hudTexts.score = scene.add.text(GAME_WIDTH - 16, 13, '0', font).setOrigin(1, 0).setDepth(31);
}

function drawCRTScanlines(scene) {
  const g = scene.add.graphics().setDepth(99);
  g.lineStyle(1, 0x000000, 0.28);
  for (let y = 0; y < GAME_HEIGHT; y += 4) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(GAME_WIDTH, y);
    g.strokePath();
  }
}

// --- BUCLE PRINCIPAL DE PHASER 3 ---
function update(time, delta) {
  const dt = delta / 1000;

  // Manejo de reinicio inmediato con R
  if (justPressed.RESET) {
    justPressed.RESET = false;
    startFreshGame();
    return;
  }

  // Menú principal
  if (gameState === STATE_MENU) {
    if (justPressed.START1 || justPressed.P1_U || held.P1_U) {
      justPressed.START1 = false;
      startFreshGame();
    }
    return;
  }

  // Pausa con P o P1_1
  if (justPressed.P1_1) {
    justPressed.P1_1 = false;
    if (gameState === STATE_PLAYING) {
      gameState = STATE_PAUSED;
      centerMenuText.setText('PAUSA\n\nPresiona P para seguir\nR para reiniciar').setVisible(true);
      return;
    } else if (gameState === STATE_PAUSED) {
      gameState = STATE_PLAYING;
      centerMenuText.setVisible(false);
      return;
    }
  }

  if (gameState === STATE_PAUSED) return;

  // Estado de Salto y Caída del Chamito (Al morir)
  if (gameState === STATE_DYING) {
    chamito.deathVy += 26 * dt; // Gravedad
    chamito.y += chamito.deathVy;
    chamito.x += chamito.deathVx;
    chamito.sprite.setRotation(chamito.sprite.rotation + (chamito.deathVx > 0 ? 9 : -9) * dt);
    chamito.sprite.setPosition(chamito.x, chamito.y);

    if (chamito.y > GAME_HEIGHT + 60) {
      triggerGameOver();
    }
    return;
  }

  // Game Over
  if (gameState === STATE_GAMEOVER) {
    if (justPressed.START1 || justPressed.P1_1) {
      justPressed.START1 = false;
      startFreshGame();
    }
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
  scrollSpeed = 2.2;

  // Limpiar entidades previas
  ants.forEach((a) => a.sprite.destroy());
  mangos.forEach((m) => m.sprite.destroy());
  floatingTexts.forEach((t) => t.destroy());
  ants = [];
  mangos = [];
  floatingTexts = [];

  // Reset del chamito
  chamito.trunk = 1;
  chamito.side = 1;
  chamito.x = TRUNK_X[1] + OFFSET_X;
  chamito.targetX = chamito.x;
  chamito.y = 470;
  chamito.targetY = 470;
  chamito.isDying = false;
  chamito.deathVx = 0;
  chamito.deathVy = 0;
  chamito.sprite.setTexture('tex_chamito').setRotation(0).setPosition(chamito.x, chamito.y).setAlpha(1);

  gameState = STATE_PLAYING;
  centerMenuText.setVisible(false);
  sfx.startBGM();
  broadcastStats();
}

function handlePlayerInput(dt) {
  // Movimiento lateral (Cambiar de tronco / lado)
  if (justPressed.P1_L) {
    justPressed.P1_L = false;
    moveChamitoLeft();
  }
  if (justPressed.P1_R) {
    justPressed.P1_R = false;
    moveChamitoRight();
  }

  // Trepar o deslizarse verticalmente
  if (held.P1_U) {
    scrollSpeed = 3.8;
    chamito.targetY = Math.max(160, chamito.targetY - 140 * dt);
  } else if (held.P1_D) {
    scrollSpeed = 1.0;
    chamito.targetY = Math.min(520, chamito.targetY + 180 * dt);
  } else {
    scrollSpeed = 2.2;
    chamito.targetY += (470 - chamito.targetY) * 0.08;
  }

  // Suavizado de posición del chamito
  chamito.x += (chamito.targetX - chamito.x) * 0.35;
  chamito.y += (chamito.targetY - chamito.y) * 0.25;

  // Orientación del sprite (mira hacia el tronco que abraza)
  chamito.sprite.setFlipX(chamito.side === 1);
  chamito.sprite.setPosition(chamito.x, chamito.y);

  // Parpadeo de invulnerabilidad
  if (invulTimer > 0) {
    invulTimer -= dt;
    chamito.sprite.setAlpha(Math.floor(invulTimer * 12) % 2 === 0 ? 0.3 : 1.0);
  } else {
    chamito.sprite.setAlpha(1.0);
  }

  // Modo Super Mango de Oro
  if (superTimer > 0) {
    superTimer -= dt;
    chamito.sprite.setTint(0xffeb3b);
  } else {
    chamito.sprite.clearTint();
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
  altitude += scrollSpeed * dt * 9;
  score += Math.round(scrollSpeed * 0.7);

  if (altitude > bestAltitude) {
    bestAltitude = Math.floor(altitude);
  }

  // Spawn Hormigas
  antSpawnTimer += dt;
  const antInterval = Math.max(0.65, 1.8 - altitude * 0.0012);
  if (antSpawnTimer > antInterval) {
    antSpawnTimer = 0;
    spawnAnt();
  }

  // Spawn Mangos
  mangoSpawnTimer += dt;
  if (mangoSpawnTimer > 1.2) {
    mangoSpawnTimer = 0;
    spawnMango();
  }
}

// --- RENDER DEL FONDO DINÁMICO (ZONA URBANA BARRIO -> ÁVILA -> ATMÓSFERA -> ESPACIO PROFUNDO) ---
function renderDynamicBackground() {
  if (!bgGraphics) return;
  bgGraphics.clear();

  const alt = altitude;

  // 1. ZONA URBANA / BARRIO VENEZOLANO (0 - 300m)
  if (alt < 300) {
    // Cielo azul de Caracas
    bgGraphics.fillGradientStyle(0x1e88e5, 0x1e88e5, 0x64b5f6, 0x64b5f6, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Desplazamiento del patio y casas según sube el chamito
    const offsetY = alt * 1.8;

    // Suelo del patio con grama y tierra al inicio
    if (offsetY < GAME_HEIGHT) {
      bgGraphics.fillStyle(0x33691e, 1);
      bgGraphics.fillRect(0, GAME_HEIGHT - offsetY + 280, GAME_WIDTH, 400);
      bgGraphics.fillStyle(0x4e342e, 1);
      bgGraphics.fillRect(0, GAME_HEIGHT - offsetY + 330, GAME_WIDTH, 400);
    }

    // Casas del barrio de ladrillos rojos sin frisar
    const houseY = GAME_HEIGHT - offsetY + 100;
    if (houseY < GAME_HEIGHT + 200 && houseY > -200) {
      // Casa izquierda
      bgGraphics.fillStyle(0xb73a1e, 1); // Ladrillo rojo
      bgGraphics.fillRect(10, houseY, 150, 190);
      // Techo de zinc galvanizado
      bgGraphics.fillStyle(0x90a4ae, 1);
      bgGraphics.fillRect(5, houseY - 10, 165, 12);
      // Tanque azul cilíndrico en el techo
      bgGraphics.fillStyle(0x0277bd, 1);
      bgGraphics.fillRoundedRect(40, houseY - 42, 36, 32, 4);
      bgGraphics.fillStyle(0x01579b, 1);
      bgGraphics.fillRect(36, houseY - 44, 44, 5); // Tapa

      // Casa derecha con platabanda y doña en la ventana
      bgGraphics.fillStyle(0xc0392b, 1);
      bgGraphics.fillRect(320, houseY + 30, 150, 200);
      bgGraphics.fillStyle(0x78909c, 1);
      bgGraphics.fillRect(315, houseY + 20, 160, 12);
      // Tanque azul derecho
      bgGraphics.fillStyle(0x0277bd, 1);
      bgGraphics.fillRoundedRect(350, houseY - 12, 36, 32, 4);

      // Ventana con la doña venezolana asomada con sus rulos
      bgGraphics.fillStyle(0x212121, 1);
      bgGraphics.fillRect(50, houseY + 45, 34, 38);
      // Rejas
      bgGraphics.lineStyle(1.5, 0xffffff, 0.7);
      bgGraphics.lineBetween(58, houseY + 45, 58, houseY + 83);
      bgGraphics.lineBetween(66, houseY + 45, 66, houseY + 83);
      bgGraphics.lineBetween(74, houseY + 45, 74, houseY + 83);
      // Cara de la doña
      bgGraphics.fillStyle(0xd7a17c, 1);
      bgGraphics.fillCircle(67, houseY + 62, 7);
      // Rulos rosados en el cabello
      bgGraphics.fillStyle(0xf06292, 1);
      bgGraphics.fillCircle(62, houseY + 56, 3);
      bgGraphics.fillCircle(67, houseY + 54, 3);
      bgGraphics.fillCircle(72, houseY + 56, 3);
      // Bata de andar por casa
      bgGraphics.fillStyle(0xffd54f, 1);
      bgGraphics.fillRect(60, houseY + 69, 14, 14);

      // Cables de luz que cruzan
      bgGraphics.lineStyle(1.2, 0x212121, 0.6);
      bgGraphics.lineBetween(0, houseY + 10, GAME_WIDTH, houseY + 50);
      bgGraphics.lineBetween(0, houseY + 25, GAME_WIDTH, houseY + 65);
    }
  }
  // 2. ZONA EL ÁVILA Y CIELO CARAQUEÑO (300 - 700m)
  else if (alt < 700) {
    const p = (alt - 300) / 400;
    // Transición de azul celeste a violeta atardecer
    bgGraphics.fillGradientStyle(0x1a237e, 0x1a237e, 0xd84315, 0xf57c00, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Silueta imponente del Ávila
    bgGraphics.fillStyle(0x0e3d1c, 0.9);
    bgGraphics.beginPath();
    bgGraphics.moveTo(0, 480);
    bgGraphics.lineTo(120, 360);
    bgGraphics.lineTo(260, 410);
    bgGraphics.lineTo(380, 320);
    bgGraphics.lineTo(480, 370);
    bgGraphics.lineTo(480, 640);
    bgGraphics.lineTo(0, 640);
    bgGraphics.closePath();
    bgGraphics.fillPath();

    // Nubes flotantes
    bgGraphics.fillStyle(0xffffff, 0.4);
    bgGraphics.fillCircle(90, 200, 40);
    bgGraphics.fillCircle(130, 200, 50);
    bgGraphics.fillCircle(170, 200, 35);
  }
  // 3. ZONA ATMÓSFERA Y SATÉLITE SIMÓN BOLÍVAR (700 - 1200m)
  else if (alt < 1200) {
    bgGraphics.fillGradientStyle(0x020813, 0x020813, 0x0d2040, 0x0d2040, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Estrellas titilantes
    bgGraphics.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 73) % GAME_WIDTH);
      const sy = (((i * 97) + alt * 0.5) % GAME_HEIGHT);
      bgGraphics.fillCircle(sx, sy, (i % 3 === 0 ? 2 : 1.2));
    }

    // Curvatura de la Tierra abajo
    bgGraphics.fillStyle(0x1565c0, 0.6);
    bgGraphics.beginPath();
    bgGraphics.arc(240, 950, 400, Math.PI, 0, false);
    bgGraphics.fillPath();

    // Satélite Simón Bolívar orbitando
    const satY = ((alt * 0.4) % 500) + 70;
    bgGraphics.fillStyle(0xffd700, 1); // Cuerpo central dorado
    bgGraphics.fillRect(360, satY, 20, 16);
    // Paneles solares azules
    bgGraphics.fillStyle(0x0288d1, 1);
    bgGraphics.fillRect(330, satY + 4, 25, 8);
    bgGraphics.fillRect(385, satY + 4, 25, 8);
  }
  // 4. ZONA ESPACIO PROFUNDO Y AGUJERO NEGRO (1200m+)
  else {
    bgGraphics.fillGradientStyle(0x000000, 0x000000, 0x120422, 0x120422, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Nebulosa cósmica púrpura/magenta
    bgGraphics.fillStyle(0x8e24aa, 0.25);
    bgGraphics.fillCircle(160, 280, 140);
    bgGraphics.fillStyle(0x00bcd4, 0.2);
    bgGraphics.fillCircle(320, 360, 120);

    // Estrellas
    bgGraphics.fillStyle(0xffffff, 0.95);
    for (let i = 0; i < 45; i++) {
      const sx = ((i * 67) % GAME_WIDTH);
      const sy = (((i * 89) + alt * 0.4) % GAME_HEIGHT);
      bgGraphics.fillCircle(sx, sy, (i % 4 === 0 ? 2.5 : 1.2));
    }

    // Agujero negro cósmico con disco de acreción
    bgGraphics.lineStyle(4, 0xffa000, 0.8);
    bgGraphics.strokeEllipse(240, 200, 70, 24);
    bgGraphics.lineStyle(2, 0xffffff, 0.9);
    bgGraphics.strokeEllipse(240, 200, 80, 28);
    bgGraphics.fillStyle(0x000000, 1);
    bgGraphics.fillCircle(240, 200, 22);
  }
}

// --- RENDER DE LOS 4 TRONCOS DE LA MATA DE MANGO ---
function renderMangoTrunks() {
  if (!treeGraphics) return;
  treeGraphics.clear();

  const trunkWidth = 26;

  TRUNK_X.forEach((tx) => {
    // Sombra del tronco
    treeGraphics.fillStyle(0x020a04, 0.45);
    treeGraphics.fillRect(tx - trunkWidth / 2 + 5, 0, trunkWidth, GAME_HEIGHT);

    // Madera de mango cálida
    treeGraphics.fillStyle(0x4e3629, 1);
    treeGraphics.fillRect(tx - trunkWidth / 2, 0, trunkWidth, GAME_HEIGHT);

    // Vetas de madera
    treeGraphics.fillStyle(0x6d4c41, 1);
    treeGraphics.fillRect(tx - trunkWidth / 2 + 4, 0, 9, GAME_HEIGHT);
    treeGraphics.fillStyle(0x8d6e63, 0.85);
    treeGraphics.fillRect(tx - trunkWidth / 2 + 6, 0, 3, GAME_HEIGHT);

    // Nudos y ramitas de mango
    treeGraphics.fillStyle(0x3e2723, 1);
    treeGraphics.lineStyle(2, 0x8d6e63, 0.8);
    for (let y = 30; y < GAME_HEIGHT; y += 85) {
      treeGraphics.fillEllipse(tx, y, trunkWidth + 4, 6);
      treeGraphics.strokeEllipse(tx, y, trunkWidth + 4, 6);
    }

    // Hojitas verdes de mango saliendo a los lados
    treeGraphics.fillStyle(0x2e7d32, 0.9);
    for (let y = 70; y < GAME_HEIGHT; y += 130) {
      treeGraphics.fillTriangle(tx + 13, y, tx + 27, y - 5, tx + 22, y + 5);
      treeGraphics.fillTriangle(tx - 13, y + 50, tx - 27, y + 45, tx - 22, y + 55);
    }
  });
}

function spawnAnt() {
  if (!currentScene) return;
  const tIdx = Math.floor(Math.random() * NUM_TRUNKS);
  const side = Math.random() < 0.5 ? -1 : 1;
  const r = Math.random();
  let tex = 'tex_ant_red';
  let speed = 130 + altitude * 0.16;

  if (altitude > 150 && r > 0.65) {
    tex = 'tex_ant_black';
    speed *= 1.35;
  } else if (altitude > 300 && r < 0.25) {
    tex = 'tex_ant_fire';
    speed *= 1.7;
  }

  const sprite = currentScene.add.sprite(TRUNK_X[tIdx] + side * (OFFSET_X - 4), -25, tex).setDepth(15);
  ants.push({ tIdx, side, speed, sprite });
}

function spawnMango() {
  if (!currentScene) return;
  const tIdx = Math.floor(Math.random() * NUM_TRUNKS);
  const side = Math.random() < 0.5 ? -1 : 1;
  const isGold = Math.random() < 0.08 && superTimer <= 0;
  const tex = isGold ? 'tex_mango_gold' : 'tex_mango';

  const sprite = currentScene.add.sprite(TRUNK_X[tIdx] + side * OFFSET_X, -25, tex).setDepth(12);
  mangos.push({ tIdx, side, isGold, sprite });
}

function updateAnts(dt) {
  for (let i = ants.length - 1; i >= 0; i--) {
    const a = ants[i];
    a.sprite.y += (a.speed + scrollSpeed * 25) * dt;

    // Colisión con el chamito
    const dy = Math.abs(a.sprite.y - chamito.y);
    const dx = Math.abs(a.sprite.x - chamito.x);

    if (a.tIdx === chamito.trunk && a.side === chamito.side && dy < 30 && dx < 24) {
      if (superTimer > 0) {
        // Super Chamito aplasta la hormiga
        sfx.smash();
        score += 50;
        addFloatingText('+50', a.sprite.x, a.sprite.y, '#ffd54f');
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
    m.sprite.y += scrollSpeed * 48 * dt;

    const dy = Math.abs(m.sprite.y - chamito.y);
    const dx = Math.abs(m.sprite.x - chamito.x);

    if (m.tIdx === chamito.trunk && m.side === chamito.side && dy < 32 && dx < 24) {
      mangosCount++;
      if (m.isGold) {
        sfx.golden();
        superTimer = 7.0;
        score += 150;
        addFloatingText('🌟 SUPER MANGO! +150', chamito.x, chamito.y - 30, '#ffd700');
      } else {
        sfx.munch();
        score += 20;
        addFloatingText('+20', m.sprite.x, m.sprite.y, '#81c784');
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
  sfx.stopBGM();
  sfx.chamitoFall();

  chamito.isDying = true;
  chamito.deathVy = -8.5; // Salto inicial hacia arriba
  chamito.deathVx = chamito.side === 1 ? 3.0 : -3.0; // Despegarse del tronco hacia el vacío
  chamito.sprite.setTexture('tex_chamito_hurt');
}

function triggerGameOver() {
  gameState = STATE_GAMEOVER;
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
    `¡FIN DEL JUEGO!\n\nPUNTAJE: ${score}\nMANGOS: ${mangosCount}\nALTURA: ${Math.floor(altitude)}m\n\nPresiona ENTER o R\npara jugar de nuevo`
  ).setVisible(true);
}

function updateHUD() {
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️ ' : '🖤 ';
  hudTexts.lives.setText(hearts);
  hudTexts.mangos.setText(`${mangosCount} 🥭`);
  hudTexts.altitude.setText(`${Math.floor(altitude)}m`);
  hudTexts.score.setText(`${score}`);
}

function showMenuUI(visible) {
  if (visible) {
    centerMenuText.setText(
      'CHAMITO\n★ LA MATA DE MANGO ★\n\nEsquiva las hormigas\ny agarra los mangos\n\nPresiona ENTER o W\npara jugar'
    ).setVisible(true);
  }
}

// Sincronizar estadísticas en vivo con las tarjetas HTML externas
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
