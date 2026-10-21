// Platanus Hack 26 — Caracas Arcade Edition
// MONO VERGATARIO: 4 BAMBÚS
// Recreación en Phaser 3 del clásico juego de celular venezolano

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// Mapeo obligatorio de controles para el mueble arcade físico.
// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
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
  // Atajo directo para reiniciar con R
  if (norm === 'r') {
    justPressed.RESET = true;
  }
});

window.addEventListener('keyup', (e) => {
  const norm = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = KEYBOARD_TO_ARCADE[norm];
  if (code) held[code] = false;
});

// --- Almacenamiento persistente (Platanus Arcade Storage o LocalStorage) ---
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
    this.playTone(280, 'sine', 0.1, 0.2, 560);
  }

  munch() {
    this.playTone(620, 'square', 0.08, 0.15, 950);
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

  monkeyFall() {
    // Salto cómico sorprendido hacia arriba y silbido descendente al caer del bambú
    this.playTone(380, 'sine', 0.15, 0.35, 780);
    setTimeout(() => {
      this.playTone(640, 'sawtooth', 0.65, 0.3, 70);
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
        this.playTone(bass[this.bgmStep % bass.length], 'triangle', 0.1, 0.06);
        if (this.bgmStep % 2 === 0) {
          this.playTone(lead[(this.bgmStep / 2) % lead.length], 'square', 0.08, 0.035);
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
const NUM_BAMBOOS = 4;
const BAMBOO_X = [260, 350, 450, 540]; // 4 Bambús en el centro de la pantalla arcade
const OFFSET_X = 22; // Distancia a la izq o der del tallo

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
  backgroundColor: '#030f07',
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

let sfx;
let gameState = STATE_MENU;
let score = 0;
let bananasCount = 0;
let lives = 3;
let altitude = 0;
let highScore = 0;
let superTimer = 0;
let invulTimer = 0;
let combo = 0;
let comboTimer = 0;
let scrollSpeed = 2.0;

// Objetos del juego
let monkey = {
  bamboo: 1,
  side: 1,
  x: BAMBOO_X[1] + OFFSET_X,
  targetX: BAMBOO_X[1] + OFFSET_X,
  y: 430,
  targetY: 430,
  sprite: null,
  isDying: false,
  deathVx: 0,
  deathVy: 0,
  animTick: 0,
};

let ants = [];
let bananas = [];
let particles = [];
let antSpawnTimer = 0;
let bananaSpawnTimer = 0;

// Referencias visuales de la UI
let uiTexts = {};
let overlayGraphics;
let bgTileGraphics;

function create() {
  sfx = new ArcadeAudio(this.sound);

  // Cargar High Score previo
  getStorage().get('mono_high_score').then((res) => {
    if (res.found && typeof res.value === 'number') {
      highScore = res.value;
    }
  });

  // Generar texturas de forma 100% procedimental con Phaser Graphics
  generateProceduralTextures(this);

  // 1. Fondo de Selva
  this.add.rectangle(400, 300, 800, 600, 0x051b0e);
  drawJungleBackdrop(this);

  // 2. Los 4 Bambús
  drawBamboos(this);

  // 3. Sprite del Mono
  monkey.sprite = this.add.sprite(monkey.x, monkey.y, 'tex_monkey').setDepth(20);

  // 4. Grupo de HUD y Paneles laterales estilo CRT
  createArcadeHUD(this);

  // 5. Capa CRT y Viñeta
  drawCRTFilter(this);

  // Inicializar estado del menú
  showMenuUI(true);
}

// --- GENERACIÓN DE TEXTURAS PROCEDURALES (CERO ASSETS EXTERNOS) ---
function generateProceduralTextures(scene) {
  // 1. Textura del Mono
  const gM = scene.make.graphics({ x: 0, y: 0, add: false });
  // Torso
  gM.fillStyle(0x795548, 1);
  gM.fillEllipse(16, 20, 18, 22);
  // Pancita
  gM.fillStyle(0xd7ccc8, 1);
  gM.fillEllipse(18, 22, 12, 14);
  // Cabeza
  gM.fillStyle(0x795548, 1);
  gM.fillCircle(16, 10, 11);
  // Hocico
  gM.fillStyle(0xd7ccc8, 1);
  gM.fillEllipse(18, 12, 12, 9);
  // Orejas
  gM.fillStyle(0x795548, 1);
  gM.fillCircle(6, 6, 4.5);
  gM.fillCircle(24, 6, 4.5);
  gM.fillStyle(0xd7ccc8, 1);
  gM.fillCircle(6, 6, 2.5);
  gM.fillCircle(24, 6, 2.5);
  // Ojos
  gM.fillStyle(0xffffff, 1);
  gM.fillCircle(15, 9, 2.5);
  gM.fillCircle(21, 9, 2.5);
  gM.fillStyle(0x000000, 1);
  gM.fillCircle(16, 9, 1.4);
  gM.fillCircle(22, 9, 1.4);
  // Cola
  gM.lineStyle(3.5, 0x795548, 1);
  gM.beginPath();
  gM.moveTo(8, 26);
  gM.lineTo(2, 33);
  gM.lineTo(6, 38);
  gM.strokePath();
  gM.generateTexture('tex_monkey', 36, 44);
  gM.destroy();

  // 2. Mono golpeado / cayendo (X X)
  const gMH = scene.make.graphics({ x: 0, y: 0, add: false });
  gMH.fillStyle(0x8d6e63, 1);
  gMH.fillEllipse(16, 20, 18, 22);
  gMH.fillStyle(0xd7ccc8, 1);
  gMH.fillEllipse(18, 22, 12, 14);
  gMH.fillStyle(0x8d6e63, 1);
  gMH.fillCircle(16, 10, 11);
  gMH.fillStyle(0xd7ccc8, 1);
  gMH.fillEllipse(18, 13, 12, 9);
  // Ojos X X
  gMH.lineStyle(1.8, 0x000000, 1);
  gMH.beginPath();
  gMH.moveTo(13, 7); gMH.lineTo(17, 11);
  gMH.moveTo(17, 7); gMH.lineTo(13, 11);
  gMH.moveTo(19, 7); gMH.lineTo(23, 11);
  gMH.moveTo(23, 7); gMH.lineTo(19, 11);
  gMH.strokePath();
  // Boca abierta "O"
  gMH.fillStyle(0x3e2723, 1);
  gMH.fillCircle(18, 15, 2.5);
  gMH.generateTexture('tex_monkey_hurt', 36, 44);
  gMH.destroy();

  // 3. Hormiga Roja
  const gAR = scene.make.graphics({ x: 0, y: 0, add: false });
  gAR.fillStyle(0xd32f2f, 1);
  gAR.fillEllipse(10, 6, 7, 10); // Abdomen trasero
  gAR.fillEllipse(10, 13, 5, 6);  // Tórax
  gAR.fillStyle(0xb71c1c, 1);
  gAR.fillCircle(10, 19, 4.5);   // Cabeza
  // Patas
  gAR.lineStyle(1.4, 0xd32f2f, 1);
  gAR.beginPath();
  gAR.moveTo(4, 9); gAR.lineTo(16, 9);
  gAR.moveTo(3, 13); gAR.lineTo(17, 13);
  gAR.moveTo(4, 17); gAR.lineTo(16, 17);
  gAR.strokePath();
  gAR.generateTexture('tex_ant_red', 20, 26);
  gAR.destroy();

  // 4. Hormiga Negra Guerrera
  const gAB = scene.make.graphics({ x: 0, y: 0, add: false });
  gAB.fillStyle(0x212121, 1);
  gAB.fillEllipse(11, 7, 8, 11);
  gAB.fillEllipse(11, 14, 6, 7);
  gAB.fillStyle(0x000000, 1);
  gAB.fillCircle(11, 21, 5);
  gAB.lineStyle(1.5, 0x333333, 1);
  gAB.beginPath();
  gAB.moveTo(3, 10); gAB.lineTo(19, 10);
  gAB.moveTo(2, 14); gAB.lineTo(20, 14);
  gAB.moveTo(3, 19); gAB.lineTo(19, 19);
  gAB.strokePath();
  gAB.generateTexture('tex_ant_black', 22, 28);
  gAB.destroy();

  // 5. Hormiga de Fuego Bala
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

  // 6. Banana
  const gB = scene.make.graphics({ x: 0, y: 0, add: false });
  gB.fillStyle(0xffd600, 1);
  gB.beginPath();
  gB.moveTo(2, 14);
  gB.arc(10, 10, 9, Math.PI * 0.7, Math.PI * 1.8, false);
  gB.lineTo(18, 4);
  gB.arc(10, 12, 11, Math.PI * 1.8, Math.PI * 0.7, true);
  gB.closePath();
  gB.fillPath();
  gB.fillStyle(0x388e3c, 1);
  gB.fillRect(1, 13, 2, 3);
  gB.fillStyle(0x5d4037, 1);
  gB.fillRect(17, 3, 2, 2);
  gB.generateTexture('tex_banana', 22, 20);
  gB.destroy();

  // 7. Banana Dorada (Super)
  const gBG = scene.make.graphics({ x: 0, y: 0, add: false });
  gBG.fillStyle(0xffeb3b, 1);
  gBG.fillCircle(12, 12, 11);
  gBG.fillStyle(0xffc107, 1);
  gBG.fillCircle(12, 12, 8);
  gBG.fillStyle(0xffffff, 1);
  gBG.fillCircle(10, 9, 3);
  gBG.generateTexture('tex_banana_gold', 24, 24);
  gBG.destroy();
}

// --- ESCENARIO DE SELVA Y BAMBÚS ---
function drawJungleBackdrop(scene) {
  const g = scene.add.graphics().setDepth(1);
  // Árboles lejanos
  g.fillStyle(0x0c311a, 0.7);
  g.fillCircle(120, 160, 120);
  g.fillCircle(280, 220, 140);
  g.fillCircle(520, 200, 150);
  g.fillCircle(680, 170, 130);

  // Lianas laterales
  g.lineStyle(3, 0x144d27, 0.8);
  g.beginPath();
  g.moveTo(40, 0); g.lineTo(60, 600);
  g.moveTo(760, 0); g.lineTo(740, 600);
  g.strokePath();

  // Hojas superiores
  g.fillStyle(0x195b2e, 0.9);
  g.fillTriangle(0, 0, 180, 0, 0, 110);
  g.fillTriangle(800, 0, 620, 0, 800, 110);
}

function drawBamboos(scene) {
  const g = scene.add.graphics().setDepth(5);
  const bambooWidth = 22;

  BAMBOO_X.forEach((bx, idx) => {
    // Sombra del tronco
    g.fillStyle(0x010803, 0.45);
    g.fillRect(bx - bambooWidth / 2 + 4, 0, bambooWidth, GAME_HEIGHT);

    // Tallo principal verde degradado
    g.fillStyle(0x2e8544, 1);
    g.fillRect(bx - bambooWidth / 2, 0, bambooWidth, GAME_HEIGHT);

    g.fillStyle(0x56b86b, 1);
    g.fillRect(bx - bambooWidth / 2 + 4, 0, 7, GAME_HEIGHT);

    // Nudos de bambú
    g.fillStyle(0x1a5228, 1);
    g.lineStyle(2, 0x82d992, 1);
    for (let y = 30; y < GAME_HEIGHT; y += 75) {
      g.fillEllipse(bx, y, bambooWidth + 3, 5);
      g.strokeEllipse(bx, y, bambooWidth + 3, 5);
    }
  });
}

// --- HUD Y PANELES CRT LATERALES ---
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

  scene.add.text(28, 135, 'BANANAS:', fontStyle).setDepth(26);
  uiTexts.bananas = scene.add.text(28, 155, '0 🍌', { fontFamily: 'monospace', fontSize: '15px', color: '#ffe600', fontStyle: 'bold' }).setDepth(26);

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
  uiTexts.titleHeader = scene.add.text(400, 24, 'MONO VERGATARIO', {
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

  // Estado de Salto y Caída del Mono (Al morir)
  if (gameState === STATE_DYING) {
    monkey.deathVy += 24 * dt; // Gravedad
    monkey.y += monkey.deathVy;
    monkey.x += monkey.deathVx;
    monkey.sprite.setRotation(monkey.sprite.rotation + (monkey.deathVx > 0 ? 8 : -8) * dt);
    monkey.sprite.setPosition(monkey.x, monkey.y);

    if (monkey.y > GAME_HEIGHT + 70) {
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
  updateBananas(dt);
  updateParticles(dt);
  updateHUD();
}

function startFreshGame() {
  score = 0;
  bananasCount = 0;
  lives = 3;
  altitude = 0;
  superTimer = 0;
  invulTimer = 0;
  combo = 0;
  comboTimer = 0;
  scrollSpeed = 2.2;

  // Limpiar entidades
  ants.forEach((a) => a.sprite.destroy());
  bananas.forEach((b) => b.sprite.destroy());
  particles.forEach((p) => p.destroy());
  ants = [];
  bananas = [];
  particles = [];

  // Reset del mono
  monkey.bamboo = 1;
  monkey.side = 1;
  monkey.x = BAMBOO_X[1] + OFFSET_X;
  monkey.targetX = monkey.x;
  monkey.y = 430;
  monkey.targetY = 430;
  monkey.isDying = false;
  monkey.deathVx = 0;
  monkey.deathVy = 0;
  monkey.sprite.setTexture('tex_monkey').setRotation(0).setPosition(monkey.x, monkey.y).setAlpha(1);

  gameState = STATE_PLAYING;
  uiTexts.centerBox.setVisible(false);
  sfx.startBGM();
}

function handlePlayerInput(dt) {
  // Movimiento lateral (Cambiar de bambú / lado)
  if (justPressed.P1_L) {
    justPressed.P1_L = false;
    moveMonkeyLeft();
  }
  if (justPressed.P1_R) {
    justPressed.P1_R = false;
    moveMonkeyRight();
  }

  // Trepar o deslizarse verticalmente
  if (held.P1_U) {
    scrollSpeed = 3.6;
    monkey.targetY = Math.max(160, monkey.targetY - 140 * dt);
  } else if (held.P1_D) {
    scrollSpeed = 1.0;
    monkey.targetY = Math.min(500, monkey.targetY + 180 * dt);
  } else {
    scrollSpeed = 2.2;
    monkey.targetY += (430 - monkey.targetY) * 0.08;
  }

  // Suavizado de posición del mono
  monkey.x += (monkey.targetX - monkey.x) * 0.35;
  monkey.y += (monkey.targetY - monkey.y) * 0.25;

  // Orientación del sprite (mira hacia el bambú que abraza)
  monkey.sprite.setFlipX(monkey.side === 1);
  monkey.sprite.setPosition(monkey.x, monkey.y);

  // Parpadeo de invulnerabilidad
  if (invulTimer > 0) {
    invulTimer -= dt;
    monkey.sprite.setAlpha(Math.floor(invulTimer * 12) % 2 === 0 ? 0.3 : 1.0);
  } else {
    monkey.sprite.setAlpha(1.0);
  }

  // Modo Super Banana Dorada
  if (superTimer > 0) {
    superTimer -= dt;
    monkey.sprite.setTint(0xffeb3b);
  } else {
    monkey.sprite.clearTint();
  }
}

function moveMonkeyLeft() {
  if (monkey.side === 1) {
    monkey.side = -1;
    sfx.jump();
  } else if (monkey.bamboo > 0) {
    monkey.bamboo--;
    monkey.side = 1;
    sfx.jump();
  }
  monkey.targetX = BAMBOO_X[monkey.bamboo] + monkey.side * OFFSET_X;
}

function moveMonkeyRight() {
  if (monkey.side === -1) {
    monkey.side = 1;
    sfx.jump();
  } else if (monkey.bamboo < NUM_BAMBOOS - 1) {
    monkey.bamboo++;
    monkey.side = -1;
    sfx.jump();
  }
  monkey.targetX = BAMBOO_X[monkey.bamboo] + monkey.side * OFFSET_X;
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

  // Spawn Bananas
  bananaSpawnTimer += dt;
  if (bananaSpawnTimer > 1.25) {
    bananaSpawnTimer = 0;
    spawnBanana();
  }
}

function spawnAnt() {
  const bIdx = Math.floor(Math.random() * NUM_BAMBOOS);
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

  const sprite = config.scene.create.scene.add.sprite(BAMBOO_X[bIdx] + side * (OFFSET_X - 5), -20, tex).setDepth(15);
  ants.push({ bIdx, side, speed, sprite });
}

function spawnBanana() {
  const bIdx = Math.floor(Math.random() * NUM_BAMBOOS);
  const side = Math.random() < 0.5 ? -1 : 1;
  const isGold = Math.random() < 0.08 && superTimer <= 0;
  const tex = isGold ? 'tex_banana_gold' : 'tex_banana';

  const sprite = config.scene.create.scene.add.sprite(BAMBOO_X[bIdx] + side * OFFSET_X, -20, tex).setDepth(12);
  bananas.push({ bIdx, side, isGold, sprite });
}

function updateAnts(dt) {
  for (let i = ants.length - 1; i >= 0; i--) {
    const a = ants[i];
    a.sprite.y += (a.speed + scrollSpeed * 25) * dt;

    // Colisión con el mono
    const dy = Math.abs(a.sprite.y - monkey.y);
    const dx = Math.abs(a.sprite.x - monkey.x);

    if (a.bIdx === monkey.bamboo && a.side === monkey.side && dy < 28 && dx < 24) {
      if (superTimer > 0) {
        // Super Mono aplasta hormiga
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
          triggerMonkeyDeath();
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

function updateBananas(dt) {
  for (let i = bananas.length - 1; i >= 0; i--) {
    const b = bananas[i];
    b.sprite.y += scrollSpeed * 45 * dt;

    const dy = Math.abs(b.sprite.y - monkey.y);
    const dx = Math.abs(b.sprite.x - monkey.x);

    if (b.bIdx === monkey.bamboo && b.side === monkey.side && dy < 30 && dx < 24) {
      bananasCount++;
      if (b.isGold) {
        sfx.golden();
        superTimer = 7.0;
        score += 150;
      } else {
        sfx.munch();
        score += 20;
      }
      b.sprite.destroy();
      bananas.splice(i, 1);
      continue;
    }

    if (b.sprite.y > GAME_HEIGHT + 30) {
      b.sprite.destroy();
      bananas.splice(i, 1);
    }
  }
}

function triggerMonkeyDeath() {
  gameState = STATE_DYING;
  sfx.stopBGM();
  sfx.monkeyFall();

  monkey.isDying = true;
  monkey.deathVy = -8.5; // Salto inicial hacia arriba
  monkey.deathVx = monkey.side === 1 ? 3.0 : -3.0; // Despegarse del bambú hacia el vacío
  monkey.sprite.setTexture('tex_monkey_hurt');
}

function triggerGameOver() {
  gameState = STATE_GAMEOVER;
  sfx.gameOver();

  if (score > highScore) {
    highScore = score;
    getStorage().set('mono_high_score', highScore);
  }

  uiTexts.centerBox.setText(
    `¡FIN DEL JUEGO!\n\nPUNTAJE: ${score}\nBANANAS: ${bananasCount}\nALTURA: ${Math.floor(altitude)}m\n\nPresiona ENTER o R\npara jugar de nuevo`
  ).setVisible(true);
}

function updateParticles(dt) {
  // Limpieza simple
}

function updateHUD() {
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️ ' : '🖤 ';
  uiTexts.lives.setText(hearts);
  uiTexts.bananas.setText(`${bananasCount} 🍌`);
  uiTexts.altitude.setText(`${Math.floor(altitude)} m`);
  uiTexts.score.setText(`${score}`);
  uiTexts.high.setText(`${highScore}`);
}

function showMenuUI(visible) {
  if (visible) {
    uiTexts.centerBox.setText(
      'MONO VERGATARIO\n★ 4 BAMBÚS ★\n\nEsquiva las hormigas\ny devora las bananas\n\nPresiona ENTER o W\npara jugar'
    ).setVisible(true);
  }
}
