import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  DIFFICULTIES,
  PIECE_LABELS,
  SIDE_LABELS,
  SIDES,
  cloneBoard,
  createInitialBoard,
} from './game/constants.js';
import {
  applyMove,
  getLegalMovesForPiece,
  getWinner,
  isInCheck,
  isMoveBlockedByRepeatedCheck,
  moveToKey,
  oppositeSide,
} from './game/rules.js';
import {
  OPENING_PROFILES,
  getOpeningBookSize,
  getOpeningProfileLabel,
} from './game/openingBook.js';
import { registerPWA } from './pwa.js';

const DESKTOP_RENDER_TARGET = Object.freeze({
  width: 1920,
  height: 1080,
});

const MOBILE_RENDER_TARGET = Object.freeze({
  width: 1440,
  height: 960,
});
const MOBILE_BREAKPOINT = 820;
const MOBILE_2D_PIECE_SCALE = 1.22;

const VIEW_MODES = Object.freeze({
  THREE_D: '3d',
  TWO_D: '2d',
});

const VIEW_LABELS = Object.freeze({
  [VIEW_MODES.THREE_D]: '3D',
  [VIEW_MODES.TWO_D]: '2D',
});

const SAVE_STORAGE_KEY = 'xiangqi-3d-save-v3';
const TWO_D_ROTATION_STEP = Math.PI / 4;
const TWO_D_DRAG_ROTATE_SPEED = 0.006;
const TWO_D_DRAG_THRESHOLD = 4;

const appRoot = document.querySelector('#app');

appRoot.innerHTML = `
  <div class="app-shell">
    <header class="hero">
      <section class="hero-copy">
        <p class="eyebrow">Three.js Xiangqi PWA</p>
        <h1>3D 象棋對局場</h1>
        <p class="subtitle">
          棋盤視窗已加大，右側資訊區與上方控制區縮小，讓對局畫面更集中。點選棋子與交叉點即可走子，
          滑動場景可旋轉視角，雙指可縮放。
        </p>
      </section>
    </header>

    <main class="board-layout">
      <section class="stage-panel">
        <div class="status-row">
          <div class="status-pill">
            <span class="dot"></span>
            <span id="statusText"></span>
          </div>
          <div class="turn-chip" id="turnChip"></div>
        </div>
        <p class="tip" id="tipText"></p>
        <div class="canvas-shell">
          <canvas id="gameCanvas"></canvas>
        </div>
      </section>

      <aside class="info-panel">
        <section class="info-card controls-card">
          <h2>對局控制</h2>
          <div class="field-grid field-grid-right">
            <label class="field" for="sideSelect">
              <span>玩家執方</span>
              <select id="sideSelect">
                <option value="red">紅方先手</option>
                <option value="black">黑方後手</option>
              </select>
            </label>
            <label class="field" for="viewSelect">
              <span>視角模式</span>
              <select id="viewSelect">
                <option value="3d">3D 視角</option>
                <option value="2d">2D 視角</option>
              </select>
            </label>
          </div>
          <div class="button-row button-row-right">
            <button id="newGameButton" class="primary" type="button">重新開局</button>
            <button id="cameraButton" type="button">重置視角</button>
            <button id="undoButton" type="button">後悔一步</button>
            <button id="saveButton" type="button">存檔</button>
            <button id="loadButton" type="button">讀檔</button>
            <button id="rotateLeftButton" type="button">2D 左轉</button>
            <button id="rotateRightButton" type="button">2D 右轉</button>
            <button id="installButton" type="button" hidden>安裝到手機</button>
          </div>
        </section>
        <section class="info-card">
          <h2>AI 強度</h2>
          <label class="field" for="difficultySelect">
            <span>對手等級</span>
            <select id="difficultySelect"></select>
          </label>
          <label class="field" for="openingSelect">
            <span>開局棋譜</span>
            <select id="openingSelect"></select>
          </label>
        </section>
        <section class="info-card">
          <h2>安裝方式</h2>
          <p id="installHint">Android 與桌機瀏覽器會顯示安裝按鈕；iPhone 可用 Safari 分享選單的「加入主畫面」。</p>
        </section>
        <section class="info-card">
          <h2>畫面更新</h2>
          <p>棋盤與棋子改成重用渲染，AI 思考也移到背景執行，走子時不會再整個場景重建。</p>
        </section>
        <section class="info-card">
          <h2>對局摘要</h2>
          <p id="summaryText"></p>
        </section>
      </aside>
    </main>
  </div>
`;

const elements = {
  difficultySelect: document.querySelector('#difficultySelect'),
  openingSelect: document.querySelector('#openingSelect'),
  sideSelect: document.querySelector('#sideSelect'),
  viewSelect: document.querySelector('#viewSelect'),
  newGameButton: document.querySelector('#newGameButton'),
  cameraButton: document.querySelector('#cameraButton'),
  undoButton: document.querySelector('#undoButton'),
  saveButton: document.querySelector('#saveButton'),
  loadButton: document.querySelector('#loadButton'),
  rotateLeftButton: document.querySelector('#rotateLeftButton'),
  rotateRightButton: document.querySelector('#rotateRightButton'),
  installButton: document.querySelector('#installButton'),
  statusText: document.querySelector('#statusText'),
  tipText: document.querySelector('#tipText'),
  turnChip: document.querySelector('#turnChip'),
  summaryText: document.querySelector('#summaryText'),
  installHint: document.querySelector('#installHint'),
  canvas: document.querySelector('#gameCanvas'),
};

Object.values(DIFFICULTIES).forEach((difficulty) => {
  const option = document.createElement('option');
  option.value = difficulty.key;
  option.textContent = difficulty.label;
  elements.difficultySelect.append(option);
});

Object.values(OPENING_PROFILES).forEach((profile) => {
  const option = document.createElement('option');
  option.value = profile.key;
  option.textContent = profile.label;
  elements.openingSelect.append(option);
});

elements.difficultySelect.value = 'medium';
elements.openingSelect.value = OPENING_PROFILES.all.key;
elements.sideSelect.value = SIDES.RED;
elements.viewSelect.value = VIEW_MODES.THREE_D;

const aiWorker = new Worker(new URL('./aiWorker.js', import.meta.url), { type: 'module' });

