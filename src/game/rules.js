import {
  BOARD_COLS,
  BOARD_ROWS,
  PIECE_TYPES,
  SIDES,
  cloneBoard,
} from './constants.js';

const ORTHOGONAL_STEPS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const ADVISOR_STEPS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const ELEPHANT_STEPS = [
  [-2, -2, -1, -1],
  [-2, 2, -1, 1],
  [2, -2, 1, -1],
  [2, 2, 1, 1],
];

const HORSE_STEPS = [
  [-2, -1, -1, 0],
  [-2, 1, -1, 0],
  [2, -1, 1, 0],
  [2, 1, 1, 0],
  [-1, -2, 0, -1],
  [1, -2, 0, -1],
  [-1, 2, 0, 1],
  [1, 2, 0, 1],
];

export function oppositeSide(side) {
  return side === SIDES.RED ? SIDES.BLACK : SIDES.RED;
}

export function inBounds(row, col) {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

export function isWithinPalace(side, row, col) {
  const rowMin = side === SIDES.RED ? 7 : 0;
  const rowMax = side === SIDES.RED ? 9 : 2;
  return row >= rowMin && row <= rowMax && col >= 3 && col <= 5;
}

export function hasCrossedRiver(side, row) {
  return side === SIDES.RED ? row <= 4 : row >= 5;
}

function createMove(board, fromRow, fromCol, toRow, toCol) {
  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    piece: board[fromRow][fromCol],
    captured: board[toRow][toCol],
  };
}

export function moveToKey(move) {
  return `${move.from.row}${move.from.col}-${move.to.row}${move.to.col}`;
}

function countRecentRepeatedCheckMoves(moveLog, side, key) {
  let count = 0;

  for (let index = moveLog.length - 1; index >= 0; index -= 1) {
    const entry = moveLog[index];
    if (!entry || entry.side !== side) {
      continue;
    }

    if (entry.key === key && entry.givesCheck) {
      count += 1;
      continue;
    }

    break;
  }

  return count;
}

export function isMoveBlockedByRepeatedCheck(board, move, side, moveLog = [], maxRepeat = 3) {
  if (!Array.isArray(moveLog) || moveLog.length === 0 || maxRepeat < 1) {
    return false;
  }

  const nextBoard = applyMove(board, move);
  const givesCheck = isInCheck(nextBoard, oppositeSide(side));
  if (!givesCheck) {
    return false;
  }

  const moveKey = moveToKey(move);
  const repeatedCount = countRecentRepeatedCheckMoves(moveLog, side, moveKey);
  return repeatedCount >= maxRepeat;
}

function tryAddMove(board, row, col, nextRow, nextCol, moves) {
  if (!inBounds(nextRow, nextCol)) {
    return;
  }

  const piece = board[row][col];
  const target = board[nextRow][nextCol];
  if (!target || target.side !== piece.side) {
    moves.push(createMove(board, row, col, nextRow, nextCol));
  }
}

function hasClearPathOnFile(board, col, startRow, endRow) {
  const step = startRow < endRow ? 1 : -1;
  for (let row = startRow + step; row !== endRow; row += step) {
    if (board[row][col]) {
      return false;
    }
  }
  return true;
}

export function findGeneral(board, side) {
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const piece = board[row][col];
      if (piece && piece.side === side && piece.type === PIECE_TYPES.GENERAL) {
        return { row, col };
      }
    }
  }
  return null;
}

