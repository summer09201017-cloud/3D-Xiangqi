export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

export const SIDES = Object.freeze({
  RED: 'red',
  BLACK: 'black',
});

export const PIECE_TYPES = Object.freeze({
  GENERAL: 'general',
  ADVISOR: 'advisor',
  ELEPHANT: 'elephant',
  HORSE: 'horse',
  ROOK: 'rook',
  CANNON: 'cannon',
  SOLDIER: 'soldier',
});

export const SIDE_LABELS = Object.freeze({
  [SIDES.RED]: '\u7d05\u65b9',
  [SIDES.BLACK]: '\u9ed1\u65b9',
});

export const PIECE_LABELS = Object.freeze({
  [SIDES.RED]: {
    [PIECE_TYPES.GENERAL]: '\u5e25',
    [PIECE_TYPES.ADVISOR]: '\u4ed5',
    [PIECE_TYPES.ELEPHANT]: '\u76f8',
    [PIECE_TYPES.HORSE]: '\u508c',
    [PIECE_TYPES.ROOK]: '\u4fe5',
    [PIECE_TYPES.CANNON]: '\u70ae',
    [PIECE_TYPES.SOLDIER]: '\u5175',
  },
  [SIDES.BLACK]: {
    [PIECE_TYPES.GENERAL]: '\u5c07',
    [PIECE_TYPES.ADVISOR]: '\u58eb',
    [PIECE_TYPES.ELEPHANT]: '\u8c61',
    [PIECE_TYPES.HORSE]: '\u99ac',
    [PIECE_TYPES.ROOK]: '\u8eca',
    [PIECE_TYPES.CANNON]: '\u7832',
    [PIECE_TYPES.SOLDIER]: '\u5352',
  },
});

export const PIECE_VALUES = Object.freeze({
  [PIECE_TYPES.GENERAL]: 10000,
  [PIECE_TYPES.ROOK]: 920,
  [PIECE_TYPES.CANNON]: 470,
  [PIECE_TYPES.HORSE]: 430,
  [PIECE_TYPES.ELEPHANT]: 230,
  [PIECE_TYPES.ADVISOR]: 220,
  [PIECE_TYPES.SOLDIER]: 130,
});

export const DIFFICULTIES = Object.freeze({
  novice: {
    key: 'novice',
    label: 'Lv.1',
    depth: 1,
    rootLimit: 10,
    branchLimit: 8,
    noise: 40,
    thinkMs: 180,
    varietyWindow: 120,
    selectionTemperature: 16,
    bookDepth: 15,
    bookChoices: 4,
    bookTemperature: 1.7,
  },
  easy: {
    key: 'easy',
    label: 'Lv.2',
    depth: 2,
    rootLimit: 12,
    branchLimit: 9,
    noise: 24,
    thinkMs: 320,
    varietyWindow: 72,
    selectionTemperature: 10,
    bookDepth: 15,
    bookChoices: 4,
    bookTemperature: 1.45,
  },
  medium: {
    key: 'medium',
    label: 'Lv.3',
    depth: 2,
    rootLimit: 14,
    branchLimit: 11,
    noise: 10,
    thinkMs: 650,
    varietyWindow: 36,
    selectionTemperature: 6,
    bookDepth: 15,
    bookChoices: 3,
    bookTemperature: 1.22,
  },
  hard: {
    key: 'hard',
    label: 'Lv.4',
    depth: 3,
    rootLimit: 18,
    branchLimit: 13,
    noise: 3,
    thinkMs: 1300,
    varietyWindow: 18,
    selectionTemperature: 3.8,
    bookDepth: 15,
    bookChoices: 2,
    bookTemperature: 1.08,
  },
  master: {
    key: 'master',
    label: 'Lv.5',
    depth: 4,
    rootLimit: 20,
    branchLimit: 14,
    noise: 0,
    thinkMs: 2200,
    varietyWindow: 10,
    selectionTemperature: 2.2,
    bookDepth: 15,
    bookChoices: 2,
    bookTemperature: 0.95,
  },
});

const BACK_RANK = [
  PIECE_TYPES.ROOK,
  PIECE_TYPES.HORSE,
  PIECE_TYPES.ELEPHANT,
  PIECE_TYPES.ADVISOR,
  PIECE_TYPES.GENERAL,
  PIECE_TYPES.ADVISOR,
  PIECE_TYPES.ELEPHANT,
  PIECE_TYPES.HORSE,
  PIECE_TYPES.ROOK,
];

function createPiece(id, side, type) {
  return { id, side, type };
}

export function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function createInitialBoard() {
  let nextPieceId = 0;
  const board = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  const placePiece = (row, col, side, type) => {
    board[row][col] = createPiece(`piece-${nextPieceId++}`, side, type);
  };

  BACK_RANK.forEach((type, col) => {
    placePiece(0, col, SIDES.BLACK, type);
    placePiece(9, col, SIDES.RED, type);
  });

  placePiece(2, 1, SIDES.BLACK, PIECE_TYPES.CANNON);
  placePiece(2, 7, SIDES.BLACK, PIECE_TYPES.CANNON);
  placePiece(7, 1, SIDES.RED, PIECE_TYPES.CANNON);
  placePiece(7, 7, SIDES.RED, PIECE_TYPES.CANNON);

  [0, 2, 4, 6, 8].forEach((col) => {
    placePiece(3, col, SIDES.BLACK, PIECE_TYPES.SOLDIER);
    placePiece(6, col, SIDES.RED, PIECE_TYPES.SOLDIER);
  });

  return board;
}