const state = {
  board: createInitialBoard(),
  currentTurn: SIDES.RED,
  humanSide: SIDES.RED,
  aiSide: SIDES.BLACK,
  difficulty: 'medium',
  openingProfile: OPENING_PROFILES.all.key,
  viewMode: VIEW_MODES.THREE_D,
  selectedCell: null,
  selectedMoves: [],
  lastMove: null,
  winner: null,
  aiThinking: false,
  statusHint: '點選任一紅棋開始。',
  noticeText: '',
  installPrompt: null,
  aiJobToken: 0,
  moveHistory: [],
  moveLog: [],
  historyStack: [],
};

function createBoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 4608;
  const context = canvas.getContext('2d');

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#fff7ea');
  gradient.addColorStop(0.55, '#f3ddbc');
  gradient.addColorStop(1, '#e8c89b');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let strip = 0; strip < 32; strip += 1) {
    const alpha = strip % 2 === 0 ? 0.022 : 0.009;
    context.fillStyle = `rgba(70, 38, 20, ${alpha})`;
    context.fillRect(0, (canvas.height / 32) * strip, canvas.width, canvas.height / 32);
  }

  const marginX = 440;
  const marginY = 360;
  const fileGap = (canvas.width - marginX * 2) / 8;
  const rankGap = (canvas.height - marginY * 2) / 9;
  const point = (row, col) => ({
    x: marginX + fileGap * col,
    y: marginY + rankGap * row,
  });

  context.strokeStyle = 'rgba(20, 15, 12, 0.96)';
  context.lineWidth = 16;
  context.lineCap = 'round';

  context.strokeRect(
    marginX - 94,
    marginY - 94,
    fileGap * 8 + 188,
    rankGap * 9 + 188,
  );
  context.strokeRect(
    marginX - 34,
    marginY - 34,
    fileGap * 8 + 68,
    rankGap * 9 + 68,
  );

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const start = point(row, 0);
    const end = point(row, 8);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  for (let col = 0; col < BOARD_COLS; col += 1) {
    const top = point(0, col);
    const upperRiver = point(4, col);
    const lowerRiver = point(5, col);
    const bottom = point(9, col);

    if (col === 0 || col === 8) {
      context.beginPath();
      context.moveTo(top.x, top.y);
      context.lineTo(bottom.x, bottom.y);
      context.stroke();
      continue;
    }

    context.beginPath();
    context.moveTo(top.x, top.y);
    context.lineTo(upperRiver.x, upperRiver.y);
    context.stroke();

    context.beginPath();
    context.moveTo(lowerRiver.x, lowerRiver.y);
    context.lineTo(bottom.x, bottom.y);
    context.stroke();
  }

  const palaceLines = [
    [point(0, 3), point(2, 5)],
    [point(0, 5), point(2, 3)],
    [point(7, 3), point(9, 5)],
    [point(7, 5), point(9, 3)],
  ];

  palaceLines.forEach(([start, end]) => {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });

  context.fillStyle = 'rgba(58, 40, 26, 0.5)';
  context.font = '168px "Palatino Linotype", "DFKai-SB", serif';
  context.textAlign = 'center';
  context.fillText('楚 河', canvas.width * 0.29, canvas.height * 0.515);
  context.fillText('漢 界', canvas.width * 0.71, canvas.height * 0.515);

  const markerColor = 'rgba(26, 20, 16, 0.76)';
  const drawMarker = (row, col) => {
    const { x, y } = point(row, col);
    const offset = 54;
    const arm = 36;
    const sign = col < 4 ? 1 : -1;

    context.strokeStyle = markerColor;
    context.lineWidth = 10;

    [
      [x + offset * sign, y - offset, x + arm * sign, y - offset, x + arm * sign, y - arm],
      [x + offset * sign, y + offset, x + arm * sign, y + offset, x + arm * sign, y + arm],
    ].forEach(([sx, sy, mx, my, ex, ey]) => {
      context.beginPath();
      context.moveTo(sx, sy);
      context.lineTo(mx, my);
      context.lineTo(ex, ey);
      context.stroke();
    });

    if (col > 0 && col < 8) {
      [
        [x - offset * sign, y - offset, x - arm * sign, y - offset, x - arm * sign, y - arm],
        [x - offset * sign, y + offset, x - arm * sign, y + offset, x - arm * sign, y + arm],
      ].forEach(([sx, sy, mx, my, ex, ey]) => {
        context.beginPath();
        context.moveTo(sx, sy);
        context.lineTo(mx, my);
        context.lineTo(ex, ey);
        context.stroke();
      });
    }
  };

  [
    [2, 1],
    [2, 7],
    [7, 1],
    [7, 7],
    [3, 0],
    [3, 2],
    [3, 4],
    [3, 6],
    [3, 8],
    [6, 0],
    [6, 2],
    [6, 4],
    [6, 6],
    [6, 8],
  ].forEach(([row, col]) => drawMarker(row, col));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

class BoardScene {
  constructor(canvas, onCellSelect) {
    this.canvas = canvas;
    this.onCellSelect = onCellSelect;
    this.spacing = 1.18 * 1.5;
    this.boardPadding = 2.4;
    this.boardWidth = this.spacing * (BOARD_COLS - 1) + this.boardPadding;
    this.boardHeight = this.spacing * (BOARD_ROWS - 1) + this.boardPadding;
    this.halfCols = (BOARD_COLS - 1) / 2;
    this.halfRows = (BOARD_ROWS - 1) / 2;
    this.textureCache = new Map();
    this.clock = new THREE.Clock();
    this.highlightMeshes = [];
    this.pieceRecords = new Map();
    this.boardRotation = 0;
    this.isMobileLayout = this.isMobileViewport();
    this.viewportState = {
      width: 0,
      height: 0,
      pixelRatio: 0,
    };

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x302720, 0.014);

