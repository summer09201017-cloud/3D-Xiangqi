// js/gameLogic.js - 核心遊戲狀態與規則

class GameLogic {
    constructor() {
        this.board = [];
        this.currentPlayer = 'red'; // 'red' or 'black'
        this.selectedPiece = null;  // {row, col}
        this.isGameOver = false;
        this.winner = null;
    }

    initGame() {
        this.board = Array(10).fill(null).map(() => Array(9).fill(null));
        this.currentPlayer = 'red';
        this.selectedPiece = null;
        this.isGameOver = false;
        this.winner = null;

        this.setupInitialBoard();
    }

    setupInitialBoard() {
        // Red Pieces (Bottom, Rows 0-4)
        this.board[0][0] = { type: 'rook', color: 'red', name: '車' };
        this.board[0][1] = { type: 'knight', color: 'red', name: '馬' };
        this.board[0][2] = { type: 'elephant', color: 'red', name: '相' };
        this.board[0][3] = { type: 'advisor', color: 'red', name: '仕' };
        this.board[0][4] = { type: 'king', color: 'red', name: '帥' };
        this.board[0][5] = { type: 'advisor', color: 'red', name: '仕' };
        this.board[0][6] = { type: 'elephant', color: 'red', name: '相' };
        this.board[0][7] = { type: 'knight', color: 'red', name: '馬' };
        this.board[0][8] = { type: 'rook', color: 'red', name: '車' };
        
        this.board[2][1] = { type: 'cannon', color: 'red', name: '炮' };
        this.board[2][7] = { type: 'cannon', color: 'red', name: '炮' };
        
        this.board[3][0] = { type: 'pawn', color: 'red', name: '兵' };
        this.board[3][2] = { type: 'pawn', color: 'red', name: '兵' };
        this.board[3][4] = { type: 'pawn', color: 'red', name: '兵' };
        this.board[3][6] = { type: 'pawn', color: 'red', name: '兵' };
        this.board[3][8] = { type: 'pawn', color: 'red', name: '兵' };

        // Black Pieces (Top, Rows 5-9)
        this.board[9][0] = { type: 'rook', color: 'black', name: '車' };
        this.board[9][1] = { type: 'knight', color: 'black', name: '馬' };
        this.board[9][2] = { type: 'elephant', color: 'black', name: '象' };
        this.board[9][3] = { type: 'advisor', color: 'black', name: '士' };
        this.board[9][4] = { type: 'king', color: 'black', name: '將' };
        this.board[9][5] = { type: 'advisor', color: 'black', name: '士' };
        this.board[9][6] = { type: 'elephant', color: 'black', name: '象' };
        this.board[9][7] = { type: 'knight', color: 'black', name: '馬' };
        this.board[9][8] = { type: 'rook', color: 'black', name: '車' };
        
        this.board[7][1] = { type: 'cannon', color: 'black', name: '炮' };
        this.board[7][7] = { type: 'cannon', color: 'black', name: '炮' };
        
        this.board[6][0] = { type: 'pawn', color: 'black', name: '卒' };
        this.board[6][2] = { type: 'pawn', color: 'black', name: '卒' };
        this.board[6][4] = { type: 'pawn', color: 'black', name: '卒' };
        this.board[6][6] = { type: 'pawn', color: 'black', name: '卒' };
        this.board[6][8] = { type: 'pawn', color: 'black', name: '卒' };
    }

    getBoardState() {
        return this.board;
    }

    // 處理滑鼠點擊方格的邏輯，回傳動作供 UI/Renderer 處理
    handleInteraction(row, col) {
        if (this.isGameOver) return null;

        const clickedPiece = this.board[row][col];

        if (this.selectedPiece) {
            const { row: sr, col: sc } = this.selectedPiece;
            
            // 點擊自己的其他棋子 -> 重新選擇
            if (clickedPiece && clickedPiece.color === this.currentPlayer) {
                this.selectedPiece = { row, col };
                return { type: 'select', row, col };
            }
            
            // 點擊空地或敵方棋子 -> 嘗試移動
            if (this.isValidMove(sr, sc, row, col)) {
                return { type: 'move', fromRow: sr, fromCol: sc, toRow: row, toCol: col };
            } else {
                // 不合法移動 -> 取消選擇
                this.selectedPiece = null;
                return { type: 'deselect' };
            }
        } else {
            // 還沒選擇棋子，只能點擊自己的棋子
            if (clickedPiece && clickedPiece.color === this.currentPlayer) {
                this.selectedPiece = { row, col };
                return { type: 'select', row, col };
            }
        }
        return null;
    }

    // 實際執行移動並切換回合
    executeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const targetPiece = this.board[toRow][toCol];

        // 檢查是否吃掉將/帥 (簡單的勝負判定)
        if (targetPiece && targetPiece.type === 'king') {
            this.isGameOver = true;
            this.winner = this.currentPlayer;
        }

        // 移動棋子
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // 切換回合
        this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
        this.selectedPiece = null;
        
        // 檢查是否將軍或困斃 (進階勝負判定可在這裡補充)
        // 檢查飛將 (兩個王是否照面中間無阻擋) - 這裡需在每次移動後檢查，如果是自己導致照面則為犯規(被禁止的移動)，如果是吃掉對方王則遊戲結束
        // 為了簡單，先不阻擋犯規移動，但在 isValidMove 中會盡量過濾
    }

    getLegalMovesForPiece(row, col) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.isValidMove(row, col, r, c)) {
                    moves.push({ row: r, col: c });
                }
            }
        }
        return moves;
    }

    // 將所有棋子的移動規則委託給 PiecesRules 處理
    isValidMove(fromRow, fromCol, toRow, toCol) {
        // 不能原地不動
        if (fromRow === toRow && fromCol === toCol) return false;
        
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;
        
        const targetPiece = this.board[toRow][toCol];
        // 不能吃自己的棋子
        if (targetPiece && targetPiece.color === piece.color) return false;

        return PiecesRules.checkRules(this.board, fromRow, fromCol, toRow, toCol);
    }
    
    // 檢查指定玩家是否被將軍 (為 Milestone 4 及 AI 預留)
    isInCheck(color) {
        // 尋找王的座標
        let kingPos = null;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'king' && p.color === color) {
                    kingPos = {r, c};
                    break;
                }
            }
            if (kingPos) break;
        }
        if (!kingPos) return false; // 王被吃了
        
        // 檢查敵方所有棋子是否能攻擊到王
        const enemyColor = color === 'red' ? 'black' : 'red';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.board[r][c];
                if (p && p.color === enemyColor) {
                    if (PiecesRules.checkRules(this.board, r, c, kingPos.r, kingPos.c)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}