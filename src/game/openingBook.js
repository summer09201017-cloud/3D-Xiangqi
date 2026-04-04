import {
  PIECE_TYPES,
  SIDES,
  createInitialBoard,
} from './constants.js';
import {
  applyMove,
  getLegalMoves,
  moveToKey,
  oppositeSide,
} from './rules.js';

export const OPENING_PROFILES = Object.freeze({
  all: Object.freeze({
    key: 'all',
    label: '全譜庫',
    description: '自動混合所有開局系統',
  }),
  centralCannon: Object.freeze({
    key: 'centralCannon',
    label: '中炮譜',
    description: '優先使用中炮系開局',
  }),
  elephantOpening: Object.freeze({
    key: 'elephantOpening',
    label: '飛相譜',
    description: '優先使用飛相與穩健布局',
  }),
  horseOpening: Object.freeze({
    key: 'horseOpening',
    label: '起馬譜',
    description: '優先使用起馬與先手搶位',
  }),
  pawnOpening: Object.freeze({
    key: 'pawnOpening',
    label: '仙人指路譜',
    description: '優先使用仙人指路與兵卒起手',
  }),
  none: Object.freeze({
    key: 'none',
    label: '純搜尋',
    description: '不載入任何開局譜',
  }),
});

const PIECE_CODE_TO_TYPE = Object.freeze({
  A: PIECE_TYPES.ADVISOR,
  C: PIECE_TYPES.CANNON,
  E: PIECE_TYPES.ELEPHANT,
  G: PIECE_TYPES.GENERAL,
  H: PIECE_TYPES.HORSE,
  K: PIECE_TYPES.GENERAL,
  P: PIECE_TYPES.SOLDIER,
  R: PIECE_TYPES.ROOK,
});

const ORTHOGONAL_PIECES = new Set([
  PIECE_TYPES.CANNON,
  PIECE_TYPES.GENERAL,
  PIECE_TYPES.ROOK,
  PIECE_TYPES.SOLDIER,
]);