    this.perspectiveCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
    this.orthographicCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 120);
    this.activeCamera = this.perspectiveCamera;
    this.currentViewMode = VIEW_MODES.THREE_D;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearAlpha(0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.maxAnisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());

    this.controls = new OrbitControls(this.perspectiveCamera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.applyPerspectiveView();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDrag = {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      moved: false,
      totalDistance: 0,
    };

    this.boardRoot = new THREE.Group();
    this.boardGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.pieceGroup = new THREE.Group();
    this.boardRoot.add(this.boardGroup, this.highlightGroup, this.pieceGroup);
    this.scene.add(this.boardRoot);

    this.createEnvironment();
    this.createBoard();
    this.attachEvents();
    this.resize(true);
    this.setViewMode(VIEW_MODES.THREE_D, true);
    this.animate = this.animate.bind(this);
    this.renderer.setAnimationLoop(this.animate);
  }

  applyPerspectiveView() {
    if (this.isMobileViewport()) {
      this.perspectiveCamera.position.set(0, 58.4, 14.2);
      this.controls.minDistance = 28;
      this.controls.maxDistance = 64;
      this.controls.minPolarAngle = Math.PI * 0.03;
      this.controls.maxPolarAngle = Math.PI * 0.16;
      this.controls.target.set(0, 0.44, 0.08);
    } else {
      this.perspectiveCamera.position.set(0, 36.2, 11.3);
      this.controls.minDistance = 18.4;
      this.controls.maxDistance = 29.6;
      this.controls.minPolarAngle = Math.PI * 0.06;
      this.controls.maxPolarAngle = Math.PI * 0.19;
      this.controls.target.set(0, 0.46, 0.08);
    }
    this.controls.enabled = true;
    this.controls.update();
  }

  updateOrthographicFrustum(width, height) {
    const aspect = Math.max(width / height, 0.1);
    const isMobile = this.isMobileViewport();
    let halfHeight = this.boardHeight * (isMobile ? 0.53 : 0.59);
    let halfWidth = halfHeight * aspect;
    const requiredHalfWidth = this.boardWidth * (isMobile ? 0.5 : 0.56);

    if (halfWidth < requiredHalfWidth) {
      halfWidth = requiredHalfWidth;
      halfHeight = halfWidth / aspect;
    }

    this.orthographicCamera.left = -halfWidth;
    this.orthographicCamera.right = halfWidth;
    this.orthographicCamera.top = halfHeight;
    this.orthographicCamera.bottom = -halfHeight;
    this.orthographicCamera.updateProjectionMatrix();
  }

  applyOrthographicView() {
    this.controls.enabled = false;
    this.orthographicCamera.up.set(0, 0, -1);
    this.orthographicCamera.position.set(0, 30, 0.001);
    this.orthographicCamera.lookAt(0, 0.18, 0);
  }

  setBoardRotation(rotation, immediate = false) {
    this.boardRotation = rotation;
    if (immediate) {
      this.boardRoot.rotation.y = rotation;
    }
  }

  rotateBoard(delta) {
    this.setBoardRotation(this.boardRotation + delta);
  }

  getBoardRotation() {
    return this.boardRotation;
  }

  setViewMode(viewMode, force = false) {
    if (!force && this.currentViewMode === viewMode) {
      return;
    }

    this.currentViewMode = viewMode;

    if (viewMode === VIEW_MODES.TWO_D) {
      this.activeCamera = this.orthographicCamera;
      this.applyOrthographicView();
      this.applyPieceScaleForView();
      return;
    }

    this.activeCamera = this.perspectiveCamera;
    this.applyPerspectiveView();
    this.applyPieceScaleForView();
  }

  createEnvironment() {
    const ambient = new THREE.HemisphereLight(0xfff2d6, 0x4a5662, 2.15);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffefcf, 1.7);
    keyLight.position.set(3.6, 12, 2.8);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xb4dfff, 1.15, 42, 2);
    rimLight.position.set(-6, 7, -4);
    this.scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(17.5, 128),
      new THREE.MeshBasicMaterial({
        color: 0xf8debf,
        transparent: true,
        opacity: 0.16,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.7;
    this.scene.add(floor);
  }

  createBoard() {
    const boardTexture = createBoardTexture();
    boardTexture.anisotropy = this.maxAnisotropy;

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(this.boardWidth + 0.9, 0.86, this.boardHeight + 0.9),
      new THREE.MeshStandardMaterial({
        color: 0xb7865d,
        roughness: 0.76,
        metalness: 0.06,
      }),
    );
    plinth.position.y = -0.24;
    this.boardGroup.add(plinth);

    this.boardSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(this.boardWidth, this.boardHeight),
      new THREE.MeshStandardMaterial({
        color: 0xfffcf3,
        map: boardTexture,
        roughness: 0.82,
        metalness: 0.04,
        emissive: 0x2a160a,
        emissiveIntensity: 0.02,
      }),
    );
    this.boardSurface.rotation.x = -Math.PI / 2;
    this.boardSurface.position.y = 0.18;
    this.boardGroup.add(this.boardSurface);
    this.createBoardLines();

    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(this.boardWidth * 0.385, 0.12, 18, 96),
      new THREE.MeshStandardMaterial({
        color: 0xca9e68,
        roughness: 0.38,
        metalness: 0.2,
      }),
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -0.56;
    trim.scale.set(1, this.boardHeight / this.boardWidth, 1);
    this.boardRoot.add(trim);
  }

  createBoardLine(length, thickness, color = 0x050505) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.026, thickness),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      }),
    );
  }

  createBoardLines() {
    this.lineGroup = new THREE.Group();
    this.lineGroup.position.y = 0.205;
    this.boardGroup.add(this.lineGroup);

    const edgeColor = 0x020202;
    const gridColor = 0x050505;
    const horizontalLength = (BOARD_COLS - 1) * this.spacing + 0.18;
    const verticalThickness = 0.09;
    const horizontalThickness = 0.09;
    const splitLength = 4 * this.spacing + 0.12;

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      const { z } = this.gridToWorld(row, 0);
      const mesh = this.createBoardLine(
        horizontalLength,
        horizontalThickness,
        row === 0 || row === BOARD_ROWS - 1 ? edgeColor : gridColor,
      );
      mesh.position.z = z;
      mesh.renderOrder = 2;
      this.lineGroup.add(mesh);
    }

    for (let col = 0; col < BOARD_COLS; col += 1) {
      const { x } = this.gridToWorld(0, col);

      if (col === 0 || col === BOARD_COLS - 1) {
        const fullLine = this.createBoardLine(
          verticalThickness,
          (BOARD_ROWS - 1) * this.spacing + 0.18,
          edgeColor,
        );
        fullLine.position.x = x;
        fullLine.renderOrder = 2;
        this.lineGroup.add(fullLine);
        continue;
      }

      const upperLine = this.createBoardLine(verticalThickness, splitLength, gridColor);
      upperLine.position.set(x, 0, this.gridToWorld(2, 0).z);
      upperLine.renderOrder = 2;
      this.lineGroup.add(upperLine);

      const lowerLine = this.createBoardLine(verticalThickness, splitLength, gridColor);
      lowerLine.position.set(x, 0, this.gridToWorld(7, 0).z);
      lowerLine.renderOrder = 2;
      this.lineGroup.add(lowerLine);
    }

    [
      [0, 3, 2, 5],
      [0, 5, 2, 3],
      [7, 3, 9, 5],
      [7, 5, 9, 3],
    ].forEach(([fromRow, fromCol, toRow, toCol]) => {
      const start = this.gridToWorld(fromRow, fromCol);
      const end = this.gridToWorld(toRow, toCol);
      const distance = Math.hypot(end.x - start.x, end.z - start.z);
      const diagonal = this.createBoardLine(0.08, distance + 0.1, edgeColor);
      diagonal.position.set((start.x + end.x) / 2, 0, (start.z + end.z) / 2);
      diagonal.rotation.y = Math.atan2(end.x - start.x, end.z - start.z);
      diagonal.renderOrder = 2;
      this.lineGroup.add(diagonal);
    });
  }

  attachEvents() {
    this.handleResize = () => this.resize();
    this.handlePointerDown = (event) => this.onPointerDown(event);
    this.handlePointerMove = (event) => this.onPointerMove(event);
    this.handlePointerUp = (event) => this.onPointerUp(event);
    this.handlePointerCancel = (event) => this.onPointerCancel(event);
    window.addEventListener('resize', this.handleResize);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
  }

  gridToWorld(row, col) {
    return {
      x: (col - this.halfCols) * this.spacing,
      z: (row - this.halfRows) * this.spacing,
    };
  }

  worldToGrid(point) {
    const localPoint = this.boardRoot.worldToLocal(point.clone());
    const col = Math.round(localPoint.x / this.spacing + this.halfCols);
    const row = Math.round(localPoint.z / this.spacing + this.halfRows);

    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
      return null;
    }

    const world = this.gridToWorld(row, col);
    const distance = Math.hypot(localPoint.x - world.x, localPoint.z - world.z);
    if (distance > this.spacing * 0.46) {
      return null;
    }

    return { row, col };
  }

  getTargetRenderSize() {
    return this.isMobileViewport() ? MOBILE_RENDER_TARGET : DESKTOP_RENDER_TARGET;
  }

  getPixelRatio(width, height) {
    const target = this.getTargetRenderSize();
    const requestedScale = Math.max(target.width / width, target.height / height, 1);
    const basePixelRatio = window.devicePixelRatio || 1;
    const maxPixelRatio = this.isMobileViewport() ? 2.2 : 3;
    return Math.min(maxPixelRatio, Math.max(basePixelRatio, requestedScale));
  }

  resize(force = false) {
    const width = Math.max(1, Math.floor(this.canvas.clientWidth));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight));
    const pixelRatio = this.getPixelRatio(width, height);
    const mobileLayout = this.isMobileViewport();
    const mobileLayoutChanged = mobileLayout !== this.isMobileLayout;

    if (
      !force &&
      !mobileLayoutChanged &&
      width === this.viewportState.width &&
      height === this.viewportState.height &&
      Math.abs(pixelRatio - this.viewportState.pixelRatio) < 0.01
    ) {
      return;
    }

    this.isMobileLayout = mobileLayout;
    this.viewportState = { width, height, pixelRatio };
    this.perspectiveCamera.aspect = width / height;
    this.perspectiveCamera.updateProjectionMatrix();
    this.updateOrthographicFrustum(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    if (force || mobileLayoutChanged) {
      if (this.currentViewMode === VIEW_MODES.TWO_D) {
        this.applyOrthographicView();
      } else {
        this.applyPerspectiveView();
      }
      this.applyPieceScaleForView();
    }
  }

  isMobileViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  getPieceScaleForView() {
    if (this.currentViewMode === VIEW_MODES.TWO_D && this.isMobileViewport()) {
      return MOBILE_2D_PIECE_SCALE;
    }
    return 1;
  }

  applyPieceScaleForView() {
    const pieceScale = this.getPieceScaleForView();
    for (const record of this.pieceRecords.values()) {
      record.group.scale.setScalar(pieceScale);
    }
  }

  getLabelTexture(side, type) {
    const key = `${side}:${type}`;
    if (this.textureCache.has(key)) {
      return this.textureCache.get(key);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = side === SIDES.RED ? 'rgba(139, 36, 23, 0.95)' : 'rgba(42, 40, 38, 0.95)';
    context.font = 'bold 304px "Palatino Linotype", "DFKai-SB", serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(PIECE_LABELS[side][type], canvas.width / 2, canvas.height / 2 + 10);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.maxAnisotropy;
    this.textureCache.set(key, texture);
    return texture;
  }

  createPieceRecord(piece) {
    const group = new THREE.Group();
    group.scale.setScalar(this.getPieceScaleForView());
    group.userData = {
      kind: 'piece',
      row: 0,
      col: 0,
      pieceId: piece.id,
    };
    const bodyBaseColor = piece.side === SIDES.RED ? 0xf3e2c7 : 0xd9d3cb;
    const lowerBaseColor = 0x4f79d8;
    const ringBaseColor = piece.side === SIDES.RED ? 0xa53f2f : 0x474240;
    const selectedPieceColor = 0xffd64a;
    const selectedRingColor = 0xf0b61f;

    const upperBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.65, 0.14, 56),
      new THREE.MeshStandardMaterial({
        color: bodyBaseColor,
        roughness: 0.58,
        metalness: 0.08,
      }),
    );
    upperBody.position.y = 0.07;
    group.add(upperBody);

    const lowerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.68, 0.14, 56),
      new THREE.MeshStandardMaterial({
        color: lowerBaseColor,
        roughness: 0.48,
        metalness: 0.16,
      }),
    );
    lowerBody.position.y = -0.07;
    group.add(lowerBody);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.41, 0.055, 18, 56),
      new THREE.MeshStandardMaterial({
        color: ringBaseColor,
        roughness: 0.4,
        metalness: 0.2,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 0.88),
      new THREE.MeshBasicMaterial({
        map: this.getLabelTexture(piece.side, piece.type),
        transparent: true,
      }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.16;
    group.add(label);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.74, 40),
      new THREE.MeshBasicMaterial({
        color: 0x06080d,
        transparent: true,
        opacity: 0.16,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.18;
    shadow.scale.setScalar(1.08);
    group.add(shadow);

    this.pieceGroup.add(group);

    const record = {
      id: piece.id,
      group,
      baseY: 0.38,
      phase: Math.random() * Math.PI * 2,
      selected: false,
      spotlight: false,
      targetX: 0,
      targetZ: 0,
      body: upperBody,
      lowerBody,
      ring,
      label,
      shadow,
      bodyBaseColor,
      lowerBaseColor,
      ringBaseColor,
      selectedPieceColor,
      selectedRingColor,
    };

    this.pieceRecords.set(piece.id, record);
    return record;
  }

  updatePieceRecord(record, piece, row, col, isSelected, isLastMoveCell) {
    const { x, z } = this.gridToWorld(row, col);
    record.targetX = x;
    record.targetZ = z;
    record.selected = isSelected;
    record.spotlight = isLastMoveCell;
    record.group.userData.row = row;
    record.group.userData.col = col;

    if (record.group.position.lengthSq() === 0) {
      record.group.position.set(x, record.baseY, z);
    }

    record.body.material.color.setHex(isSelected ? record.selectedPieceColor : record.bodyBaseColor);
    record.lowerBody.material.color.setHex(
      isSelected ? record.selectedPieceColor : record.lowerBaseColor,
    );
    record.ring.material.color.setHex(isSelected ? record.selectedRingColor : record.ringBaseColor);
  }

  disposeObject(object) {
    object.traverse((node) => {
      if (node.geometry) {
        node.geometry.dispose();
      }
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach((material) => material.dispose?.());
        } else {
          node.material.dispose?.();
        }
      }
    });
  }

  removeInactivePieces(activeIds) {
    for (const [pieceId, record] of this.pieceRecords.entries()) {
      if (activeIds.has(pieceId)) {
        continue;
      }
      this.pieceGroup.remove(record.group);
      this.disposeObject(record.group);
      this.pieceRecords.delete(pieceId);
    }
  }

  disposeHighlights() {
    while (this.highlightGroup.children.length > 0) {
      const child = this.highlightGroup.children[0];
      this.disposeObject(child);
      this.highlightGroup.remove(child);
    }
  }

  renderHighlights(selectedCell, selectedMoves, lastMove) {
    this.disposeHighlights();
    this.highlightMeshes = [];

    if (selectedCell) {
      const { x, z } = this.gridToWorld(selectedCell.row, selectedCell.col);
      const selectionRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.78, 0.06, 14, 64),
        new THREE.MeshBasicMaterial({
          color: 0xffd474,
          transparent: true,
          opacity: 0.84,
        }),
      );
      selectionRing.rotation.x = Math.PI / 2;
      selectionRing.position.set(x, 0.21, z);
      this.highlightGroup.add(selectionRing);
      this.highlightMeshes.push({ mesh: selectionRing, baseOpacity: 0.84 });
    }

    selectedMoves.forEach((move) => {
      const { x, z } = this.gridToWorld(move.to.row, move.to.col);
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry((move.captured ? 0.38 : 0.22) * 1.3, 32),
        new THREE.MeshBasicMaterial({
          color: 0x0f6b38,
          transparent: true,
          opacity: move.captured ? 0.78 : 0.68,
        }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x, 0.205, z);
      this.highlightGroup.add(marker);
      this.highlightMeshes.push({
        mesh: marker,
        baseOpacity: move.captured ? 0.78 : 0.68,
      });
    });

    if (lastMove) {
      [lastMove.from, lastMove.to].forEach((cell, index) => {
        const { x, z } = this.gridToWorld(cell.row, cell.col);
        const halo = new THREE.Mesh(
          new THREE.CircleGeometry(0.5, 36),
          new THREE.MeshBasicMaterial({
            color: index === 0 ? 0x8fd1ff : 0xffd27c,
            transparent: true,
            opacity: 0.28,
          }),
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.set(x, 0.196, z);
        this.highlightGroup.add(halo);
      });
    }
  }

  renderBoard(board, selectedCell, selectedMoves, lastMove) {
    const activeIds = new Set();

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const piece = board[row][col];
        if (!piece) {
          continue;
        }

        const pieceId = piece.id ?? `${piece.side}-${piece.type}-${row}-${col}`;
        const isSelected = selectedCell?.row === row && selectedCell?.col === col;
        const isLastMoveCell =
          (lastMove?.from.row === row && lastMove?.from.col === col) ||
          (lastMove?.to.row === row && lastMove?.to.col === col);

        const record = this.pieceRecords.get(pieceId) ?? this.createPieceRecord(piece);
        activeIds.add(pieceId);
        this.updatePieceRecord(record, piece, row, col, isSelected, isLastMoveCell);
      }
    }

    this.removeInactivePieces(activeIds);
    this.renderHighlights(selectedCell, selectedMoves, lastMove);
  }

  findInteractiveParent(object) {
    let node = object;
    while (node) {
      if (node.userData?.kind === 'piece') {
        return node;
      }
      node = node.parent;
    }
    return null;
  }

  pickCellFromPointerEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.activeCamera);

    const intersections = this.raycaster.intersectObjects(
      [...this.pieceGroup.children, this.boardSurface],
      true,
    );

    if (intersections.length === 0) {
      this.onCellSelect(null);
      return;
    }

    const hit = intersections[0];
    const pieceParent = this.findInteractiveParent(hit.object);
    if (pieceParent) {
      this.onCellSelect({ row: pieceParent.userData.row, col: pieceParent.userData.col });
      return;
    }

    const cell = this.worldToGrid(hit.point);
    this.onCellSelect(cell);
  }

  onPointerDown(event) {
    if (this.currentViewMode !== VIEW_MODES.TWO_D) {
      this.pickCellFromPointerEvent(event);
      return;
    }

    this.pointerDrag.active = true;
    this.pointerDrag.pointerId = event.pointerId;
    this.pointerDrag.lastX = event.clientX;
    this.pointerDrag.lastY = event.clientY;
    this.pointerDrag.moved = false;
    this.pointerDrag.totalDistance = 0;

    if (typeof this.canvas.setPointerCapture === 'function') {
      this.canvas.setPointerCapture(event.pointerId);
    }
  }

  onPointerMove(event) {
    if (!this.pointerDrag.active || event.pointerId !== this.pointerDrag.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.pointerDrag.lastX;
    const deltaY = event.clientY - this.pointerDrag.lastY;
    this.pointerDrag.lastX = event.clientX;
    this.pointerDrag.lastY = event.clientY;
    this.pointerDrag.totalDistance += Math.hypot(deltaX, deltaY);

    if (this.pointerDrag.totalDistance < TWO_D_DRAG_THRESHOLD) {
      return;
    }

    this.pointerDrag.moved = true;
    this.rotateBoard(-deltaX * TWO_D_DRAG_ROTATE_SPEED);
  }

  endPointerDrag(pointerId) {
    if (
      typeof this.canvas.hasPointerCapture === 'function' &&
      this.canvas.hasPointerCapture(pointerId)
    ) {
      this.canvas.releasePointerCapture(pointerId);
    }

    this.pointerDrag.active = false;
    this.pointerDrag.pointerId = null;
    this.pointerDrag.lastX = 0;
    this.pointerDrag.lastY = 0;
    this.pointerDrag.moved = false;
    this.pointerDrag.totalDistance = 0;
  }

  onPointerUp(event) {
    if (!this.pointerDrag.active || event.pointerId !== this.pointerDrag.pointerId) {
      return;
    }

    const shouldSelect = !this.pointerDrag.moved;
    this.endPointerDrag(event.pointerId);

    if (this.currentViewMode === VIEW_MODES.TWO_D && shouldSelect) {
      this.pickCellFromPointerEvent(event);
    }
  }

  onPointerCancel(event) {
    if (!this.pointerDrag.active || event.pointerId !== this.pointerDrag.pointerId) {
      return;
    }
    this.endPointerDrag(event.pointerId);
  }

  resetCamera() {
    this.setBoardRotation(0, true);
    this.setViewMode(this.currentViewMode, true);
  }

  animate() {
    this.resize();
    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    for (const record of this.pieceRecords.values()) {
      const lift =
        record.selected
          ? 0.12 + Math.sin(elapsed * 5 + record.phase) * 0.028
          : record.spotlight
            ? 0.04 + Math.sin(elapsed * 4 + record.phase) * 0.014
            : 0;

      record.group.position.x = THREE.MathUtils.damp(
        record.group.position.x,
        record.targetX,
        11,
        delta,
      );
      record.group.position.z = THREE.MathUtils.damp(
        record.group.position.z,
        record.targetZ,
        11,
        delta,
      );
      record.group.position.y = THREE.MathUtils.damp(
        record.group.position.y,
        record.baseY + lift,
        10,
        delta,
      );
    }

    this.boardRoot.rotation.y = THREE.MathUtils.damp(
      this.boardRoot.rotation.y,
      this.boardRotation,
      10,
      delta,
    );

    this.highlightMeshes.forEach(({ mesh, baseOpacity }, index) => {
      mesh.material.opacity = baseOpacity + Math.sin(elapsed * 3.4 + index) * 0.08;
    });

    if (this.controls.enabled) {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.activeCamera);
  }
}

