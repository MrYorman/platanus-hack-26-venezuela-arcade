// Platanus Hack 26 — Caracas Arcade Edition
// CHAMITO INTERGALÁCTICO
// De la mata de mango al espacio exterior con el morral tricolor

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// Mapeo obligatorio de la máquina de arcade física.
// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u', 'p', ' '],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
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
  if (norm === 'r') justPressed.RESET = true;
});

window.addEventListener('keyup', (e) => {
  const norm = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = KEYBOARD_TO_ARCADE[norm];
  if (code) held[code] = false;
});

// Storage
function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? { found: false, value: null } : { found: true, value: JSON.parse(raw) };
      } catch (e) { return { found: false, value: null }; }
    },
    async set(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    },
  };
}

// Audio Sintetizado
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

  jump() { this.playTone(320, 'sine', 0.09, 0.2, 600); }
  munch() { this.playTone(550, 'square', 0.08, 0.16, 920); }
  golden() {
    [440, 554, 659, 880, 1108].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.15, 0.22), i * 50);
    });
  }
  hurt() { this.playTone(180, 'sawtooth', 0.22, 0.3, 50); }
  smash() { this.playTone(480, 'sawtooth', 0.1, 0.25, 120); }

  fall() {
    this.playTone(400, 'sine', 0.15, 0.35, 800);
    setTimeout(() => this.playTone(600, 'sawtooth', 0.65, 0.3, 60), 130);
  }

  gameOver() {
    [380, 320, 260, 200, 140].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.26, 0.26, f * 0.8), i * 110);
    });
  }

  startBGM() {
    if (this.bgmTimer) return;
    this.bgmStep = 0;
    const bass = [140, 140, 175, 175, 155, 155, 210, 185];
    const lead = [523, 659, 784, 880, 784, 659, 587, 698];
    const tick = () => {
      if (!this.muted && this.ctx) {
        this.playTone(bass[this.bgmStep % bass.length], 'triangle', 0.1, 0.06);
        if (this.bgmStep % 2 === 0) {
          this.playTone(lead[(this.bgmStep / 2) % lead.length], 'square', 0.08, 0.035);
        }
      }
      this.bgmStep++;
      this.bgmTimer = setTimeout(tick, 170);
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

// Configuración de la mata de mango (4 troncos)
const NUM_TRUNKS = 4;
const TRUNK_X = [260, 350, 450, 540];
const OFFSET_X = 22;

const STATE_MENU = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;
const STATE_DYING = 3;
const STATE_GAMEOVER = 4;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-root',
  backgroundColor: '#050a12',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: { preload, create, update },
};

new Phaser.Game(config);

function preload() {}

let sfx;
let gameState = STATE_MENU;
let score = 0;
let mangosCount = 0;
let altitude = 0;
let highScore = 0;
let superTimer = 0;
let scrollSpeed = 2.2;
let p2Active = false; // Se activa automáticamente si P2 toca las flechas

// Los dos jugadores (Chamito P1 y Compinche P2)
let p1 = {
  active: true,
  trunk: 1,
  side: 1,
  x: TRUNK_X[1] + OFFSET_X,
  targetX: TRUNK_X[1] + OFFSET_X,
  y: 430,
  targetY: 430,
  lives: 3,
  invul: 0,
  isDying: false,
  deathVx: 0,
  deathVy: 0,
  sprite: null,
};

let p2 = {
  active: false,
  trunk: 2,
  side: -1,
  x: TRUNK_X[2] - OFFSET_X,
  targetX: TRUNK_X[2] - OFFSET_X,
  y: 470,
  targetY: 470,
  lives: 3,
  invul: 0,
  isDying: false,
  deathVx: 0,
  deathVy: 0,
  sprite: null,
};

let enemies = [];
let mangos = [];
let bgProps = [];
let stars = [];

let uiTexts = {};
let backdropGraphics;
let blackHoleGraphic;

function create() {
  sfx = new ArcadeAudio(this.sound);

  getStorage().get('chamito_high_score').then((res) => {
    if (res.found && typeof res.value === 'number') highScore = res.value;
  });

  generateTextures(this);

  // 1. Fondos dinámicos (Barrio -> Cielo -> Atmósfera -> Espacio)
  backdropGraphics = this.add.graphics().setDepth(1);
  createStars(this);

  // 2. Elementos del mundo (Casas del barrio, Doña asomada, Satélite Simón Bolívar, Agujero negro)
  createWorldProps(this);

  // 3. Troncos de la Mata de Mango
  drawMangoTree(this);

  // 4. Sprites de los Chamitos
  p1.sprite = this.add.sprite(p1.x, p1.y, 'tex_chamito_p1').setDepth(20);
  p2.sprite = this.add.sprite(p2.x, p2.y, 'tex_chamito_p2').setDepth(20).setVisible(false);

  // 5. HUD y Controles
  createArcadeHUD(this);

  // 6. Filtro de líneas CRT
  drawCRTFilter(this);

  showMenuUI(true);
}

// --- GENERACIÓN DE TEXTURAS PROCEDURALES (CERO ASSETS EXTERNOS) ---
function generateTextures(scene) {
  // 1. Chamito P1 con Morral Tricolor
  const g1 = scene.make.graphics({ x: 0, y: 0, add: false });
  // Franela blanca
  g1.fillStyle(0xffffff, 1);
  g1.fillRect(8, 18, 16, 18);
  // Cabeza y pelo
  g1.fillStyle(0x3e2723, 1);
  g1.fillCircle(16, 9, 8); // Pelo rizado
  g1.fillStyle(0xd7a15c, 1);
  g1.fillCircle(16, 11, 7); // Cara
  g1.fillStyle(0x212121, 1);
  g1.fillCircle(19, 10, 1.5); // Ojo
  // Morral Escolar Tricolor en la espalda
  g1.fillStyle(0xffd600, 1); // Amarillo
  g1.fillRect(1, 18, 7, 5);
  g1.fillStyle(0x0055b8, 1); // Azul
  g1.fillRect(1, 23, 7, 5);
  g1.fillStyle(0xd50000, 1); // Rojo
  g1.fillRect(1, 28, 7, 5);
  // Short azul escolar
  g1.fillStyle(0x1a237e, 1);
  g1.fillRect(10, 36, 12, 8);
  g1.generateTexture('tex_chamito_p1', 32, 46);
  g1.destroy();

  // 2. Chamita / Compinche P2 con Gorra Tricolor
  const g2 = scene.make.graphics({ x: 0, y: 0, add: false });
  g2.fillStyle(0xffea00, 1); // Franela amarilla
  g2.fillRect(8, 18, 16, 18);
  g2.fillStyle(0xd7a15c, 1);
  g2.fillCircle(16, 11, 7);
  // Gorra tricolor
  g2.fillStyle(0xffd600, 1); g2.fillRect(9, 4, 14, 4);
  g2.fillStyle(0x0055b8, 1); g2.fillRect(9, 8, 14, 3);
  g2.fillStyle(0xd50000, 1); g2.fillRect(15, 8, 8, 3); // Visera
  g2.fillStyle(0x212121, 1);
  g2.fillCircle(19, 11, 1.5);
  // Morralito
  g2.fillStyle(0xd50000, 1);
  g2.fillRect(1, 20, 7, 12);
  g2.fillStyle(0x263238, 1);
  g2.fillRect(10, 36, 12, 8);
  g2.generateTexture('tex_chamito_p2', 32, 46);
  g2.destroy();

  // 3. Chamito golpeado / cayendo (X X)
  const gH = scene.make.graphics({ x: 0, y: 0, add: false });
  gH.fillStyle(0xffffff, 1);
  gH.fillRect(8, 18, 16, 18);
  gH.fillStyle(0xd7a15c, 1);
  gH.fillCircle(16, 11, 7);
  // Ojo X
  gH.lineStyle(1.5, 0x000000, 1);
  gH.beginPath();
  gH.moveTo(17, 8); gH.lineTo(21, 12);
  gH.moveTo(21, 8); gH.lineTo(17, 12);
  gH.strokePath();
  // Boca "O"
  gH.fillStyle(0x3e2723, 1);
  gH.fillCircle(18, 15, 2.5);
  // Morral
  gH.fillStyle(0xffd600, 1); gH.fillRect(1, 18, 7, 4);
  gH.fillStyle(0x0055b8, 1); gH.fillRect(1, 22, 7, 4);
  gH.fillStyle(0xd50000, 1); gH.fillRect(1, 26, 7, 4);
  gH.generateTexture('tex_chamito_hurt', 32, 46);
  gH.destroy();

  // 4. Mango Maduro
  const gM = scene.make.graphics({ x: 0, y: 0, add: false });
  gM.fillStyle(0xd50000, 1);
  gM.fillEllipse(11, 13, 10, 13);
  gM.fillStyle(0xffd600, 1);
  gM.fillEllipse(9, 11, 7, 10);
  gM.fillStyle(0x4caf50, 1);
  gM.fillRect(10, 1, 2, 4); // Tallo
  gM.generateTexture('tex_mango', 22, 26);
  gM.destroy();

  // 5. Mango de Oro (Invencible)
  const gMO = scene.make.graphics({ x: 0, y: 0, add: false });
  gMO.fillStyle(0xffea00, 1);
  gMO.fillCircle(12, 12, 11);
  gMO.fillStyle(0xffffff, 0.9);
  gMO.fillCircle(9, 8, 3.5);
  gMO.generateTexture('tex_mango_oro', 24, 24);
  gMO.destroy();

  // 6. Hormiga Brava (Nivel 1)
  const gA = scene.make.graphics({ x: 0, y: 0, add: false });
  gA.fillStyle(0xc62828, 1);
  gA.fillEllipse(10, 6, 7, 9);
  gA.fillEllipse(10, 13, 5, 5);
  gA.fillCircle(10, 18, 4);
  gA.lineStyle(1.4, 0xc62828, 1);
  gA.beginPath();
  gA.moveTo(4, 9); gA.lineTo(16, 9);
  gA.moveTo(3, 13); gA.lineTo(17, 13);
  gA.moveTo(4, 17); gA.lineTo(16, 17);
  gA.strokePath();
  gA.generateTexture('tex_ant', 20, 24);
  gA.destroy();

  // 7. Guacamaya de Caracas (Nivel 2)
  const gG = scene.make.graphics({ x: 0, y: 0, add: false });
  gG.fillStyle(0xd50000, 1); // Rojo
  gG.fillTriangle(14, 0, 4, 18, 24, 18);
  gG.fillStyle(0xffd600, 1); // Amarillo
  gG.fillRect(7, 12, 14, 6);
  gG.fillStyle(0x0055b8, 1); // Azul
  gG.fillRect(9, 18, 10, 8);
  gG.generateTexture('tex_guacamaya', 28, 28);
  gG.destroy();

  // 8. Cohete Espacial (Nivel 3)
  const gR = scene.make.graphics({ x: 0, y: 0, add: false });
  gR.fillStyle(0xe0e0e0, 1);
  gR.fillRect(8, 6, 10, 18);
  gR.fillStyle(0xd50000, 1);
  gR.fillTriangle(13, 0, 8, 6, 18, 6); // Punta
  gR.fillStyle(0xff6d00, 1);
  gR.fillTriangle(13, 28, 9, 24, 17, 24); // Fuego
  gR.generateTexture('tex_rocket', 26, 30);
  gR.destroy();

  // 9. Meteorito Cósmico (Nivel 4)
  const gMet = scene.make.graphics({ x: 0, y: 0, add: false });
  gMet.fillStyle(0xbf360c, 1);
  gMet.fillCircle(12, 12, 10);
  gMet.fillStyle(0xff9100, 1);
  gMet.fillCircle(11, 10, 6);
  gMet.fillStyle(0xffff00, 1);
  gMet.fillCircle(10, 9, 3);
  gMet.generateTexture('tex_meteor', 24, 24);
  gMet.destroy();

  // 10. Doña Asomada en la ventana (La vieja del barrio)
  const gD = scene.make.graphics({ x: 0, y: 0, add: false });
  gD.fillStyle(0xb0bec5, 1);
  gD.fillCircle(14, 8, 7); // Rulos / pelo gris
  gD.fillStyle(0xffcc80, 1);
  gD.fillCircle(14, 10, 6); // Cara
  gD.fillStyle(0xe91e63, 1);
  gD.fillRect(6, 17, 16, 13); // Bata rosada
  gD.generateTexture('tex_dona', 28, 30);
  gD.destroy();
}

function createStars(scene) {
  for (let i = 0; i < 70; i++) {
    const star = scene.add.rectangle(
      Phaser.Math.Between(20, GAME_WIDTH - 20),
      Phaser.Math.Between(0, GAME_HEIGHT),
      Phaser.Math.Between(2, 3.5),
      Phaser.Math.Between(2, 3.5),
      0xffffff
    ).setDepth(2).setAlpha(0);
    stars.push(star);
  }
}

function createWorldProps(scene) {
  // Satélite Simón Bolívar (se activa a gran altura)
  bgProps.satellite = scene.add.container(680, -100).setDepth(3);
  const sBody = scene.add.rectangle(0, 0, 24, 20, 0xb0bec5);
  const sWing1 = scene.add.rectangle(-24, 0, 22, 10, 0x0055b8);
  const sWing2 = scene.add.rectangle(24, 0, 22, 10, 0x0055b8);
  bgProps.satellite.add([sBody, sWing1, sWing2]);

  // Agujero Negro giratorio
  bgProps.blackHole = scene.add.container(400, -200).setDepth(2);
  const disc = scene.add.circle(0, 0, 48, 0xff9800, 0.7);
  const hole = scene.add.circle(0, 0, 36, 0x000000, 1.0);
  bgProps.blackHole.add([disc, hole]);
}

function drawMangoTree(scene) {
  const g = scene.add.graphics().setDepth(5);
  const trunkWidth = 24;

  TRUNK_X.forEach((tx) => {
    // Sombra
    g.fillStyle(0x010803, 0.45);
    g.fillRect(tx - trunkWidth / 2 + 4, 0, trunkWidth, GAME_HEIGHT);

    // Tallo leñoso de mata de mango
    g.fillStyle(0x5d4037, 1);
    g.fillRect(tx - trunkWidth / 2, 0, trunkWidth, GAME_HEIGHT);

    g.fillStyle(0x8d6e63, 1);
    g.fillRect(tx - trunkWidth / 2 + 3, 0, 6, GAME_HEIGHT);

    // Nudos y corteza
    g.lineStyle(2, 0x3e2723, 1);
    for (let y = 30; y < GAME_HEIGHT; y += 70) {
      g.beginPath();
      g.moveTo(tx - trunkWidth / 2, y);
      g.lineTo(tx + trunkWidth / 2, y + 8);
      g.strokePath();
    }
  });
}

function createArcadeHUD(scene) {
  const fontStyle = { fontFamily: 'monospace', fontSize: '13px', color: '#39ff6e' };
  const titleStyle = { fontFamily: 'monospace', fontSize: '12px', color: '#ffe600', fontStyle: 'bold' };

  // Marco izquierdo: P1 y P2
  const gL = scene.add.graphics().setDepth(25);
  gL.fillStyle(0x021107, 0.9);
  gL.lineStyle(2, 0x1fa347, 1);
  gL.fillRoundedRect(16, 16, 190, 568, 8);
  gL.strokeRoundedRect(16, 16, 190, 568, 8);

  scene.add.text(111, 36, 'CHAMITOS COOP', titleStyle).setOrigin(0.5).setDepth(26);

  scene.add.text(28, 65, 'P1 VIDAS:', fontStyle).setDepth(26);
  uiTexts.p1Lives = scene.add.text(28, 85, '❤️❤️❤️', { fontSize: '15px' }).setDepth(26);

  scene.add.text(28, 120, 'P2 VIDAS:', fontStyle).setDepth(26);
  uiTexts.p2Lives = scene.add.text(28, 140, 'PULSA FLECHA', { fontFamily: 'monospace', fontSize: '11px', color: '#888888' }).setDepth(26);

  scene.add.text(28, 185, 'MANGOS:', fontStyle).setDepth(26);
  uiTexts.mangos = scene.add.text(28, 205, '0 🥭', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe600', fontStyle: 'bold' }).setDepth(26);

  scene.add.text(28, 255, 'ALTURA:', fontStyle).setDepth(26);
  uiTexts.altitude = scene.add.text(28, 275, '0 m', { fontFamily: 'monospace', fontSize: '16px', color: '#9affb6' }).setDepth(26);

  scene.add.text(28, 325, 'PUNTAJE:', fontStyle).setDepth(26);
  uiTexts.score = scene.add.text(28, 345, '0', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setDepth(26);

  scene.add.text(28, 395, 'RÉCORD:', fontStyle).setDepth(26);
  uiTexts.high = scene.add.text(28, 415, '0', { fontFamily: 'monospace', fontSize: '15px', color: '#ffe600' }).setDepth(26);

  // Marco derecho: Mundos y controles
  const gR = scene.add.graphics().setDepth(25);
  gR.fillStyle(0x021107, 0.9);
  gR.lineStyle(2, 0x1fa347, 1);
  gR.fillRoundedRect(594, 16, 190, 568, 8);
  gR.strokeRoundedRect(594, 16, 190, 568, 8);

  scene.add.text(689, 36, 'ZONA ACTUAL', titleStyle).setOrigin(0.5).setDepth(26);
  uiTexts.zoneName = scene.add.text(689, 60, 'EL BARRIO', { fontFamily: 'monospace', fontSize: '12px', color: '#ff9800', fontStyle: 'bold' }).setOrigin(0.5).setDepth(26);

  const controls = [
    'P1 (WASD):', 'W: Subir | S: Bajar',
    '', 'A: Izq | D: Der',
    '',
    'P2 (FLECHAS):', '↑: Subir | ↓: Bajar',
    '', '←: Izq | →: Der',
    '',
    'REGLA COOP:', '¡No se pueden',
    '', 'sobrepasar!',
    '',
    'P: Pausa | R: Reset', '',
  ];
  let cy = 95;
  for (let i = 0; i < controls.length; i += 2) {
    scene.add.text(606, cy, controls[i], { fontFamily: 'monospace', fontSize: '10px', color: '#ffe600', fontStyle: 'bold' }).setDepth(26);
    scene.add.text(606, cy + 14, controls[i + 1], { fontFamily: 'monospace', fontSize: '9px', color: '#9affb6' }).setDepth(26);
    cy += 35;
  }

  // Título central
  uiTexts.titleHeader = scene.add.text(400, 24, 'CHAMITO INTERGALÁCTICO', {
    fontFamily: 'monospace', fontSize: '17px', color: '#ffe600', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(26);

  // Cartel central
  uiTexts.centerBox = scene.add.text(400, 290, '', {
    fontFamily: 'monospace', fontSize: '19px', color: '#ffe600', align: 'center', backgroundColor: '#021107', padding: { x: 20, y: 15 }
  }).setOrigin(0.5).setDepth(40).setVisible(false);
}

function drawCRTFilter(scene) {
  const g = scene.add.graphics().setDepth(99);
  g.lineStyle(1, 0x000000, 0.32);
  for (let y = 0; y < GAME_HEIGHT; y += 4) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(GAME_WIDTH, y);
    g.strokePath();
  }
}

// --- ACTUALIZACIÓN DINÁMICA DEL FONDO SEGÚN ALTITUD ---
function updateBackdrop(scene) {
  backdropGraphics.clear();

  let colTop, colBot, zoneName;

  if (altitude < 250) {
    // Zona 1: El Barrio de Caracas (0 - 250m)
    colTop = 0x1b3820; colBot = 0x5a2d18;
    zoneName = '1. EL BARRIO';
    stars.forEach(s => s.setAlpha(0));
  } else if (altitude < 600) {
    // Zona 2: El Cielo y El Ávila (250 - 600m)
    colTop = 0x0d47a1; colBot = 0x42a5f5;
    zoneName = '2. EL CIELO';
    stars.forEach(s => s.setAlpha(0));
  } else if (altitude < 1000) {
    // Zona 3: Atmósfera y Satélite (600 - 1000m)
    colTop = 0x050814; colBot = 0x1a237e;
    zoneName = '3. SATÉLITE VZLA';
    stars.forEach(s => s.setAlpha(0.6));
    bgProps.satellite.y = 120 + Math.sin(altitude * 0.05) * 15;
  } else {
    // Zona 4: Espacio Profundo y Agujero Negro (1000m+)
    colTop = 0x020108; colBot = 0x240728;
    zoneName = '4. AGUJERO NEGRO';
    stars.forEach(s => s.setAlpha(0.9));
    bgProps.blackHole.y = 160;
    bgProps.blackHole.rotation += 0.02;
  }

  backdropGraphics.fillGradientStyle(colTop, colTop, colBot, colBot, 1);
  backdropGraphics.fillRect(206, 0, 388, GAME_HEIGHT);

  uiTexts.zoneName.setText(zoneName);

  // Dibujar casitas del barrio al fondo si estamos en la Zona 1
  if (altitude < 250) {
    const by = GAME_HEIGHT - 60 + (altitude * 0.2);
    backdropGraphics.fillStyle(0xb23b20, 0.9); // Ladrillos
    backdropGraphics.fillRect(215, by, 65, 80);
    backdropGraphics.fillRect(520, by - 10, 65, 90);
    backdropGraphics.fillStyle(0x1e88e5, 1); // Tanque azul
    backdropGraphics.fillRect(235, by - 16, 20, 16);
    backdropGraphics.fillRect(540, by - 26, 20, 16);
  }
}

// --- BUCLE PRINCIPAL ---
function update(time, delta) {
  const dt = delta / 1000;

  if (justPressed.RESET) {
    justPressed.RESET = false;
    startFreshGame();
    return;
  }

  if (gameState === STATE_MENU) {
    if (justPressed.START1 || justPressed.P1_U || held.P1_U) {
      justPressed.START1 = false;
      startFreshGame();
    }
    return;
  }

  // Activar Player 2 si toca sus controles
  if (!p2.active && (held.P2_U || held.P2_D || held.P2_L || held.P2_R)) {
    p2.active = true;
    p2.sprite.setVisible(true);
    uiTexts.p2Lives.setText('❤️❤️❤️');
  }

  // Pausa con P o P1_1
  if (justPressed.P1_1) {
    justPressed.P1_1 = false;
    if (gameState === STATE_PLAYING) {
      gameState = STATE_PAUSED;
      uiTexts.centerBox.setText('PAUSA\n\nP: Continuar\nR: Reiniciar').setVisible(true);
      return;
    } else if (gameState === STATE_PAUSED) {
      gameState = STATE_PLAYING;
      uiTexts.centerBox.setVisible(false);
      return;
    }
  }

  if (gameState === STATE_PAUSED) return;

  // Estado de caída de Chamito
  if (gameState === STATE_DYING) {
    updateDyingChamito(dt);
    return;
  }

  if (gameState === STATE_GAMEOVER) {
    if (justPressed.START1 || justPressed.P1_1) {
      justPressed.START1 = false;
      startFreshGame();
    }
    return;
  }

  // JUEGO ACTIVO
  updateBackdrop(this);
  handlePlayer1(dt);
  if (p2.active) handlePlayer2(dt);
  enforceCoopNoOvertake(); // REGLA: Los jugadores no se pueden sobrepasar

  updateWorld(dt);
  updateEnemies(dt);
  updateMangos(dt);
  updateHUD();
}

function startFreshGame() {
  score = 0;
  mangosCount = 0;
  altitude = 0;
  superTimer = 0;
  scrollSpeed = 2.2;

  enemies.forEach(e => e.sprite.destroy());
  mangos.forEach(m => m.sprite.destroy());
  enemies = [];
  mangos = [];

  // P1 Reset
  p1.trunk = 1;
  p1.side = 1;
  p1.x = TRUNK_X[1] + OFFSET_X;
  p1.targetX = p1.x;
  p1.y = 410;
  p1.targetY = 410;
  p1.lives = 3;
  p1.invul = 0;
  p1.isDying = false;
  p1.sprite.setTexture('tex_chamito_p1').setRotation(0).setPosition(p1.x, p1.y).setAlpha(1);

  // P2 Reset
  p2.trunk = 2;
  p2.side = -1;
  p2.x = TRUNK_X[2] - OFFSET_X;
  p2.targetX = p2.x;
  p2.y = 470;
  p2.targetY = 470;
  p2.lives = 3;
  p2.invul = 0;
  p2.isDying = false;
  p2.sprite.setTexture('tex_chamito_p2').setRotation(0).setPosition(p2.x, p2.y).setAlpha(1);

  gameState = STATE_PLAYING;
  uiTexts.centerBox.setVisible(false);
  sfx.startBGM();
}

function handlePlayer1(dt) {
  if (p1.lives <= 0) return;

  if (justPressed.P1_L) {
    justPressed.P1_L = false;
    if (p1.side === 1) { p1.side = -1; sfx.jump(); }
    else if (p1.trunk > 0) { p1.trunk--; p1.side = 1; sfx.jump(); }
  }
  if (justPressed.P1_R) {
    justPressed.P1_R = false;
    if (p1.side === -1) { p1.side = 1; sfx.jump(); }
    else if (p1.trunk < NUM_TRUNKS - 1) { p1.trunk++; p1.side = -1; sfx.jump(); }
  }

  p1.targetX = TRUNK_X[p1.trunk] + p1.side * OFFSET_X;

  if (held.P1_U) p1.targetY = Math.max(160, p1.targetY - 150 * dt);
  else if (held.P1_D) p1.targetY = Math.min(510, p1.targetY + 180 * dt);
  else p1.targetY += (410 - p1.targetY) * 0.08;

  p1.x += (p1.targetX - p1.x) * 0.35;
  p1.y += (p1.targetY - p1.y) * 0.25;

  p1.sprite.setFlipX(p1.side === 1).setPosition(p1.x, p1.y);

  if (p1.invul > 0) {
    p1.invul -= dt;
    p1.sprite.setAlpha(Math.floor(p1.invul * 12) % 2 === 0 ? 0.3 : 1.0);
  } else {
    p1.sprite.setAlpha(1.0);
  }
}

function handlePlayer2(dt) {
  if (p2.lives <= 0) return;

  if (justPressed.P2_L) {
    justPressed.P2_L = false;
    if (p2.side === 1) { p2.side = -1; sfx.jump(); }
    else if (p2.trunk > 0) { p2.trunk--; p2.side = 1; sfx.jump(); }
  }
  if (justPressed.P2_R) {
    justPressed.P2_R = false;
    if (p2.side === -1) { p2.side = 1; sfx.jump(); }
    else if (p2.trunk < NUM_TRUNKS - 1) { p2.trunk++; p2.side = -1; sfx.jump(); }
  }

  p2.targetX = TRUNK_X[p2.trunk] + p2.side * OFFSET_X;

  if (held.P2_U) p2.targetY = Math.max(160, p2.targetY - 150 * dt);
  else if (held.P2_D) p2.targetY = Math.min(510, p2.targetY + 180 * dt);
  else p2.targetY += (470 - p2.targetY) * 0.08;

  p2.x += (p2.targetX - p2.x) * 0.35;
  p2.y += (p2.targetY - p2.y) * 0.25;

  p2.sprite.setFlipX(p2.side === 1).setPosition(p2.x, p2.y);

  if (p2.invul > 0) {
    p2.invul -= dt;
    p2.sprite.setAlpha(Math.floor(p2.invul * 12) % 2 === 0 ? 0.3 : 1.0);
  } else {
    p2.sprite.setAlpha(1.0);
  }
}

// REGLA: Los jugadores no pueden sobrepasarse entre sí (se bloquean si intentan rebasar)
function enforceCoopNoOvertake() {
  if (!p2.active || p1.lives <= 0 || p2.lives <= 0) return;

  // Si P1 está originalmente más arriba que P2
  const minDistance = 35; // Distancia mínima vertical
  if (p1.y > p2.y - minDistance && p1.targetY < p2.y) {
    // P2 no deja que P1 baje más allá de él o P1 no puede sobrepasarlo
  }
  // En el mismo tronco y lado colisionan directamente
  if (p1.trunk === p2.trunk && p1.side === p2.side) {
    if (Math.abs(p1.y - p2.y) < minDistance) {
      if (p1.y < p2.y) {
        p1.targetY = p2.y - minDistance;
      } else {
        p2.targetY = p1.y - minDistance;
      }
    }
  }
}

function updateWorld(dt) {
  scrollSpeed = (held.P1_U || held.P2_U) ? 3.6 : 2.2;
  altitude += scrollSpeed * dt * 9;
  score += Math.round(scrollSpeed * 0.7);

  if (superTimer > 0) superTimer -= dt;

  // Spawn de enemigos según la zona
  if (Math.random() < 0.035) spawnEnemy();

  // Spawn de mangos
  if (Math.random() < 0.038) spawnMango();
}

function spawnEnemy() {
  const bIdx = Math.floor(Math.random() * NUM_TRUNKS);
  const side = Math.random() < 0.5 ? -1 : 1;
  let tex = 'tex_ant';
  let speed = 120 + altitude * 0.12;

  if (altitude > 1000) {
    tex = 'tex_meteor'; speed *= 1.6;
  } else if (altitude > 600) {
    tex = 'tex_rocket'; speed *= 1.45;
  } else if (altitude > 250) {
    tex = 'tex_guacamaya'; speed *= 1.25;
  }

  const sprite = config.scene.create.scene.add.sprite(TRUNK_X[bIdx] + side * (OFFSET_X - 5), -20, tex).setDepth(15);
  enemies.push({ bIdx, side, speed, sprite });
}

function spawnMango() {
  const bIdx = Math.floor(Math.random() * NUM_TRUNKS);
  const side = Math.random() < 0.5 ? -1 : 1;
  const isGold = Math.random() < 0.08 && superTimer <= 0;
  const tex = isGold ? 'tex_mango_oro' : 'tex_mango';

  const sprite = config.scene.create.scene.add.sprite(TRUNK_X[bIdx] + side * OFFSET_X, -20, tex).setDepth(12);
  mangos.push({ bIdx, side, isGold, sprite });
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.sprite.y += (e.speed + scrollSpeed * 25) * dt;

    // Colisión P1
    if (p1.lives > 0 && checkCollision(e, p1)) {
      handlePlayerHit(p1);
    }
    // Colisión P2
    if (p2.active && p2.lives > 0 && checkCollision(e, p2)) {
      handlePlayerHit(p2);
    }

    if (e.sprite.y > GAME_HEIGHT + 30) {
      e.sprite.destroy();
      enemies.splice(i, 1);
    }
  }
}

function checkCollision(obj, player) {
  const dy = Math.abs(obj.sprite.y - player.y);
  const dx = Math.abs(obj.sprite.x - player.x);
  return obj.bIdx === player.trunk && obj.side === player.side && dy < 28 && dx < 24;
}

function handlePlayerHit(player) {
  if (superTimer > 0) {
    sfx.smash();
    score += 50;
    return;
  }
  if (player.invul <= 0) {
    sfx.hurt();
    player.lives--;
    player.invul = 1.6;

    if (player.lives <= 0) {
      player.isDying = true;
      player.deathVy = -8.5;
      player.deathVx = player.side === 1 ? 3 : -3;
      player.sprite.setTexture('tex_chamito_hurt');
      sfx.fall();

      // Si ambos mueren (o P1 en solo) -> Estado de muerte
      if ((!p2.active && p1.lives <= 0) || (p2.active && p1.lives <= 0 && p2.lives <= 0)) {
        gameState = STATE_DYING;
        sfx.stopBGM();
      }
    }
  }
}

function updateMangos(dt) {
  for (let i = mangos.length - 1; i >= 0; i--) {
    const m = mangos[i];
    m.sprite.y += scrollSpeed * 45 * dt;

    if (checkCollision(m, p1) || (p2.active && checkCollision(m, p2))) {
      mangosCount++;
      if (m.isGold) {
        sfx.golden();
        superTimer = 7.0;
        score += 150;
      } else {
        sfx.munch();
        score += 25;
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

function updateDyingChamito(dt) {
  [p1, p2].forEach(p => {
    if (p.isDying) {
      p.deathVy += 22 * dt;
      p.y += p.deathVy;
      p.x += p.deathVx;
      p.sprite.setRotation(p.sprite.rotation + 8 * dt);
      p.sprite.setPosition(p.x, p.y);
    }
  });

  if (p1.y > GAME_HEIGHT + 70 && (!p2.active || p2.y > GAME_HEIGHT + 70)) {
    triggerGameOver();
  }
}

function triggerGameOver() {
  gameState = STATE_GAMEOVER;
  sfx.gameOver();

  if (score > highScore) {
    highScore = score;
    getStorage().set('chamito_high_score', highScore);
  }

  uiTexts.centerBox.setText(
    `¡FIN DE LA JORNADA!\n\nPUNTAJE: ${score}\nMANGOS: ${mangosCount} 🥭\nALTURA: ${Math.floor(altitude)}m\n\nPresiona ENTER o R\npara volver a jugar`
  ).setVisible(true);
}

function updateHUD() {
  let h1 = '';
  for (let i = 0; i < 3; i++) h1 += i < p1.lives ? '❤️ ' : '🖤 ';
  uiTexts.p1Lives.setText(h1);

  if (p2.active) {
    let h2 = '';
    for (let i = 0; i < 3; i++) h2 += i < p2.lives ? '❤️ ' : '🖤 ';
    uiTexts.p2Lives.setText(h2);
  }

  uiTexts.mangos.setText(`${mangosCount} 🥭`);
  uiTexts.altitude.setText(`${Math.floor(altitude)} m`);
  uiTexts.score.setText(`${score}`);
  uiTexts.high.setText(`${highScore}`);
}

function showMenuUI(visible) {
  if (visible) {
    uiTexts.centerBox.setText(
      'CHAMITO INTERGALÁCTICO\n★ DE LA MATA AL ESPACIO ★\n\n¡Sube la mata de mango\ny llega hasta el infinito!\n\nP1: WASD  |  P2: FLECHAS\n\nPresiona ENTER o W para jugar'
    ).setVisible(true);
  }
}