const RAW_OPENINGS = Object.freeze([
  {
    name: 'central-cannon-screen-horse-basic',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 1.5,
    moves: ['C2=5', 'H8+7', 'H2+3', 'H2+3'],
  },
  {
    name: 'same-direction-filed-vs-ranked',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 1.2,
    moves: ['C2=5', 'C8=5', 'H2+3', 'H8+7', 'R1=2', 'R9+1'],
  },
  {
    name: 'same-direction-ranked-vs-filed',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 1.05,
    moves: ['C2=5', 'C8=5', 'H2+3', 'H8+7', 'R1+1', 'R9=8'],
  },
  {
    name: 'same-direction-deferred-horse',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 0.95,
    moves: ['C2=5', 'C8=5', 'H2+3', 'H8+7', 'R1=2', 'H2+3'],
  },
  {
    name: 'same-direction-deferred-pawn',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 0.95,
    moves: ['C2=5', 'C8=5', 'H2+3', 'H8+7', 'R1=2', 'P7+1'],
  },
  {
    name: 'opposite-direction-major',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 0.8,
    moves: ['C2=5', 'C2=5', 'H2+3', 'H8+9'],
  },
  {
    name: 'opposite-direction-minor',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 0.9,
    moves: ['C2=5', 'C2=5', 'H2+3', 'H8+7'],
  },
  {
    name: 'left-cannon-blockade',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 1.0,
    moves: ['C2=5', 'H8+7', 'H2+3', 'R9=8', 'R1=2', 'C8+4', 'P3+1', 'C2=5'],
  },
  {
    name: 'left-three-step-tiger',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 0.9,
    moves: ['C2=5', 'H8+7', 'H2+3', 'R9=8', 'P7+1', 'C8=9', 'H8+7', 'C2=5'],
  },
  {
    name: 'turtle-back-cannons',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com glossary',
    weight: 0.9,
    moves: ['C2=5', 'H8+7', 'H2+3', 'R9+1', 'R1=2', 'C8-1'],
  },
  {
    name: 'measured-attack-57-cannons',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com choosing-your-opening',
    weight: 1.1,
    moves: ['C2=5', 'H2+3', 'H2+3', 'C8=6', 'R1=2', 'H8+7', 'P3+1', 'P3+1', 'H8+9', 'E7+5', 'C8=7', 'R1=2', 'R9=8', 'C2+4'],
  },
  {
    name: 'tooth-for-tooth',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'xiangqi.com choosing-your-opening',
    weight: 1.0,
    moves: ['C2=5', 'H8+7', 'H2+3', 'H2+3', 'R1=2', 'R9=8', 'P7+1', 'P7+1', 'H8+7', 'C2+4', 'P5+1', 'C8+4'],
  },
  {
    name: 'central-cannon-vs-soldier-response',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 1.0,
    moves: ['C2=5', 'P3+1', 'H2+3', 'C8=5'],
  },
  {
    name: 'central-cannon-vs-elephant-screen',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.96,
    moves: ['C2=5', 'E7+5', 'H2+3', 'H8+7'],
  },
  {
    name: 'central-cannon-vs-right-cannon',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.94,
    moves: ['C2=5', 'C8=6', 'H2+3', 'H8+7'],
  },
  {
    name: 'central-cannon-dual-pawn',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.93,
    moves: ['C2=5', 'P3+1', 'P3+1', 'H8+7'],
  },
  {
    name: 'central-cannon-rook-lift-elephant',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.91,
    moves: ['C2=5', 'E7+5', 'R1+1', 'H8+7'],
  },
  {
    name: 'central-cannon-rook-lift-soldier',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.91,
    moves: ['C2=5', 'P3+1', 'R1+1', 'H8+7'],
  },
  {
    name: 'central-cannon-rook-lift-right-cannon',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.9,
    moves: ['C2=5', 'C8=6', 'R1+1', 'H8+7'],
  },
  {
    name: 'central-cannon-vs-anti-horse',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.88,
    moves: ['C2=5', 'H8+9', 'H2+3', 'P3+1'],
  },
  {
    name: 'central-cannon-advance-pawns',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.92,
    moves: ['C2=5', 'H8+7', 'P7+1', 'P7+1'],
  },
  {
    name: 'central-cannon-black-horse-central',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.86,
    moves: ['C2=5', 'P3+1', 'H8+7', 'H2+3'],
  },
  {
    name: 'central-cannon-vs-rook-lift',
    profile: OPENING_PROFILES.centralCannon.key,
    source: 'curated-system-variation',
    weight: 0.88,
    moves: ['C2=5', 'R9+1', 'P7+1', 'P7+1'],
  },
  {
    name: 'elephant-opening-cross-palace',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'xiangqi.com choosing-your-opening',
    weight: 0.9,
    moves: ['E3+5', 'C8=4', 'H2+3', 'H8+7', 'R1=2', 'P7+1', 'P7+1', 'R9+1', 'C2=1', 'E3+5', 'R2+4', 'R9=3', 'H8+9', 'H2+1', 'P9+1', 'P3+1'],
  },
  {
    name: 'elephant-opening-screen-horse',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 1.05,
    moves: ['E3+5', 'H8+7', 'H2+3', 'E7+5'],
  },
  {
    name: 'elephant-opening-vs-right-cannon',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 1.0,
    moves: ['E3+5', 'C8=6', 'H2+3', 'H8+7'],
  },
  {
    name: 'elephant-opening-vs-soldier',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.96,
    moves: ['E3+5', 'P3+1', 'H2+3', 'H8+7'],
  },
  {
    name: 'elephant-opening-mirror',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.94,
    moves: ['E3+5', 'E7+5', 'H2+3', 'H8+7'],
  },
  {
    name: 'elephant-opening-dual-soldiers',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.92,
    moves: ['E3+5', 'H8+7', 'P7+1', 'P7+1'],
  },
  {
    name: 'elephant-opening-soldier-break',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.92,
    moves: ['E3+5', 'P3+1', 'P7+1', 'H8+7'],
  },
  {
    name: 'elephant-opening-left-cannon-pressure',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.9,
    moves: ['E3+5', 'C8+4', 'H2+3', 'P3+1'],
  },
  {
    name: 'elephant-opening-vs-rook-lift',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.88,
    moves: ['E3+5', 'R9+1', 'H2+3', 'H8+7'],
  },
  {
    name: 'elephant-opening-vs-anti-horse',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.87,
    moves: ['E3+5', 'H8+9', 'H2+3', 'P3+1'],
  },
  {
    name: 'elephant-opening-soldier-right-cannon',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.86,
    moves: ['E3+5', 'C8=6', 'P7+1', 'H8+7'],
  },
  {
    name: 'elephant-opening-rook-lift-soldier',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.85,
    moves: ['E3+5', 'P3+1', 'R1+1', 'H8+7'],
  },
  {
    name: 'elephant-opening-rook-lift-mirror',
    profile: OPENING_PROFILES.elephantOpening.key,
    source: 'curated-system-variation',
    weight: 0.84,
    moves: ['E3+5', 'E7+5', 'R1+1', 'H8+7'],
  },
  {
    name: 'horse-opening-pawn-support',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 1.04,
    moves: ['H2+3', 'P3+1', 'C8=5', 'H8+7'],
  },
  {
    name: 'horse-opening-vs-elephant',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 1.0,
    moves: ['H2+3', 'E7+5', 'C8=6', 'H8+7'],
  },
  {
    name: 'horse-opening-vs-left-cannon',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 0.98,
    moves: ['H2+3', 'C8+4', 'C8=5', 'H8+7'],
  },
  {
    name: 'horse-opening-dual-central-pawns',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 0.95,
    moves: ['H2+3', 'H8+7', 'P7+1', 'P7+1'],
  },
  {
    name: 'horse-opening-vs-anti-horse',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 0.93,
    moves: ['H2+3', 'H8+9', 'C8=5', 'E7+5'],
  },
  {
    name: 'horse-opening-vs-rook-lift',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 0.91,
    moves: ['H2+3', 'R9+1', 'C8=5', 'H8+7'],
  },
  {
    name: 'horse-opening-rook-lift-soldier',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 0.89,
    moves: ['H2+3', 'P3+1', 'R1+1', 'H8+7'],
  },
  {
    name: 'horse-opening-double-rook-lift',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 0.85,
    moves: ['H2+3', 'H8+7', 'R1+1', 'R9+1'],
  },
  {
    name: 'horse-opening-soldier-race',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 0.88,
    moves: ['H2+3', 'P3+1', 'P7+1', 'P7+1'],
  },
  {
    name: 'horse-opening-vs-elephant-soldier-race',
    profile: OPENING_PROFILES.horseOpening.key,
    source: 'curated-system-variation',
    weight: 0.87,
    moves: ['H2+3', 'E7+5', 'P7+1', 'P7+1'],
  },
  {
    name: 'pawn-opening-screen-horse',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 1.1,
    moves: ['P7+1', 'H8+7', 'H2+3', 'R9=8'],
  },
  {
    name: 'pawn-opening-vs-left-cannon',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 1.06,
    moves: ['P7+1', 'C8+4', 'H2+3', 'H8+7'],
  },
  {
    name: 'pawn-opening-mirror-soldier',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 1.0,
    moves: ['P7+1', 'P3+1', 'H2+3', 'H8+7'],
  },
  {
    name: 'pawn-opening-vs-elephant',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.98,
    moves: ['P7+1', 'E7+5', 'H2+3', 'H8+7'],
  },
  {
    name: 'pawn-opening-transpose-central-cannon',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.96,
    moves: ['P7+1', 'C8=5', 'C2=5', 'H8+7'],
  },
  {
    name: 'edge-pawn-opening-left-cannon',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.92,
    moves: ['P3+1', 'H8+7', 'H2+3', 'C8+4'],
  },
  {
    name: 'pawn-opening-dual-flank-soldiers',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.9,
    moves: ['P7+1', 'H8+7', 'P3+1', 'P3+1'],
  },
  {
    name: 'pawn-opening-double-soldier-race',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.88,
    moves: ['P7+1', 'P3+1', 'P3+1', 'P7+1'],
  },
  {
    name: 'pawn-opening-vs-anti-horse',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.88,
    moves: ['P7+1', 'H8+9', 'H2+3', 'C8+4'],
  },
  {
    name: 'pawn-opening-vs-rook-lift',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.87,
    moves: ['P7+1', 'R9+1', 'H2+3', 'H8+7'],
  },
  {
    name: 'pawn-opening-soldier-vs-elephant',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.86,
    moves: ['P7+1', 'E7+5', 'P3+1', 'H8+7'],
  },
  {
    name: 'pawn-opening-rook-lift-soldier',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.84,
    moves: ['P7+1', 'P3+1', 'R1+1', 'H8+7'],
  },
  {
    name: 'pawn-opening-rook-lift-left-cannon',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.84,
    moves: ['P7+1', 'C8+4', 'R1+1', 'H8+7'],
  },
  {
    name: 'pawn-opening-left-cannon-transpose',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.83,
    moves: ['P7+1', 'C8+4', 'C2=5', 'P3+1'],
  },
  {
    name: 'pawn-opening-horse-flank-transpose',
    profile: OPENING_PROFILES.pawnOpening.key,
    source: 'curated-system-variation',
    weight: 0.82,
    moves: ['P7+1', 'C8=5', 'H8+7', 'H2+3'],
  },
]);