function sideName(side) {
  return SIDE_LABELS[side];
}

function getDifficultyLabel() {
  return DIFFICULTIES[state.difficulty].label;
}

function getViewLabel() {
  return VIEW_LABELS[state.viewMode];
}

function clearSelection() {
  state.selectedCell = null;
  state.selectedMoves = [];
}

const boardScene = new BoardScene(elements.canvas, handleBoardTap);
boardScene.setViewMode(state.viewMode, true);

function cloneMove(move) {
  if (!move) {
    return null;
  }

  return {
    from: { ...move.from },
    to: { ...move.to },
    piece: move.piece ? { ...move.piece } : null,
    captured: move.captured ? { ...move.captured } : null,
  };
}

function cloneMoveLogEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    key: entry.key,
    side: entry.side,
    givesCheck: Boolean(entry.givesCheck),
  };
}

function cloneSnapshot(snapshot) {
  if (!snapshot?.board) {
    return null;
  }

  return {
    board: cloneBoard(snapshot.board),
    currentTurn: snapshot.currentTurn ?? SIDES.RED,
    humanSide: snapshot.humanSide ?? SIDES.RED,
    aiSide: snapshot.aiSide ?? SIDES.BLACK,
    difficulty: snapshot.difficulty ?? 'medium',
    openingProfile: snapshot.openingProfile ?? OPENING_PROFILES.all.key,
    viewMode: snapshot.viewMode ?? VIEW_MODES.THREE_D,
    lastMove: cloneMove(snapshot.lastMove),
    winner: snapshot.winner ?? null,
    moveHistory: Array.isArray(snapshot.moveHistory) ? [...snapshot.moveHistory] : [],
    moveLog: Array.isArray(snapshot.moveLog)
      ? snapshot.moveLog.map((entry) => cloneMoveLogEntry(entry)).filter(Boolean)
      : [],
    boardRotation: Number.isFinite(snapshot.boardRotation) ? snapshot.boardRotation : 0,
  };
}

