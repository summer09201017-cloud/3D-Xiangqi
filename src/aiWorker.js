import { pickAIMove } from './game/ai.js';

self.addEventListener('message', (event) => {
  const { token, board, side, difficulty, moveHistory, openingProfile, moveLog } = event.data;
  const move = pickAIMove(board, side, difficulty, moveHistory, openingProfile, moveLog);
  self.postMessage({ token, move });
});