function fileToColumn(side, file) {
  return side === SIDES.RED ? file - 1 : 9 - file;
}

function columnToFile(side, col) {
  return side === SIDES.RED ? col + 1 : 9 - col;
}

function isForward(move, side) {
  return side === SIDES.RED ? move.to.row < move.from.row : move.to.row > move.from.row;
}

function isBackward(move, side) {
  return side === SIDES.RED ? move.to.row > move.from.row : move.to.row < move.from.row;
}

function matchesNotation(move, side, action, destination) {
  if (action === '=') {
    return columnToFile(side, move.to.col) === destination;
  }

  const directionMatches = action === '+' ? isForward(move, side) : isBackward(move, side);
  if (!directionMatches) {
    return false;
  }

  if (ORTHOGONAL_PIECES.has(move.piece.type)) {
    return move.to.col === move.from.col && Math.abs(move.to.row - move.from.row) === destination;
  }

  return columnToFile(side, move.to.col) === destination;
}

function parseNotation(notation) {
  const match = /^(?<piece>[A-Z])(?<file>\d)(?<action>[+=-])(?<target>\d)$/i.exec(notation.trim());
  if (!match?.groups) {
    return null;
  }

  return {
    pieceCode: match.groups.piece.toUpperCase(),
    file: Number(match.groups.file),
    action: match.groups.action,
    target: Number(match.groups.target),
  };
}