function createStateSnapshot() {
  return cloneSnapshot({
    board: state.board,
    currentTurn: state.currentTurn,
    humanSide: state.humanSide,
    aiSide: state.aiSide,
    difficulty: state.difficulty,
    openingProfile: state.openingProfile,
    viewMode: state.viewMode,
    lastMove: state.lastMove,
    winner: state.winner,
    moveHistory: state.moveHistory,
    moveLog: state.moveLog,
    boardRotation: boardScene.getBoardRotation(),
  });
}

function syncControlsToState() {
  elements.sideSelect.value = state.humanSide;
  elements.difficultySelect.value = state.difficulty;
  elements.openingSelect.value = state.openingProfile;
  elements.viewSelect.value = state.viewMode;
}

function applySnapshot(snapshot, historyStack = state.historyStack) {
  const normalized = cloneSnapshot(snapshot);
  if (!normalized) {
    return false;
  }

  state.board = normalized.board;
  state.currentTurn = normalized.currentTurn;
  state.humanSide = normalized.humanSide;
  state.aiSide = normalized.aiSide;
  state.difficulty = normalized.difficulty;
  state.openingProfile = normalized.openingProfile;
  state.viewMode = normalized.viewMode;
  state.lastMove = normalized.lastMove;
  state.winner = normalized.winner;
  state.aiThinking = false;
  state.moveHistory = [...normalized.moveHistory];
  state.moveLog = normalized.moveLog.map((entry) => cloneMoveLogEntry(entry)).filter(Boolean);
  state.historyStack = historyStack
    .map((entry) => cloneSnapshot(entry))
    .filter(Boolean);
  clearSelection();
  syncControlsToState();
  boardScene.setViewMode(state.viewMode, true);
  boardScene.setBoardRotation(normalized.boardRotation, true);
  return true;
}