export function generatePseudoMovesForPiece(board, row, col) {
  const piece = board[row][col];
  if (!piece) {
    return [];
  }

  const moves = [];

  switch (piece.type) {
    case PIECE_TYPES.ROOK: {
      ORTHOGONAL_STEPS.forEach(([deltaRow, deltaCol]) => {
        let nextRow = row + deltaRow;
        let nextCol = col + deltaCol;

        while (inBounds(nextRow, nextCol)) {
          const target = board[nextRow][nextCol];
          if (!target) {
            moves.push(createMove(board, row, col, nextRow, nextCol));
          } else {
            if (target.side !== piece.side) {
              moves.push(createMove(board, row, col, nextRow, nextCol));
            }
            break;
          }
          nextRow += deltaRow;
          nextCol += deltaCol;
        }
      });
      break;
    }

    case PIECE_TYPES.CANNON: {
      ORTHOGONAL_STEPS.forEach(([deltaRow, deltaCol]) => {
        let nextRow = row + deltaRow;
        let nextCol = col + deltaCol;
        let jumpedScreen = false;

        while (inBounds(nextRow, nextCol)) {
          const target = board[nextRow][nextCol];
          if (!jumpedScreen) {
            if (!target) {
              moves.push(createMove(board, row, col, nextRow, nextCol));
            } else {
              jumpedScreen = true;
            }
          } else if (target) {
            if (target.side !== piece.side) {
              moves.push(createMove(board, row, col, nextRow, nextCol));
            }
            break;
          }

          nextRow += deltaRow;
          nextCol += deltaCol;
        }
      });
      break;
    }

    case PIECE_TYPES.HORSE: {
      HORSE_STEPS.forEach(([deltaRow, deltaCol, legRow, legCol]) => {
        const blockedLeg = board[row + legRow]?.[col + legCol];
        if (blockedLeg) {
          return;
        }
        tryAddMove(board, row, col, row + deltaRow, col + deltaCol, moves);
      });
      break;
    }

    case PIECE_TYPES.ELEPHANT: {
      ELEPHANT_STEPS.forEach(([deltaRow, deltaCol, eyeRow, eyeCol]) => {
        const nextRow = row + deltaRow;
        const nextCol = col + deltaCol;
        const blockedEye = board[row + eyeRow]?.[col + eyeCol];
        if (blockedEye) {
          return;
        }
        if (piece.side === SIDES.RED && nextRow < 5) {
          return;
        }
        if (piece.side === SIDES.BLACK && nextRow > 4) {
          return;
        }
        tryAddMove(board, row, col, nextRow, nextCol, moves);
      });
      break;
    }

    case PIECE_TYPES.ADVISOR: {
      ADVISOR_STEPS.forEach(([deltaRow, deltaCol]) => {
        const nextRow = row + deltaRow;
        const nextCol = col + deltaCol;
        if (isWithinPalace(piece.side, nextRow, nextCol)) {
          tryAddMove(board, row, col, nextRow, nextCol, moves);
        }
      });
      break;
    }

    case PIECE_TYPES.GENERAL: {
      ORTHOGONAL_STEPS.forEach(([deltaRow, deltaCol]) => {
        const nextRow = row + deltaRow;
        const nextCol = col + deltaCol;
        if (isWithinPalace(piece.side, nextRow, nextCol)) {
          tryAddMove(board, row, col, nextRow, nextCol, moves);
        }
      });

      const enemyGeneral = findGeneral(board, oppositeSide(piece.side));
      if (enemyGeneral && enemyGeneral.col === col && hasClearPathOnFile(board, col, row, enemyGeneral.row)) {
        moves.push(createMove(board, row, col, enemyGeneral.row, enemyGeneral.col));
      }
      break;
    }

    case PIECE_TYPES.SOLDIER: {
      const forward = piece.side === SIDES.RED ? -1 : 1;
      tryAddMove(board, row, col, row + forward, col, moves);

      if (hasCrossedRiver(piece.side, row)) {
        tryAddMove(board, row, col, row, col - 1, moves);
        tryAddMove(board, row, col, row, col + 1, moves);
      }
      break;
    }

    default:
      break;
  }

  return moves;
}

export function applyMove(board, move) {
  const nextBoard = cloneBoard(board);
  nextBoard[move.to.row][move.to.col] = nextBoard[move.from.row][move.from.col];
  nextBoard[move.from.row][move.from.col] = null;
  return nextBoard;
}

export function isSquareThreatened(board, row, col, bySide) {
  for (let scanRow = 0; scanRow < BOARD_ROWS; scanRow += 1) {
    for (let scanCol = 0; scanCol < BOARD_COLS; scanCol += 1) {
      const piece = board[scanRow][scanCol];
      if (!piece || piece.side !== bySide) {
        continue;
      }

      const pseudoMoves = generatePseudoMovesForPiece(board, scanRow, scanCol);
      if (pseudoMoves.some((move) => move.to.row === row && move.to.col === col)) {
        return true;
      }
    }
  }
  return false;
}

export function isInCheck(board, side) {
  const general = findGeneral(board, side);
  if (!general) {
    return true;
  }
  return isSquareThreatened(board, general.row, general.col, oppositeSide(side));
}

export function getLegalMoves(board, side) {
  const legalMoves = [];

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.side !== side) {
        continue;
      }

      const pseudoMoves = generatePseudoMovesForPiece(board, row, col);
      pseudoMoves.forEach((move) => {
        const nextBoard = applyMove(board, move);
        if (!isInCheck(nextBoard, side)) {
          legalMoves.push(move);
        }
      });
    }
  }

  return legalMoves;
}

export function getLegalMovesForPiece(board, row, col) {
  const piece = board[row][col];
  if (!piece) {
    return [];
  }

  return getLegalMoves(board, piece.side).filter(
    (move) => move.from.row === row && move.from.col === col,
  );
}

export function getWinner(board, sideToMove) {
  const redGeneral = findGeneral(board, SIDES.RED);
  const blackGeneral = findGeneral(board, SIDES.BLACK);

  if (!redGeneral) {
    return SIDES.BLACK;
  }
  if (!blackGeneral) {
    return SIDES.RED;
  }

  if (getLegalMoves(board, sideToMove).length === 0) {
    return oppositeSide(sideToMove);
  }

  return null;
}