function moveFromNotation(board, side, notation) {
  const parsed = parseNotation(notation);
  if (!parsed) {
    throw new Error(`Unsupported opening notation: ${notation}`);
  }

  const pieceType = PIECE_CODE_TO_TYPE[parsed.pieceCode];
  if (!pieceType) {
    throw new Error(`Unsupported opening piece code: ${parsed.pieceCode}`);
  }

  const sourceCol = fileToColumn(side, parsed.file);
  const matches = getLegalMoves(board, side).filter(
    (move) =>
      move.piece.type === pieceType &&
      move.from.col === sourceCol &&
      matchesNotation(move, side, parsed.action, parsed.target),
  );

  if (matches.length !== 1) {
    throw new Error(`Opening notation "${notation}" matched ${matches.length} legal moves.`);
  }

  return matches[0];
}

function compileOpening(line) {
  let board = createInitialBoard();
  let side = SIDES.RED;
  const keys = [];

  line.moves.forEach((notation) => {
    const move = moveFromNotation(board, side, notation);
    keys.push(moveToKey(move));
    board = applyMove(board, move);
    side = oppositeSide(side);
  });

  return Object.freeze({
    ...line,
    keys: Object.freeze(keys),
  });
}

function prefixMatches(lineKeys, history) {
  if (history.length > lineKeys.length) {
    return false;
  }

  for (let index = 0; index < history.length; index += 1) {
    if (lineKeys[index] !== history[index]) {
      return false;
    }
  }

  return true;
}

function pickWeighted(entries, temperature) {
  const normalizedTemperature = Math.max(0.2, temperature);
  const weightedEntries = entries.map((entry) => ({
    ...entry,
    ticket: Math.pow(Math.max(entry.weight, 0.001), 1 / normalizedTemperature),
  }));
  const total = weightedEntries.reduce((sum, entry) => sum + entry.ticket, 0);

  let draw = Math.random() * total;
  for (const entry of weightedEntries) {
    draw -= entry.ticket;
    if (draw <= 0) {
      return entry.move;
    }
  }

  return weightedEntries[weightedEntries.length - 1]?.move ?? null;
}

const COMPILED_OPENINGS = Object.freeze(RAW_OPENINGS.map(compileOpening));

function getActiveLines(profileKey) {
  if (!profileKey || profileKey === OPENING_PROFILES.all.key) {
    return COMPILED_OPENINGS;
  }

  if (profileKey === OPENING_PROFILES.none.key) {
    return [];
  }

  return COMPILED_OPENINGS.filter((line) => line.profile === profileKey);
}

export function getOpeningBookSize(profileKey = OPENING_PROFILES.all.key) {
  return getActiveLines(profileKey).length;
}

export function getOpeningProfileLabel(profileKey = OPENING_PROFILES.all.key) {
  const profile = Object.values(OPENING_PROFILES).find((entry) => entry.key === profileKey);
  return profile?.label ?? OPENING_PROFILES.all.label;
}

export function pickOpeningMove(board, side, history = [], options = {}) {
  if (!Array.isArray(history) || history.length >= (options.bookDepth ?? Infinity)) {
    return null;
  }

  const activeLines = getActiveLines(options.openingProfile);
  if (activeLines.length === 0) {
    return null;
  }

  const legalMoves = getLegalMoves(board, side);
  if (legalMoves.length === 0) {
    return null;
  }

  const legalByKey = new Map(legalMoves.map((move) => [moveToKey(move), move]));
  const candidatesByKey = new Map();

  for (const line of activeLines) {
    if (!prefixMatches(line.keys, history) || history.length >= line.keys.length) {
      continue;
    }

    const nextKey = line.keys[history.length];
    const move = legalByKey.get(nextKey);
    if (!move) {
      continue;
    }

    const current = candidatesByKey.get(nextKey);
    if (current) {
      current.weight += line.weight;
      current.lines += 1;
    } else {
      candidatesByKey.set(nextKey, {
        move,
        weight: line.weight,
        lines: 1,
      });
    }
  }

  const candidates = [...candidatesByKey.values()]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, Math.max(1, options.bookChoices ?? candidatesByKey.size));

  if (candidates.length === 0) {
    return null;
  }

  return pickWeighted(candidates, options.bookTemperature ?? 1.1);
}