function persistSaveState(showFeedback = false) {
  try {
    const payload = {
      version: 3,
      snapshot: createStateSnapshot(),
      historyStack: state.historyStack.map((entry) => cloneSnapshot(entry)),
    };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    if (showFeedback) {
      state.noticeText = '已存檔，可稍後用「讀檔」接續對局。';
      renderHud();
    }
    return true;
  } catch (error) {
    if (showFeedback) {
      state.noticeText = '存檔失敗，請確認瀏覽器允許本機儲存。';
      renderHud();
    }
    return false;
  }
}

function undoLastStep() {
  if (state.historyStack.length === 0) {
    state.noticeText = '目前沒有可返回的步數。';
    renderHud();
    return;
  }

  state.aiJobToken += 1;
  const snapshot = state.historyStack.pop();
  applySnapshot(snapshot, state.historyStack);
  state.noticeText = '已返回一步，連按可繼續往前回到更早的局面。';
  renderBoard();
  persistSaveState(false);
}

function loadSavedGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      state.noticeText = '目前沒有存檔。';
      renderHud();
      return;
    }

    const payload = JSON.parse(raw);
    const historyStack = Array.isArray(payload.historyStack) ? payload.historyStack : [];
    if (!applySnapshot(payload.snapshot, historyStack)) {
      throw new Error('invalid-save');
    }

    state.aiJobToken += 1;
    state.noticeText = '已讀檔，對局已恢復。';
    renderBoard();

    if (!state.winner && state.currentTurn === state.aiSide) {
      queueAIMove();
    }
  } catch (error) {
    state.noticeText = '讀檔失敗，請重新存檔後再試。';
    renderHud();
  }
}
function renderHud() {
  const inCheck = !state.winner && isInCheck(state.board, state.currentTurn);
  const currentDifficulty = getDifficultyLabel();
  const currentOpeningProfile = getOpeningProfileLabel(state.openingProfile);
  const openingBookSize = getOpeningBookSize(state.openingProfile);

  if (state.winner) {
    elements.statusText.textContent = `${sideName(state.winner)}\u7372\u52dd`;
    state.statusHint = '\u6309\u4e0b\u300c\u91cd\u65b0\u958b\u5c40\u300d\u53ef\u7acb\u523b\u518d\u4f86\u4e00\u76e4\u3002';
  } else if (state.aiThinking) {
    elements.statusText.textContent = `AI \u601d\u8003\u4e2d (${currentDifficulty})`;
    state.statusHint = 'AI \u6703\u5728\u591a\u500b\u9ad8\u5206\u5019\u9078\u4e2d\u52a0\u5165\u5fae\u64fe\u8207\u6d17\u724c\uff0c\u756b\u9762\u4e0d\u6703\u6574\u500b\u505c\u4f4f\u3002';
  } else if (state.currentTurn === state.humanSide) {
    elements.statusText.textContent = `\u8f2a\u5230\u4f60 (${sideName(state.humanSide)})`;
    state.statusHint = state.selectedCell
      ? '\u5df2\u9078\u53d6\u68cb\u5b50\uff0c\u8acb\u518d\u9ede\u4e00\u4e0b\u76ee\u7684\u5730\u843d\u5b50\u3002'
      : inCheck
        ? '\u4f60\u76ee\u524d\u88ab\u5c07\u8ecd\uff0c\u8acb\u5148\u89e3\u570d\u3002'
        : '\u5148\u9ede\u4f60\u7684\u68cb\u5b50\uff0c\u518d\u9ede\u8981\u79fb\u52d5\u5230\u7684\u4f4d\u7f6e\u3002';
  } else {
    elements.statusText.textContent = `\u8f2a\u5230 AI (${sideName(state.aiSide)})`;
    state.statusHint = inCheck ? 'AI \u6b63\u5728\u61c9\u5c0d\u5c07\u8ecd\u3002' : '\u7b49\u5f85 AI \u843d\u5b50\u3002';
  }

  elements.tipText.textContent = state.noticeText || state.statusHint;
  state.noticeText = '';
  elements.turnChip.textContent = `${sideName(state.currentTurn)}\u884c\u68cb${inCheck ? '\u30fb\u5c07\u8ecd\u4e2d' : ''}`;
  elements.summaryText.textContent =
    `\u4f60\u57f7 ${sideName(state.humanSide)}\uff0cAI \u70ba ${sideName(state.aiSide)}\uff0c\u96e3\u5ea6\u662f ${currentDifficulty}\uff0c\u68cb\u8b5c\u5305\u662f ${currentOpeningProfile}\uff08${openingBookSize} \u689d\uff09\uff0c\u76ee\u524d\u662f ${getViewLabel()} \u8996\u89d2\u3002AI \u6703\u5728\u9ad8\u5206\u5019\u9078\u4e2d\u52a0\u5165\u5fae\u64fe\uff0c\u4e26\u5728\u958b\u5c40\u524d 15 \u624b\u512a\u5148\u53c3\u8003\u6240\u9078\u68cb\u8b5c\u3002`;
}



