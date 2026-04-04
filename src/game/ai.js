import { DIFFICULTIES, PIECE_TYPES, PIECE_VALUES, SIDES } from './constants.js';
import {
  applyMove,
  getLegalMoves,
  getWinner,
  isMoveBlockedByRepeatedCheck,
  oppositeSide,
} from './rules.js';
import { OPENING_PROFILES, pickOpeningMove } from './openingBook.js';

const WIN_SCORE = 1_000_000;

function positionalBonus(piece, row, col) {
  const centerDistance = Math.abs(4 - col);

  switch (piece.type) {
    case PIECE_TYPES.SOLDIER: {
      const advancement = piece.side === SIDES.RED ? 9 - row : row;
      const riverBonus = piece.side === SIDES.RED ? (row <= 4 ? 28 : 0) : (row >= 5 ? 28 : 0);
      return advancement * 7 + riverBonus - centerDistance * 3;
    }
    case PIECE_TYPES.ROOK:
      return 28 - centerDistance * 5;
    case PIECE_TYPES.CANNON:
      return 24 - centerDistance * 4;
    case PIECE_TYPES.HORSE:
      return 22 - centerDistance * 3;
    case PIECE_TYPES.ELEPHANT:
    case PIECE_TYPES.ADVISOR:
      return 14 - centerDistance * 2;
    case PIECE_TYPES.GENERAL:
      return 18 - centerDistance * 5;
    default:
      return 0;
  }
}

function evaluateBoardForSide(board, side) {
  let score = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }

      const pieceScore = PIECE_VALUES[piece.type] + positionalBonus(piece, row, col);
      score += piece.side === side ? pieceScore : -pieceScore;
    }
  }

  return score;
}

function moveOrderingScore(move) {
  let score = 0;

  if (move.captured) {
    score += PIECE_VALUES[move.captured.type] * 12 - PIECE_VALUES[move.piece.type] * 2;
  }

  if (move.piece.type === PIECE_TYPES.SOLDIER) {
    score += 16;
  }

  if (move.piece.type === PIECE_TYPES.ROOK || move.piece.type === PIECE_TYPES.CANNON) {
    score += 12;
  }

  score += 14 - Math.abs(4 - move.to.col) * 2;

  if (move.captured?.type === PIECE_TYPES.GENERAL) {
    score += WIN_SCORE / 2;
  }

  return score;
}

function serializeBoard(board, sideToMove, depth) {
  let key = `${sideToMove}:${depth}:`;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece) {
        key += '.';
      } else {
        key += `${piece.side[0]}${piece.type[0]}`;
      }
    }
  }
  return key;
}

function orderMoves(moves) {
  return [...moves].sort((left, right) => moveOrderingScore(right) - moveOrderingScore(left));
}

function pickWeightedByScore(scoredMoves, bestScore, temperature) {
  const normalizedTemperature = Math.max(0.6, temperature);
  const weightedMoves = scoredMoves.map((entry) => ({
    ...entry,
    ticket: Math.exp((entry.score - bestScore) / normalizedTemperature),
  }));
  const total = weightedMoves.reduce((sum, entry) => sum + entry.ticket, 0);

  let draw = Math.random() * total;
  for (const entry of weightedMoves) {
    draw -= entry.ticket;
    if (draw <= 0) {
      return entry.move;
    }
  }

  return weightedMoves[weightedMoves.length - 1]?.move ?? scoredMoves[0]?.move ?? null;
}

function negamax(board, sideToMove, depth, alpha, beta, deadline, config, table) {
  if (performance.now() >= deadline) {
    return evaluateBoardForSide(board, sideToMove);
  }

  const winner = getWinner(board, sideToMove);
  if (winner) {
    return winner === sideToMove ? WIN_SCORE + depth : -WIN_SCORE - depth;
  }

  if (depth === 0) {
    return evaluateBoardForSide(board, sideToMove);
  }

  const cacheKey = serializeBoard(board, sideToMove, depth);
  const cachedScore = table.get(cacheKey);
  if (typeof cachedScore === 'number') {
    return cachedScore;
  }

  let bestScore = -Infinity;
  const moves = orderMoves(getLegalMoves(board, sideToMove)).slice(0, config.branchLimit);

  for (const move of moves) {
    const nextBoard = applyMove(board, move);
    const score = -negamax(
      nextBoard,
      oppositeSide(sideToMove),
      depth - 1,
      -beta,
      -alpha,
      deadline,
      config,
      table,
    );

    if (score > bestScore) {
      bestScore = score;
    }
    if (score > alpha) {
      alpha = score;
    }
    if (alpha >= beta) {
      break;
    }
  }

  table.set(cacheKey, bestScore);
  return bestScore;
}

export function pickAIMove(
  board,
  side,
  difficultyKey = 'medium',
  moveHistory = [],
  openingProfile = OPENING_PROFILES.all.key,
  moveLog = [],
) {
  const config = DIFFICULTIES[difficultyKey] ?? DIFFICULTIES.medium;
  const openingMove = pickOpeningMove(board, side, moveHistory, {
    ...config,
    openingProfile,
  });
  if (openingMove && !isMoveBlockedByRepeatedCheck(board, openingMove, side, moveLog)) {
    return openingMove;
  }

  const legalMoves = orderMoves(
    getLegalMoves(board, side).filter(
      (move) => !isMoveBlockedByRepeatedCheck(board, move, side, moveLog),
    ),
  ).slice(0, config.rootLimit);

  if (legalMoves.length === 0) {
    return null;
  }

  const deadline = performance.now() + config.thinkMs;
  const table = new Map();
  const scoredMoves = [];

  for (const move of legalMoves) {
    if (performance.now() >= deadline && scoredMoves.length > 0) {
      break;
    }

    const nextBoard = applyMove(board, move);
    let score = -negamax(
      nextBoard,
      oppositeSide(side),
      config.depth - 1,
      -Infinity,
      Infinity,
      deadline,
      config,
      table,
    );

    if (config.noise > 0) {
      score += (Math.random() - 0.5) * config.noise;
    }

    scoredMoves.push({ move, score });
  }

  if (scoredMoves.length === 0) {
    return legalMoves[0];
  }

  scoredMoves.sort((left, right) => right.score - left.score);
  const bestScore = scoredMoves[0].score;
  const candidateLimit = Math.max(2, (config.bookChoices ?? 2) + 1);
  const candidates = scoredMoves.filter(
    (entry, index) => index < candidateLimit && bestScore - entry.score <= config.varietyWindow,
  );

  if (candidates.length <= 1) {
    return scoredMoves[0].move;
  }

  return pickWeightedByScore(candidates, bestScore, config.selectionTemperature);
}
