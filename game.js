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
  if (k === 'ArrowUp' || k === 'w' || k === 'W') {
    if (!held.P1_U) justPressed.P1_U = true;
    held.P1_U = true;
  }
  if (k === 'ArrowDown' || k === 's' || k === 'S') {
    if (!held.P1_D) justPressed.P1_D = true;
    held.P1_D = true;
  }
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
    if (!held.P1_L) justPressed.P1_L = true;
    held.P1_L = true;
  }
  if (k === 'ArrowRight' || k === 'd' || k === 'D') {
    if (!held.P1_R) justPressed.P1_R = true;
    held.P1_R = true;
  }
  if (k === 'Enter' || k === ' ') {
    if (!held.START1) justPressed.START1 = true;
    held.START1 = true;
  }
  if (k === 'p' || k === 'P' || k === 'Escape') {
    justPressed.P1_1 = true;
  }
  if (k === 'r' || k === 'R') {
    justPressed.RESET = true;
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowUp' || k === 'w' || k === 'W') held.P1_U = false;
  if (k === 'ArrowDown' || k === 's' || k === 'S') held.P1_D = false;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') held.P1_L = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') held.P1_R = false;
  if (k === 'Enter' || k === ' ') held.START1 = false;
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
};

let ants = [];
let mangos = [];
let floatingTexts = [];
let antSpawnTimer = 0;
let mangoSpawnTimer = 0;

// Capas de render
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

  generateProceduralTextures(this);

  // 1. Capas Gráficas
  bgGraphics = this.add.graphics().setDepth(1);
  treeGraphics = this.add.graphics().setDepth(5);

  // 2. Sprite del Chamito
  chamito.sprite = this.add.sprite(chamito.x, chamito.y, 'tex_chamito').setDepth(20);

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

  showMenuUI(true);
  renderDynamicBackground();
  renderMangoTrunks();
}