function renderBoard() {
  boardScene.renderBoard(
    state.board,
    state.selectedCell,
    state.selectedMoves,
    state.lastMove,
  );
  renderHud();
}

function finishMove(move) {
  const moveSide = state.currentTurn;
  state.historyStack.push(createStateSnapshot());
  if (state.historyStack.length > 160) {
    state.historyStack.shift();
  }

  state.board = applyMove(state.board, move);
  const moveKey = moveToKey(move);
  const givesCheck = isInCheck(state.board, oppositeSide(moveSide));
  state.moveHistory.push(moveKey);
  state.moveLog.push({
    key: moveKey,
    side: moveSide,
    givesCheck,
  });
  if (state.moveLog.length > 240) {
    state.moveLog.shift();
  }
  state.lastMove = move;
  clearSelection();
  state.currentTurn = oppositeSide(state.currentTurn);
  state.winner = getWinner(state.board, state.currentTurn);
  renderBoard();
  persistSaveState(false);
  queueAIMove();
}

function selectPiece(row, col) {
  state.selectedCell = { row, col };
  state.selectedMoves = getLegalMovesForPiece(state.board, row, col).filter(
    (move) =>
      !isMoveBlockedByRepeatedCheck(state.board, move, state.currentTurn, state.moveLog, 3),
  );
  renderBoard();
}

