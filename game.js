// Platanus Hack 26 — Caracas Arcade Edition
// CHAMITO VERGATARIO: LA MATA DE MANGO
// Recreación en Phaser 3 del clásico juego de los celulares Vergatarios en Venezuela

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

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

// --- Audio Sintetizado (Web Audio API sin archivos externos) ---
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
    this.playTone(300, 'sine', 0.1, 0.22, 580);
  }

  munch() {
    this.playTone(580, 'square', 0.09, 0.18, 920);
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
    this.playTone(400, 'sine', 0.15, 0.35, 820);
    setTimeout(() => {
      this.playTone(680, 'sawtooth', 0.65, 0.3, 65);
    }, 140);
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
const TRUNK_X = [260, 350, 450, 540]; // 4 Troncos de la mata de mango en el centro
const OFFSET_X = 22; // Distancia a la izq o der del tronco

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
let superTimer = 0;
let invulTimer = 0;
let scrollSpeed = 2.0;

// Objeto del Chamito (Jugador único)
let chamito = {
  trunk: 1,
  side: 1,
  x: TRUNK_X[1] + OFFSET_X,
  targetX: TRUNK_X[1] + OFFSET_X,
  y: 430,
  targetY: 430,
  sprite: null,
  isDying: false,
  deathVx: 0,
  deathVy: 0,
};

let ants = [];
let mangos = [];
let antSpawnTimer = 0;
let mangoSpawnTimer = 0;

let uiTexts = {};

function create() {
  currentScene = this;
  sfx = new ArcadeAudio(this.sound);

  // Cargar High Score previo
  getStorage().get('chamito_high_score').then((res) => {
    if (res.found && typeof res.value === 'number') {
      highScore = res.value;
      if (uiTexts.high) uiTexts.high.setText(`${highScore}`);
    }
  });

  // Generar texturas de forma 100% procedimental
  generateProceduralTextures(this);

  // 1. Fondo del patio venezolano / El Ávila
  this.add.rectangle(400, 300, 800, 600, 0x071e11);
  drawBackdrop(this);

  // 2. Los 4 Troncos de la Mata de Mango
  drawMangoTrees(this);

  // 3. Sprite del Chamito
  chamito.sprite = this.add.sprite(chamito.x, chamito.y, 'tex_chamito').setDepth(20);

  // 4. Grupo de HUD y Paneles laterales estilo CRT
  createArcadeHUD(this);

  // 5. Capa CRT y Viñeta
  drawCRTFilter(this);

  // Inicializar estado del menú
  showMenuUI(true);
}

// --- GENERACIÓN DE TEXTURAS PROCEDURALES (CERO ASSETS EXTERNOS) ---
function generateProceduralTextures(scene) {
  // 1. Chamito (Niño venezolano con morral tricolor)
  const gC = scene.make.graphics({ x: 0, y: 0, add: false });
  
  // Piernas y shorts azul escolar
  gC.fillStyle(0x1a237e, 1);
  gC.fillRect(10, 26, 6, 12);
  gC.fillRect(18, 26, 6, 12);
  // Zapatitos marrones
  gC.fillStyle(0x3e2723, 1);
  gC.fillRect(9, 36, 7, 5);
  gC.fillRect(18, 36, 7, 5);

  // Torso / Camisa escolar beige/clara
  gC.fillStyle(0xf5f5f5, 1);
  gC.fillRoundedRect(9, 15, 16, 13, 3);

  // Morral tricolor en la espalda (amarillo, azul con estrellas, rojo)
  gC.fillStyle(0xffd600, 1); // Franja Amarilla
  gC.fillRect(1, 16, 8, 4);
  gC.fillStyle(0x1565c0, 1); // Franja Azul
  gC.fillRect(1, 20, 8, 4);
  // Estrellitas en el azul
  gC.fillStyle(0xffffff, 1);
  gC.fillRect(3, 21, 1.5, 1.5);
  gC.fillRect(6, 21, 1.5, 1.5);
  gC.fillStyle(0xd32f2f, 1); // Franja Roja
  gC.fillRect(1, 24, 8, 4);

  // Brazos agarrando el tronco
  gC.fillStyle(0xd7a17c, 1);
  gC.fillCircle(24, 18, 4);
  gC.fillCircle(24, 25, 4);

  // Cuello y Cabeza del Chamito
  gC.fillStyle(0xd7a17c, 1);
  gC.fillCircle(17, 10, 8);
  // Cabello negro ondulado
  gC.fillStyle(0x212121, 1);
  gC.fillCircle(16, 6, 7);
  gC.fillCircle(20, 7, 5);
  gC.fillCircle(12, 8, 5);

  // Oreja
  gC.fillStyle(0xd7a17c, 1);
  gC.fillCircle(10, 10, 2.5);

  // Ojo alegre
  gC.fillStyle(0xffffff, 1);
  gC.fillCircle(19, 9, 2.5);
  gC.fillStyle(0x000000, 1);
  gC.fillCircle(20, 9, 1.4);

  // Sonrisa
  gC.lineStyle(1.4, 0x5d4037, 1);
  gC.beginPath();
  gC.arc(19, 13, 2.5, 0.2, Math.PI * 0.9, false);
  gC.strokePath();

  gC.generateTexture('tex_chamito', 36, 44);
  gC.destroy();

  // 2. Chamito golpeado / cayendo (Ojos X X, boca O)
  const gCH = scene.make.graphics({ x: 0, y: 0, add: false });
  gCH.fillStyle(0x1a237e, 1);
  gCH.fillRect(10, 26, 6, 12);
  gCH.fillRect(18, 26, 6, 12);
  gCH.fillStyle(0x3e2723, 1);
  gCH.fillRect(9, 36, 7, 5);
  gCH.fillRect(18, 36, 7, 5);

  gCH.fillStyle(0xf5f5f5, 1);
  gCH.fillRoundedRect(9, 15, 16, 13, 3);

  // Morral tricolor
  gCH.fillStyle(0xffd600, 1);
  gCH.fillRect(1, 16, 8, 4);
  gCH.fillStyle(0x1565c0, 1);
  gCH.fillRect(1, 20, 8, 4);
  gCH.fillStyle(0xffffff, 1);
  gCH.fillRect(3, 21, 1.5, 1.5);
  gCH.fillRect(6, 21, 1.5, 1.5);
  gCH.fillStyle(0xd32f2f, 1);
  gCH.fillRect(1, 24, 8, 4);

  // Brazos abiertos por la caída
  gCH.fillStyle(0xd7a17c, 1);
  gCH.fillCircle(25, 15, 4);
  gCH.fillCircle(7, 15, 4);

  // Cabeza
  gCH.fillStyle(0xd7a17c, 1);
  gCH.fillCircle(17, 10, 8);
  gCH.fillStyle(0x212121, 1);
  gCH.fillCircle(16, 6, 7);
  gCH.fillCircle(20, 7, 5);
  gCH.fillCircle(12, 8, 5);

  // Ojos X X
  gCH.lineStyle(1.8, 0x000000, 1);
  gCH.beginPath();
  gCH.moveTo(13, 7); gCH.lineTo(17, 11);
  gCH.moveTo(17, 7); gCH.lineTo(13, 11);
  gCH.moveTo(18, 7); gCH.lineTo(22, 11);
  gCH.moveTo(22, 7); gCH.lineTo(18, 11);
  gCH.strokePath();

  // Boca abierta "O"
  gCH.fillStyle(0x3e2723, 1);
  gCH.fillCircle(17, 14, 2.5);

  gCH.generateTexture('tex_chamito_hurt', 36, 44);
  gCH.destroy();

  // 3. Mango Criollo Maduro (Rojo, Amarillo, Verde)
  const gM = scene.make.graphics({ x: 0, y: 0, add: false });
  // Cuerpo del mango con curva criolla
  gM.fillStyle(0x7cb342, 1); // Toque verde
  gM.fillEllipse(9, 13, 8, 11);
  gM.fillStyle(0xffb300, 1); // Amarillo pulpa
  gM.fillEllipse(12, 13, 10, 12);
  gM.fillStyle(0xd32f2f, 0.9); // Chapa roja del sol
  gM.fillEllipse(15, 13, 7, 10);

  // Tallito marrón y hojita verde
  gM.fillStyle(0x5d4037, 1);
  gM.fillRect(11, 2, 2, 4);
  gM.fillStyle(0x2e7d32, 1);
  gM.fillTriangle(13, 3, 20, 1, 16, 6);

  gM.generateTexture('tex_mango', 24, 26);
  gM.destroy();

  // 4. Mango de Oro (Super Mango invencible)
  const gMG = scene.make.graphics({ x: 0, y: 0, add: false });
  gMG.fillStyle(0xffd700, 1);
  gMG.fillCircle(12, 12, 11);
  gMG.fillStyle(0xffea00, 1);
  gMG.fillCircle(12, 12, 8);
  gMG.fillStyle(0xffffff, 1);
  gMG.fillCircle(9, 8, 3.5);
  // Brillo
  gMG.lineStyle(1.5, 0xffffff, 1);
  gMG.beginPath();
  gMG.moveTo(12, 1); gMG.lineTo(12, 5);
  gMG.moveTo(12, 19); gMG.lineTo(12, 23);
  gMG.moveTo(1, 12); gMG.lineTo(5, 12);
  gMG.moveTo(19, 12); gMG.lineTo(23, 12);
  gMG.strokePath();

  gMG.generateTexture('tex_mango_gold', 24, 24);
  gMG.destroy();

  // 5. Hormiga Roja Caraqueña
  const gAR = scene.make.graphics({ x: 0, y: 0, add: false });
  gAR.fillStyle(0xd32f2f, 1);
  gAR.fillEllipse(10, 6, 7, 10); // Abdomen
  gAR.fillEllipse(10, 13, 5, 6);  // Tórax
  gAR.fillStyle(0xb71c1c, 1);
  gAR.fillCircle(10, 19, 4.5);   // Cabeza
  gAR.lineStyle(1.4, 0xd32f2f, 1);
  gAR.beginPath();
  gAR.moveTo(4, 9); gAR.lineTo(16, 9);
  gAR.moveTo(3, 13); gAR.lineTo(17, 13);
  gAR.moveTo(4, 17); gAR.lineTo(16, 17);
  gAR.strokePath();
  gAR.generateTexture('tex_ant_red', 20, 26);
  gAR.destroy();

  // 6. Hormiga Negra Guerrera
  const gAB = scene.make.graphics({ x: 0, y: 0, add: false });
  gAB.fillStyle(0x212121, 1);
  gAB.fillEllipse(11, 7, 8, 11);
  gAB.fillEllipse(11, 14, 6, 7);
  gAB.fillStyle(0x000000, 1);
  gAB.fillCircle(11, 21, 5);
  gAB.lineStyle(1.5, 0x424242, 1);
  gAB.beginPath();
  gAB.moveTo(3, 10); gAB.lineTo(19, 10);
  gAB.moveTo(2, 14); gAB.lineTo(20, 14);
  gAB.moveTo(3, 19); gAB.lineTo(19, 19);
  gAB.strokePath();
  gAB.generateTexture('tex_ant_black', 22, 28);
  gAB.destroy();

  // 7. Hormiga de Fuego Bala
  const gAF = scene.make.graphics({ x: 0, y: 0, add: false });
  gAF.fillStyle(0xff6d00, 1);
  gAF.fillEllipse(10, 6, 7, 10);
  gAF.fillEllipse(10, 13, 5, 6);
  gAF.fillStyle(0xdd2c00, 1);
  gAF.fillCircle(10, 19, 4.5);
  gAF.lineStyle(1.4, 0xff9100, 1);
  gAF.beginPath();
  gAF.moveTo(4, 9); gAF.lineTo(16, 9);
  gAF.moveTo(3, 13); gAF.lineTo(17, 13);
  gAF.moveTo(4, 17); gAF.lineTo(16, 17);
  gAF.strokePath();
  gAF.generateTexture('tex_ant_fire', 20, 26);
  gAF.destroy();
}

// --- ESCENARIO DE LA MATA DE MANGO Y PATIO VENEZOLANO ---
function drawBackdrop(scene) {
  const g = scene.add.graphics().setDepth(1);

  // Silueta del Ávila y montañas al atardecer
  g.fillStyle(0x0b2915, 0.7);
  g.beginPath();
  g.moveTo(0, 380);
  g.lineTo(180, 260);
  g.lineTo(340, 310);
  g.lineTo(520, 240);
  g.lineTo(700, 290);
  g.lineTo(800, 270);
  g.lineTo(800, 600);
  g.lineTo(0, 600);
  g.closePath();
  g.fillPath();

  // Casas de barrio lejanas con techos de zinc y tanques azules
  g.fillStyle(0xa04020, 0.75); // Ladrillo
  g.fillRect(50, 480, 70, 60);
  g.fillRect(140, 460, 65, 75);
  g.fillRect(610, 470, 75, 70);
  g.fillRect(700, 490, 60, 50);

  // Techos de zinc
  g.fillStyle(0x78909c, 0.9);
  g.fillRect(45, 474, 80, 7);
  g.fillRect(135, 454, 75, 7);
  g.fillRect(605, 464, 85, 7);
  g.fillRect(695, 484, 70, 7);

  // Tanque azul en el techo
  g.fillStyle(0x0277bd, 0.95);
  g.fillRoundedRect(165, 436, 22, 18, 3);
  g.fillRoundedRect(635, 446, 22, 18, 3);

  // Follaje superior de la gran mata de mango
  g.fillStyle(0x1b5e20, 0.85);
  g.fillCircle(120, 40, 110);
  g.fillCircle(280, 20, 130);
  g.fillCircle(520, 25, 130);
  g.fillCircle(680, 40, 110);

  g.fillStyle(0x2e7d32, 0.75);
  g.fillCircle(200, 60, 90);
  g.fillCircle(600, 60, 90);
}

function drawMangoTrees(scene) {
  const g = scene.add.graphics().setDepth(5);
  const trunkWidth = 24;

  TRUNK_X.forEach((tx) => {
    // Sombra del tronco
    g.fillStyle(0x010803, 0.45);
    g.fillRect(tx - trunkWidth / 2 + 4, 0, trunkWidth, GAME_HEIGHT);

    // Tronco de madera de mango cálido
    g.fillStyle(0x4e3629, 1);
    g.fillRect(tx - trunkWidth / 2, 0, trunkWidth, GAME_HEIGHT);

    // Textura de corteza y vetas
    g.fillStyle(0x6d4c41, 1);
    g.fillRect(tx - trunkWidth / 2 + 3, 0, 8, GAME_HEIGHT);

    g.fillStyle(0x8d6e63, 0.9);
    g.fillRect(tx - trunkWidth / 2 + 5, 0, 3, GAME_HEIGHT);

    // Nudos de la corteza y ramitas con hojas
    g.fillStyle(0x3e2723, 1);
    g.lineStyle(2, 0x8d6e63, 0.8);
    for (let y = 40; y < GAME_HEIGHT; y += 80) {
      g.fillEllipse(tx, y, trunkWidth + 4, 6);
      g.strokeEllipse(tx, y, trunkWidth + 4, 6);
    }

    // Ramitas con hojitas verdes saliendo de los lados
    g.fillStyle(0x2e7d32, 0.9);
    for (let y = 90; y < GAME_HEIGHT; y += 140) {
      g.fillTriangle(tx + 12, y, tx + 24, y - 4, tx + 20, y + 4);
      g.fillTriangle(tx - 12, y + 60, tx - 24, y + 56, tx - 20, y + 64);
    }
  });
}

// --- HUD Y PANELES CRT LATERALES IDÉNTICOS AL ORIGINAL ---
function createArcadeHUD(scene) {
  const fontStyle = { fontFamily: 'monospace', fontSize: '13px', color: '#39ff6e' };
  const titleStyle = { fontFamily: 'monospace', fontSize: '12px', color: '#ffe600', fontStyle: 'bold' };

  // Marco izquierdo de estadísticas
  const gL = scene.add.graphics().setDepth(25);
  gL.fillStyle(0x021107, 0.88);
  gL.lineStyle(2, 0x1fa347, 1);
  gL.fillRoundedRect(16, 16, 190, 568, 8);
  gL.strokeRoundedRect(16, 16, 190, 568, 8);

  scene.add.text(111, 36, 'ESTADÍSTICAS', titleStyle).setOrigin(0.5).setDepth(26);
  scene.add.text(28, 70, 'VIDAS:', fontStyle).setDepth(26);
  uiTexts.lives = scene.add.text(28, 92, '❤️❤️❤️', { fontSize: '16px' }).setDepth(26);

  scene.add.text(28, 135, 'MANGOS:', fontStyle).setDepth(26);
  uiTexts.mangos = scene.add.text(28, 155, '0 🥭', { fontFamily: 'monospace', fontSize: '15px', color: '#ffe600', fontStyle: 'bold' }).setDepth(26);

  scene.add.text(28, 200, 'ALTURA:', fontStyle).setDepth(26);
  uiTexts.altitude = scene.add.text(28, 220, '0 m', { fontFamily: 'monospace', fontSize: '15px', color: '#9affb6' }).setDepth(26);

  scene.add.text(28, 265, 'PUNTAJE:', fontStyle).setDepth(26);
  uiTexts.score = scene.add.text(28, 285, '0', { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff', fontStyle: 'bold' }).setDepth(26);

  scene.add.text(28, 340, 'RÉCORD:', fontStyle).setDepth(26);
  uiTexts.high = scene.add.text(28, 360, '0', { fontFamily: 'monospace', fontSize: '15px', color: '#ffe600' }).setDepth(26);

  // Marco derecho de controles
  const gR = scene.add.graphics().setDepth(25);
  gR.fillStyle(0x021107, 0.88);
  gR.lineStyle(2, 0x1fa347, 1);
  gR.fillRoundedRect(594, 16, 190, 568, 8);
  gR.strokeRoundedRect(594, 16, 190, 568, 8);

  scene.add.text(689, 36, 'CONTROLES', titleStyle).setOrigin(0.5).setDepth(26);
  const helpLines = [
    'W / ↑ :', 'Trepar rápido',
    '',
    'S / ↓ :', 'Deslizarse',
    '',
    'A / ← :', 'Izq / Cambiar',
    '',
    'D / → :', 'Der / Cambiar',
    '',
    'P :', 'Pausa',
    '',
    'R :', 'Reiniciar 0',
  ];
  let hy = 70;
  for (let i = 0; i < helpLines.length; i += 2) {
    scene.add.text(606, hy, helpLines[i], { fontFamily: 'monospace', fontSize: '11px', color: '#ffe600', fontStyle: 'bold' }).setDepth(26);
    scene.add.text(606, hy + 16, helpLines[i + 1], { fontFamily: 'monospace', fontSize: '10px', color: '#9affb6' }).setDepth(26);
    hy += 42;
  }

  // Título superior central
  uiTexts.titleHeader = scene.add.text(400, 24, 'CHAMITO VERGATARIO', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#ffe600',
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(26);

  // Mensaje de estado central (Inicio / Pausa / Game Over)
  uiTexts.centerBox = scene.add.text(400, 290, '', {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#ffe600',
    align: 'center',
    backgroundColor: '#021107',
    padding: { x: 20, y: 15 },
  }).setOrigin(0.5).setDepth(40).setVisible(false);
}

function drawCRTFilter(scene) {
  const g = scene.add.graphics().setDepth(99);
  // Scanlines horizontales
  g.lineStyle(1, 0x000000, 0.35);
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
      uiTexts.centerBox.setText('PAUSA\n\nPresiona P para seguir\nR para reiniciar').setVisible(true);
      return;
    } else if (gameState === STATE_PAUSED) {
      gameState = STATE_PLAYING;
      uiTexts.centerBox.setVisible(false);
      return;
    }
  }

  if (gameState === STATE_PAUSED) return;

  // Estado de Salto y Caída del Chamito (Al morir)
  if (gameState === STATE_DYING) {
    chamito.deathVy += 24 * dt; // Gravedad
    chamito.y += chamito.deathVy;
    chamito.x += chamito.deathVx;
    chamito.sprite.setRotation(chamito.sprite.rotation + (chamito.deathVx > 0 ? 8 : -8) * dt);
    chamito.sprite.setPosition(chamito.x, chamito.y);

    if (chamito.y > GAME_HEIGHT + 70) {
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

  // --- JUEGO EN EJECUCIÓN (STATE_PLAYING) ---
  handlePlayerInput(dt);
  updateWorldProgress(dt);
  updateAnts(dt);
  updateMangos(dt);
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
  ants = [];
  mangos = [];

  // Reset del chamito
  chamito.trunk = 1;
  chamito.side = 1;
  chamito.x = TRUNK_X[1] + OFFSET_X;
  chamito.targetX = chamito.x;
  chamito.y = 430;
  chamito.targetY = 430;
  chamito.isDying = false;
  chamito.deathVx = 0;
  chamito.deathVy = 0;
  chamito.sprite.setTexture('tex_chamito').setRotation(0).setPosition(chamito.x, chamito.y).setAlpha(1);

  gameState = STATE_PLAYING;
  uiTexts.centerBox.setVisible(false);
  sfx.startBGM();
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
    scrollSpeed = 3.6;
    chamito.targetY = Math.max(160, chamito.targetY - 140 * dt);
  } else if (held.P1_D) {
    scrollSpeed = 1.0;
    chamito.targetY = Math.min(500, chamito.targetY + 180 * dt);
  } else {
    scrollSpeed = 2.2;
    chamito.targetY += (430 - chamito.targetY) * 0.08;
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
  altitude += scrollSpeed * dt * 8;
  score += Math.round(scrollSpeed * 0.6);

  // Spawn Hormigas
  antSpawnTimer += dt;
  const antInterval = Math.max(0.65, 1.7 - altitude * 0.0015);
  if (antSpawnTimer > antInterval) {
    antSpawnTimer = 0;
    spawnAnt();
  }

  // Spawn Mangos
  mangoSpawnTimer += dt;
  if (mangoSpawnTimer > 1.25) {
    mangoSpawnTimer = 0;
    spawnMango();
  }
}

function spawnAnt() {
  if (!currentScene) return;
  const tIdx = Math.floor(Math.random() * NUM_TRUNKS);
  const side = Math.random() < 0.5 ? -1 : 1;
  const r = Math.random();
  let tex = 'tex_ant_red';
  let speed = 120 + altitude * 0.15;

  if (altitude > 150 && r > 0.65) {
    tex = 'tex_ant_black';
    speed *= 1.35;
  } else if (altitude > 300 && r < 0.25) {
    tex = 'tex_ant_fire';
    speed *= 1.7;
  }

  const sprite = currentScene.add.sprite(TRUNK_X[tIdx] + side * (OFFSET_X - 5), -20, tex).setDepth(15);
  ants.push({ tIdx, side, speed, sprite });
}

function spawnMango() {
  if (!currentScene) return;
  const tIdx = Math.floor(Math.random() * NUM_TRUNKS);
  const side = Math.random() < 0.5 ? -1 : 1;
  const isGold = Math.random() < 0.08 && superTimer <= 0;
  const tex = isGold ? 'tex_mango_gold' : 'tex_mango';

  const sprite = currentScene.add.sprite(TRUNK_X[tIdx] + side * OFFSET_X, -20, tex).setDepth(12);
  mangos.push({ tIdx, side, isGold, sprite });
}

function updateAnts(dt) {
  for (let i = ants.length - 1; i >= 0; i--) {
    const a = ants[i];
    a.sprite.y += (a.speed + scrollSpeed * 25) * dt;

    // Colisión con el chamito
    const dy = Math.abs(a.sprite.y - chamito.y);
    const dx = Math.abs(a.sprite.x - chamito.x);

    if (a.tIdx === chamito.trunk && a.side === chamito.side && dy < 28 && dx < 24) {
      if (superTimer > 0) {
        // Super Chamito aplasta hormiga
        sfx.smash();
        score += 50;
        a.sprite.destroy();
        ants.splice(i, 1);
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

    if (a.sprite.y > GAME_HEIGHT + 30) {
      a.sprite.destroy();
      ants.splice(i, 1);
    }
  }
}

function updateMangos(dt) {
  for (let i = mangos.length - 1; i >= 0; i--) {
    const m = mangos[i];
    m.sprite.y += scrollSpeed * 45 * dt;

    const dy = Math.abs(m.sprite.y - chamito.y);
    const dx = Math.abs(m.sprite.x - chamito.x);

    if (m.tIdx === chamito.trunk && m.side === chamito.side && dy < 30 && dx < 24) {
      mangosCount++;
      if (m.isGold) {
        sfx.golden();
        superTimer = 7.0;
        score += 150;
      } else {
        sfx.munch();
        score += 20;
      }
      m.sprite.destroy();
      mangos.splice(i, 1);
      continue;
    }

    if (m.sprite.y > GAME_HEIGHT + 30) {
      m.sprite.destroy();
      mangos.splice(i, 1);
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

  uiTexts.centerBox.setText(
    `¡FIN DEL JUEGO!\n\nPUNTAJE: ${score}\nMANGOS: ${mangosCount}\nALTURA: ${Math.floor(altitude)}m\n\nPresiona ENTER o R\npara jugar de nuevo`
  ).setVisible(true);
}

function updateHUD() {
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️ ' : '🖤 ';
  uiTexts.lives.setText(hearts);
  uiTexts.mangos.setText(`${mangosCount} 🥭`);
  uiTexts.altitude.setText(`${Math.floor(altitude)} m`);
  uiTexts.score.setText(`${score}`);
  uiTexts.high.setText(`${highScore}`);
}

function showMenuUI(visible) {
  if (visible) {
    uiTexts.centerBox.setText(
      'CHAMITO VERGATARIO\n★ LA MATA DE MANGO ★\n\nEsquiva las hormigas\ny agarra los mangos\n\nPresiona ENTER o W\npara jugar'
    ).setVisible(true);
  }
}