// --- GENERACIÓN DE TEXTURAS PROCEDURALES ---
function generateProceduralTextures(scene) {
  // 1. Chamito (Niño venezolano con camisa escolar y morral tricolor)
  const gC = scene.make.graphics({ x: 0, y: 0, add: false });
  
  // Shorts azul escolar
  gC.fillStyle(0x1a237e, 1);
  gC.fillRect(11, 27, 6, 12);
  gC.fillRect(19, 27, 6, 12);
  // Zapatos marrones
  gC.fillStyle(0x4e342e, 1);
  gC.fillRect(10, 38, 7, 5);
  gC.fillRect(19, 38, 7, 5);

  // Camisa escolar blanca/beige
  gC.fillStyle(0xf5f5f5, 1);
  gC.fillRoundedRect(10, 16, 16, 13, 3);

  // Morral tricolor en la espalda
  gC.fillStyle(0xffd600, 1); // Amarillo
  gC.fillRect(2, 17, 8, 4);
  gC.fillStyle(0x1565c0, 1); // Azul
  gC.fillRect(2, 21, 8, 4);
  gC.fillStyle(0xffffff, 1); // Estrellitas
  gC.fillRect(4, 22, 1.5, 1.5);
  gC.fillRect(7, 22, 1.5, 1.5);
  gC.fillStyle(0xd32f2f, 1); // Rojo
  gC.fillRect(2, 25, 8, 4);

  // Brazos agarrando el tronco
  gC.fillStyle(0xd7a17c, 1);
  gC.fillCircle(25, 19, 4);
  gC.fillCircle(25, 26, 4);

  // Cabeza del chamito
  gC.fillStyle(0xd7a17c, 1);
  gC.fillCircle(18, 10, 8);
  // Cabello negro peinado hacia el lado
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

  // 2. Chamito golpeado / cayendo (Ojos X X, boca en O de susto)
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

  // Brazos abiertos
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

  // 4. Mango de Oro
  const gMG = scene.make.graphics({ x: 0, y: 0, add: false });
  gMG.fillStyle(0xffd700, 1);
  gMG.fillCircle(13, 13, 12);
  gMG.fillStyle(0xffea00, 1);
  gMG.fillCircle(13, 13, 9);
  gMG.fillStyle(0xffffff, 1);
  gMG.fillCircle(10, 9, 3.5);
  gMG.lineStyle(1.6, 0xffffff, 1);
  gMG.beginPath();
  gMG.moveTo(13, 1); gMG.lineTo(13, 5);
  gMG.moveTo(13, 21); gMG.lineTo(13, 25);
  gMG.moveTo(1, 13); gMG.lineTo(5, 13);
  gMG.moveTo(21, 13); gMG.lineTo(25, 13);
  gMG.strokePath();

  gMG.generateTexture('tex_mango_gold', 26, 26);
  gMG.destroy();

  // 5. HORMIGA ROJA COMPACTA (18px de ancho: las 6 patas caben 100% sobre el tronco!)
  const gAR = scene.make.graphics({ x: 0, y: 0, add: false });
  // Abdomen
  gAR.fillStyle(0xd32f2f, 1);
  gAR.fillEllipse(9, 6, 6, 8);
  gAR.lineStyle(1, 0x8e0000, 1);
  gAR.lineBetween(6, 5, 12, 5);
  gAR.lineBetween(6, 8, 12, 8);

  // Tórax
  gAR.fillStyle(0xb71c1c, 1);
  gAR.fillEllipse(9, 13, 4.5, 5.5);

  // Cabeza mirando hacia abajo
  gAR.fillStyle(0xc62828, 1);
  gAR.fillCircle(9, 19, 4.5);

  // Ojitos
  gAR.fillStyle(0xffffff, 1);
  gAR.fillCircle(7.5, 18.5, 1.2);
  gAR.fillCircle(10.5, 18.5, 1.2);
  gAR.fillStyle(0x000000, 1);
  gAR.fillCircle(7.5, 19, 0.7);
  gAR.fillCircle(10.5, 19, 0.7);

  // Mandíbulas tenaza
  gAR.lineStyle(1.4, 0xffffff, 1);
  gAR.lineBetween(7.5, 22, 6, 25);
  gAR.lineBetween(10.5, 22, 12, 25);

  // Antenas
  gAR.lineStyle(1.2, 0xb71c1c, 1);
  gAR.lineBetween(7.5, 17, 4, 14);
  gAR.lineBetween(10.5, 17, 14, 14);

  // 6 Patas que agarran el tronco (curvadas hacia el centro, NUNCA en el aire!)
  gAR.lineStyle(1.5, 0xd32f2f, 1);
  // Delanteras
  gAR.lineBetween(9, 16, 2, 14);
  gAR.lineBetween(9, 16, 16, 14);
  // Medias
  gAR.lineBetween(9, 13, 1, 13);
  gAR.lineBetween(9, 13, 17, 13);
  // Traseras
  gAR.lineBetween(9, 9, 2, 7);
  gAR.lineBetween(9, 9, 16, 7);

  gAR.generateTexture('tex_ant_red', 18, 26);
  gAR.destroy();

  // 6. HORMIGA NEGRA GUERRERA (Compacta sobre el tronco)
  const gAB = scene.make.graphics({ x: 0, y: 0, add: false });
  gAB.fillStyle(0x212121, 1);
  gAB.fillEllipse(9, 6, 6.5, 8.5);
  gAB.fillStyle(0x111111, 1);
  gAB.fillEllipse(9, 14, 5, 6);
  gAB.fillStyle(0x000000, 1);
  gAB.fillCircle(9, 20, 5);

  gAB.fillStyle(0xffffff, 1);
  gAB.fillCircle(7.5, 19.5, 1.2);
  gAB.fillCircle(10.5, 19.5, 1.2);

  gAB.lineStyle(1.4, 0xffffff, 1);
  gAB.lineBetween(7.5, 23, 6, 26);
  gAB.lineBetween(10.5, 23, 12, 26);

  gAB.lineStyle(1.5, 0x424242, 1);
  gAB.lineBetween(9, 17, 2, 15);
  gAB.lineBetween(9, 17, 16, 15);
  gAB.lineBetween(9, 14, 1, 14);
  gAB.lineBetween(9, 14, 17, 14);
  gAB.lineBetween(9, 10, 2, 8);
  gAB.lineBetween(9, 10, 16, 8);

  gAB.generateTexture('tex_ant_black', 18, 27);
  gAB.destroy();

  // 7. HORMIGA DE FUEGO BALA (Compacta sobre el tronco)
  const gAF = scene.make.graphics({ x: 0, y: 0, add: false });
  gAF.fillStyle(0xff6d00, 1);
  gAF.fillEllipse(9, 6, 6, 8);
  gAF.fillStyle(0xdd2c00, 1);
  gAF.fillEllipse(9, 13, 4.5, 5.5);
  gAF.fillStyle(0xbf360c, 1);
  gAF.fillCircle(9, 19, 4.5);

  gAF.fillStyle(0xffff00, 1);
  gAF.fillCircle(7.5, 18.5, 1.2);
  gAF.fillCircle(10.5, 18.5, 1.2);

  gAF.lineStyle(1.5, 0xff9100, 1);
  gAF.lineBetween(9, 16, 2, 14);
  gAF.lineBetween(9, 16, 16, 14);
  gAF.lineBetween(9, 13, 1, 13);
  gAF.lineBetween(9, 13, 17, 13);
  gAF.lineBetween(9, 9, 2, 7);
  gAF.lineBetween(9, 9, 16, 7);

  gAF.generateTexture('tex_ant_fire', 18, 26);
  gAF.destroy();
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

  if (justPressed.RESET) {
    justPressed.RESET = false;
    startFreshGame();
    return;
  }

  // Menú principal
  if (gameState === STATE_MENU) {
    if (justPressed.START1 || justPressed.P1_U || held.P1_U) {
      justPressed.START1 = false;
      justPressed.P1_U = false;
      startFreshGame();
    }
    return;
  }

  // Pausa
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

  // Estado de Salto y Caída del Chamito
  if (gameState === STATE_DYING) {
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

  // Game Over
  if (gameState === STATE_GAMEOVER) {
    if (justPressed.START1 || justPressed.P1_U) {
      justPressed.START1 = false;
      justPressed.P1_U = false;
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
  scrollSpeed = 0.5;

  ants.forEach((a) => a.sprite.destroy());
  mangos.forEach((m) => m.sprite.destroy());
  floatingTexts.forEach((t) => t.destroy());
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
  chamito.sprite.setTexture('tex_chamito').setRotation(0).setPosition(chamito.x, chamito.y).setAlpha(1);

  gameState = STATE_PLAYING;
  centerMenuText.setVisible(false);
  sfx.startBGM();
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

  if (invulTimer > 0) {
    invulTimer -= dt;
    chamito.sprite.setAlpha(Math.floor(invulTimer * 12) % 2 === 0 ? 0.3 : 1.0);
  } else {
    chamito.sprite.setAlpha(1.0);
  }

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
  // Los metros aumentan rápido solo si el chamito trepa y se mantiene arriba
  const heightBoost = Math.max(0.1, (550 - chamito.y) / 320);
  const climbEffort = held.P1_U ? 3.8 : (held.P1_D ? 0.05 : 0.5);
  const effectiveClimb = climbEffort * heightBoost;

  altitude += effectiveClimb * dt * 1.6; // Ritmo realista de metros
  score += Math.round(effectiveClimb * dt * 3.5);

  if (altitude > bestAltitude) {
    bestAltitude = Math.floor(altitude);
  }

  // Spawn Hormigas justas y espaciadas
  antSpawnTimer += dt;
  const antInterval = Math.max(1.4, 3.0 - altitude * 0.0006);
  if (antSpawnTimer > antInterval) {
    antSpawnTimer = 0;
    spawnAnt();
  }

  // Spawn Mangos
  mangoSpawnTimer += dt;
  if (mangoSpawnTimer > 2.0) {
    mangoSpawnTimer = 0;
    spawnMango();
  }
}

// --- RENDER DEL FONDO DINÁMICO (BARRIO URBANO -> EL ÁVILA -> ALTA ATMÓSFERA -> ESPACIO PROFUNDO) ---
function renderDynamicBackground() {
  if (!bgGraphics) return;
  bgGraphics.clear();

  const alt = altitude;

  // 1. ZONA BARRIO VENEZOLANO (0 a 500 metros)
  // Al subir el chamito, el piso del patio y las casas descienden suavemente
  if (alt < 500) {
    const worldDownOffset = alt * 1.5;

    // Cielo diurno caraqueño
    bgGraphics.fillGradientStyle(0x1976d2, 0x1976d2, 0x64b5f6, 0x64b5f6, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Techos del barrio a lo lejos en las colinas (profundidad de fondo)
    bgGraphics.fillStyle(0xa93226, 0.6);
    for (let hx = 0; hx < GAME_WIDTH; hx += 70) {
      const hillY = 220 + worldDownOffset * 0.3;
      bgGraphics.fillRect(hx, hillY, 65, 80);
      bgGraphics.fillStyle(0x78909c, 0.7);
      bgGraphics.fillRect(hx - 3, hillY - 6, 71, 7);
      bgGraphics.fillStyle(0xa93226, 0.6);
    }

    // PISO FIRME DEL PATIO (Comienza exactamente en la parte inferior, SIN SUBTERRÁNEO)
    const groundY = 570 + worldDownOffset;
    if (groundY < GAME_HEIGHT + 100) {
      // Baldosas / Cemento del patio
      bgGraphics.fillStyle(0x546e7a, 1);
      bgGraphics.fillRect(0, groundY, GAME_WIDTH, GAME_HEIGHT - groundY);
      // Borde de grama y jardín
      bgGraphics.fillStyle(0x388e3c, 1);
      bgGraphics.fillRect(0, groundY - 6, GAME_WIDTH, 8);

      // Raíces gruesas de la mata de mango saliendo del piso
      bgGraphics.fillStyle(0x3e2723, 1);
      TRUNK_X.forEach((tx) => {
        bgGraphics.fillTriangle(tx - 20, groundY + 12, tx, groundY - 14, tx + 20, groundY + 12);
      });
    }

    // CASAS DEL BARRIO DE LADRILLOS ROJOS Y TECHOS DE ZINC (Sentadas firmes en el piso)
    const houseBaseY = 320 + worldDownOffset;
    if (houseBaseY < GAME_HEIGHT + 250 && houseBaseY > -300) {
      // Casa izquierda (Ladrillos rojos de arcilla)
      bgGraphics.fillStyle(0xb73a1e, 1);
      bgGraphics.fillRect(10, houseBaseY, 150, 240);

      // Líneas de cemento
      bgGraphics.lineStyle(1.2, 0x8d6e63, 0.7);
      for (let ly = houseBaseY + 16; ly < houseBaseY + 240; ly += 18) {
        bgGraphics.lineBetween(10, ly, 160, ly);
      }

      // Techo de zinc galvanizado
      bgGraphics.fillStyle(0x90a4ae, 1);
      bgGraphics.fillRect(5, houseBaseY - 10, 165, 14);
      bgGraphics.fillStyle(0x78909c, 1);
      for (let zx = 10; zx < 165; zx += 12) {
        bgGraphics.fillRect(zx, houseBaseY - 10, 5, 14);
      }

      // Tanque azul cilíndrico de agua
      bgGraphics.fillStyle(0x0277bd, 1);
      bgGraphics.fillRoundedRect(35, houseBaseY - 42, 38, 32, 4);
      bgGraphics.fillStyle(0x01579b, 1);
      bgGraphics.fillRect(32, houseBaseY - 45, 44, 6);

      // Casa derecha con platabanda
      bgGraphics.fillStyle(0xc0392b, 1);
      bgGraphics.fillRect(320, houseBaseY + 25, 150, 230);
      bgGraphics.lineStyle(1.2, 0x8d6e63, 0.7);
      for (let ly = houseBaseY + 40; ly < houseBaseY + 250; ly += 18) {
        bgGraphics.lineBetween(320, ly, 470, ly);
      }
      bgGraphics.fillStyle(0x90a4ae, 1);
      bgGraphics.fillRect(315, houseBaseY + 15, 160, 14);
      bgGraphics.fillStyle(0x0277bd, 1);
      bgGraphics.fillRoundedRect(350, houseBaseY - 17, 38, 32, 4);
      bgGraphics.fillStyle(0x01579b, 1);
      bgGraphics.fillRect(347, houseBaseY - 20, 44, 6);

      // Ventana con rejas y la DOÑA VENEZOLANA con rulos
      bgGraphics.fillStyle(0x212121, 1);
      bgGraphics.fillRect(45, houseBaseY + 45, 38, 42);
      bgGraphics.lineStyle(1.6, 0xffffff, 0.8);
      bgGraphics.lineBetween(54, houseBaseY + 45, 54, houseBaseY + 87);
      bgGraphics.lineBetween(64, houseBaseY + 45, 64, houseBaseY + 87);
      bgGraphics.lineBetween(74, houseBaseY + 45, 74, houseBaseY + 87);
      bgGraphics.fillStyle(0xd7a17c, 1);
      bgGraphics.fillCircle(64, houseBaseY + 63, 8);
      bgGraphics.fillStyle(0xf06292, 1); // Rulos rosados
      bgGraphics.fillCircle(58, houseBaseY + 56, 3.5);
      bgGraphics.fillCircle(64, houseBaseY + 54, 3.5);
      bgGraphics.fillCircle(70, houseBaseY + 56, 3.5);
      bgGraphics.fillStyle(0xffd54f, 1); // Bata
      bgGraphics.fillRect(56, houseBaseY + 71, 16, 16);

      // Cables de luz
      bgGraphics.lineStyle(1.4, 0x212121, 0.7);
      bgGraphics.lineBetween(0, houseBaseY + 15, GAME_WIDTH, houseBaseY + 55);
      bgGraphics.lineBetween(0, houseBaseY + 30, GAME_WIDTH, houseBaseY + 70);

      // Tendedero de ropa con franela tricolor
      bgGraphics.lineStyle(1, 0xffffff, 0.6);
      bgGraphics.lineBetween(170, houseBaseY + 75, 310, houseBaseY + 90);
      bgGraphics.fillStyle(0xffd600, 1);
      bgGraphics.fillRect(200, houseBaseY + 79, 14, 16);
      bgGraphics.fillStyle(0x1565c0, 1);
      bgGraphics.fillRect(230, houseBaseY + 83, 14, 16);
      bgGraphics.fillStyle(0xd32f2f, 1);
      bgGraphics.fillRect(260, houseBaseY + 87, 14, 16);
    }
  }
  // 2. ZONA EL ÁVILA Y CIELO CARAQUEÑO (500 a 1200 metros)
  else if (alt < 1200) {
    const p = (alt - 500) / 700;
    // Transición gradual de azul claro a naranja atardecer
    bgGraphics.fillGradientStyle(0x1565c0, 0x1565c0, 0xe65100, 0xf57c00, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Silueta imponente y verde del Cerro El Ávila
    const avilaY = 340 + ((alt - 500) * 0.4);
    bgGraphics.fillStyle(0x0e3d1c, 0.95);
    bgGraphics.beginPath();
    bgGraphics.moveTo(0, avilaY + 90);
    bgGraphics.lineTo(110, avilaY - 30);
    bgGraphics.lineTo(240, avilaY + 20);
    bgGraphics.lineTo(360, avilaY - 70);
    bgGraphics.lineTo(480, avilaY - 10);
    bgGraphics.lineTo(480, GAME_HEIGHT);
    bgGraphics.lineTo(0, GAME_HEIGHT);
    bgGraphics.closePath();
    bgGraphics.fillPath();

    // Nubes
    bgGraphics.fillStyle(0xffffff, 0.35);
    bgGraphics.fillCircle(80, 130, 45);
    bgGraphics.fillCircle(125, 130, 55);
    bgGraphics.fillCircle(170, 130, 40);
    bgGraphics.fillCircle(340, 170, 40);
    bgGraphics.fillCircle(380, 170, 50);
  }
  // 3. ZONA ALTA ATMÓSFERA Y SATÉLITE SIMÓN BOLÍVAR (1200 a 2000 metros)
  else if (alt < 2000) {
    bgGraphics.fillGradientStyle(0x020813, 0x020813, 0x0a1a33, 0x0a1a33, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Estrellas
    bgGraphics.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 35; i++) {
      const sx = ((i * 73) % GAME_WIDTH);
      const sy = (((i * 97) + alt * 0.3) % GAME_HEIGHT);
      bgGraphics.fillCircle(sx, sy, (i % 3 === 0 ? 2 : 1.2));
    }

    // Curvatura de la Tierra
    bgGraphics.fillStyle(0x1565c0, 0.7);
    bgGraphics.beginPath();
    bgGraphics.arc(240, 930, 390, Math.PI, 0, false);
    bgGraphics.fillPath();

    // Satélite Simón Bolívar orbitando
    const satY = ((alt * 0.3) % 450) + 90;
    bgGraphics.fillStyle(0xffd700, 1);
    bgGraphics.fillRect(360, satY, 22, 16);
    bgGraphics.fillStyle(0x0288d1, 1);
    bgGraphics.fillRect(328, satY + 4, 28, 8);
    bgGraphics.fillRect(386, satY + 4, 28, 8);
    bgGraphics.lineStyle(1.5, 0xffffff, 1);
    bgGraphics.lineBetween(371, satY, 371, satY - 8);
    bgGraphics.strokeCircle(371, satY - 10, 4);
  }
  // 4. ZONA ESPACIO PROFUNDO Y AGUJERO NEGRO (2000m+)
  else {
    bgGraphics.fillGradientStyle(0x000000, 0x000000, 0x140526, 0x140526, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Nebulosa violeta y cian
    bgGraphics.fillStyle(0x8e24aa, 0.28);
    bgGraphics.fillCircle(140, 260, 130);
    bgGraphics.fillStyle(0x00bcd4, 0.22);
    bgGraphics.fillCircle(340, 360, 110);

    // Estrellas
    bgGraphics.fillStyle(0xffffff, 0.95);
    for (let i = 0; i < 50; i++) {
      const sx = ((i * 67) % GAME_WIDTH);
      const sy = (((i * 89) + alt * 0.25) % GAME_HEIGHT);
      bgGraphics.fillCircle(sx, sy, (i % 4 === 0 ? 2.5 : 1.2));
    }

    // Agujero negro giratorio
    bgGraphics.lineStyle(4, 0xffa000, 0.85);
    bgGraphics.strokeEllipse(240, 190, 75, 24);
    bgGraphics.lineStyle(2, 0xffffff, 0.9);
    bgGraphics.strokeEllipse(240, 190, 85, 28);
    bgGraphics.fillStyle(0x000000, 1);
    bgGraphics.fillCircle(240, 190, 22);
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
  const tIdx = Math.floor(Math.random() * NUM_TRUNKS);
  const side = Math.random() < 0.5 ? -1 : 1;
  const r = Math.random();
  let tex = 'tex_ant_red';
  let speed = 65 + altitude * 0.03;

  if (altitude > 200 && r > 0.65) {
    tex = 'tex_ant_black';
    speed *= 1.25;
  } else if (altitude > 400 && r < 0.25) {
    tex = 'tex_ant_fire';
    speed *= 1.45;
  }

  // Posicionada 100% sobre el tronco (ancho tronco = 28px, hormiga = 18px)
  // Las 6 patitas quedan perfectamente sobre la madera del árbol!
  const antX = TRUNK_X[tIdx] + side * 5;
  const sprite = currentScene.add.sprite(antX, -25, tex).setDepth(15);
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
    a.sprite.y += (a.speed + scrollSpeed * 15) * dt;

    // Colisión con el chamito
    const dy = Math.abs(a.sprite.y - chamito.y);
    const dx = Math.abs(a.sprite.x - chamito.x);

    if (a.tIdx === chamito.trunk && a.side === chamito.side && dy < 30 && dx < 24) {
      if (superTimer > 0) {
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
    m.sprite.y += (40 + scrollSpeed * 18) * dt;

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
  chamito.deathVy = -9.0;
  chamito.deathVx = chamito.side === 1 ? 3.5 : -3.5;
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
  for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️' : '🖤';
  hudTexts.lives.setText(hearts);
  hudTexts.mangos.setText(`${mangosCount} 🥭`);
  hudTexts.altitude.setText(`${Math.floor(altitude)}m`);
  if (superTimer > 0) {
    hudTexts.score.setText(`${score} ★`);
    hudTexts.score.setColor('#ffe600');
  } else {
    hudTexts.score.setText(`${score}`);
    hudTexts.score.setColor('#ffffff');
  }
}

function showMenuUI(visible) {
  if (visible) {
    centerMenuText.setText(
      'CHAMITO\n★ LA MATA DE MANGO ★\n\nEsquiva las hormigas\ny agarra los mangos\n\nPresiona ENTER o W / ↑\npara jugar'
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