function handleBoardTap(cell) {
  if (state.winner || state.aiThinking || state.currentTurn !== state.humanSide) {
    return;
  }

  if (!cell) {
    clearSelection();
    renderBoard();
    return;
  }

  const piece = state.board[cell.row][cell.col];

  if (piece?.side === state.humanSide) {
    const alreadySelected =
      state.selectedCell?.row === cell.row && state.selectedCell?.col === cell.col;
    if (alreadySelected) {
      clearSelection();
      renderBoard();
      return;
    }
    selectPiece(cell.row, cell.col);
    return;
  }

  const chosenMove = state.selectedMoves.find(
    (move) => move.to.row === cell.row && move.to.col === cell.col,
  );

  if (chosenMove) {
    const blockedByRepeatRule = isMoveBlockedByRepeatedCheck(
      state.board,
      chosenMove,
      state.currentTurn,
      state.moveLog,
      3,
    );
    if (blockedByRepeatRule) {
      state.noticeText = '同樣追殺將帥的走法最多連續 3 回，請改變走法。';
      renderHud();
      return;
    }

    finishMove(chosenMove);
    return;
  }

  clearSelection();
  renderBoard();
}

function queueAIMove() {
  if (state.winner || state.aiThinking || state.currentTurn !== state.aiSide) {
    return;
  }

  const currentToken = ++state.aiJobToken;
  state.aiThinking = true;
  renderHud();

  window.setTimeout(() => {
    if (currentToken !== state.aiJobToken || state.currentTurn !== state.aiSide) {
      return;
    }

    aiWorker.postMessage({
      token: currentToken,
      board: state.board,
      side: state.aiSide,
      difficulty: state.difficulty,
      moveHistory: state.moveHistory,
      openingProfile: state.openingProfile,
      moveLog: state.moveLog,
    });
  }, 120);
}

function restartGame() {
  state.aiJobToken += 1;
  state.board = createInitialBoard();
  state.currentTurn = SIDES.RED;
  state.humanSide = elements.sideSelect.value;
  state.aiSide = oppositeSide(state.humanSide);
  state.difficulty = elements.difficultySelect.value;
  state.openingProfile = elements.openingSelect.value;
  state.winner = null;
  state.aiThinking = false;
  state.lastMove = null;
  state.moveHistory = [];
  state.moveLog = [];
  state.historyStack = [];
  clearSelection();
  boardScene.setBoardRotation(0, true);
  state.statusHint = state.humanSide === SIDES.RED ? '你先手。' : 'AI 先手。';
  renderBoard();
  persistSaveState(false);
  queueAIMove();
}

aiWorker.addEventListener('message', (event) => {
  const { token, move } = event.data;
  if (token !== state.aiJobToken) {
    return;
  }

  state.aiThinking = false;

  if (!move) {
    state.winner = state.humanSide;
    renderHud();
    return;
  }

  finishMove(move);
});

elements.difficultySelect.addEventListener('change', () => {
  state.difficulty = elements.difficultySelect.value;
  renderHud();
});

elements.openingSelect.addEventListener('change', () => {
  state.openingProfile = elements.openingSelect.value;
  renderHud();
});

elements.viewSelect.addEventListener('change', () => {
  state.viewMode = elements.viewSelect.value;
  boardScene.setViewMode(state.viewMode);
  renderHud();
});

elements.sideSelect.addEventListener('change', restartGame);
elements.newGameButton.addEventListener('click', restartGame);
elements.cameraButton.addEventListener('click', () => {
  boardScene.resetCamera();
  state.noticeText = '視角已重置。';
  renderHud();
});
elements.undoButton.addEventListener('click', undoLastStep);
elements.saveButton.addEventListener('click', () => persistSaveState(true));
elements.loadButton.addEventListener('click', loadSavedGame);
elements.rotateLeftButton.addEventListener('click', () => {
  if (state.viewMode !== VIEW_MODES.TWO_D) {
    state.noticeText = '請先切換到 2D 視角，再使用旋轉功能。';
    renderHud();
    return;
  }

  boardScene.rotateBoard(-TWO_D_ROTATION_STEP);
  state.noticeText = '2D 視角已向左旋轉。';
  renderHud();
});
elements.rotateRightButton.addEventListener('click', () => {
  if (state.viewMode !== VIEW_MODES.TWO_D) {
    state.noticeText = '請先切換到 2D 視角，再使用旋轉功能。';
    renderHud();
    return;
  }

  boardScene.rotateBoard(TWO_D_ROTATION_STEP);
  state.noticeText = '2D 視角已向右旋轉。';
  renderHud();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.installPrompt = event;
  elements.installButton.hidden = false;
  elements.installHint.textContent = '已支援安裝，按下「安裝到手機」即可加入主畫面。';
});

window.addEventListener('appinstalled', () => {
  state.installPrompt = null;
  elements.installButton.hidden = true;
  elements.installHint.textContent = '已安裝完成，之後可像一般 App 一樣從主畫面開啟。';
});

elements.installButton.addEventListener('click', async () => {
  if (state.installPrompt) {
    state.installPrompt.prompt();
    await state.installPrompt.userChoice.catch(() => undefined);
    state.installPrompt = null;
    elements.installButton.hidden = true;
    return;
  }

  elements.installHint.textContent = '若沒有安裝按鈕，請使用瀏覽器選單中的「加入主畫面」功能。';
});

window.addEventListener('beforeunload', () => {
  persistSaveState(false);
  aiWorker.terminate();
});

registerPWA();
renderBoard();
