// js/app.js - 應用程式進入點與 UI 狀態管理

class App {
    constructor() {
        this.renderer = new ChessRenderer();
        this.gameLogic = new GameLogic();
        this.ai = new ChessAI();
        
        this.gameMode = null; // 'pvp' or 'pvai'
        this.aiDifficulty = 'easy'; // 'easy', 'medium', 'hard'
        
        this.initUI();
    }
    
    initUI() {
        // UI Elements
        this.uiMainMenu = document.getElementById('main-menu');
        this.uiAiMenu = document.getElementById('ai-menu');
        this.uiGameInfo = document.getElementById('game-info');
        this.uiGameOver = document.getElementById('game-over-menu');
        
        // Buttons
        document.getElementById('btn-pvp').addEventListener('click', () => this.startGame('pvp'));
        document.getElementById('btn-pvai').addEventListener('click', () => {
            this.uiMainMenu.classList.add('hidden');
            this.uiAiMenu.classList.remove('hidden');
        });
        
        document.getElementById('btn-ai-easy').addEventListener('click', () => this.startGame('pvai', 'easy'));
        document.getElementById('btn-ai-medium').addEventListener('click', () => this.startGame('pvai', 'medium'));
        document.getElementById('btn-ai-hard').addEventListener('click', () => this.startGame('pvai', 'hard'));
        
        document.getElementById('btn-back-menu').addEventListener('click', () => {
            this.uiAiMenu.classList.add('hidden');
            this.uiMainMenu.classList.remove('hidden');
        });
        
        document.getElementById('btn-restart').addEventListener('click', () => this.startGame(this.gameMode, this.aiDifficulty));
        document.getElementById('btn-back-to-main').addEventListener('click', () => this.showMainMenu());
    }
    
    startGame(mode, difficulty = 'easy') {
        this.gameMode = mode;
        this.aiDifficulty = difficulty;
        
        // Hide Menus
        this.uiMainMenu.classList.add('hidden');
        this.uiAiMenu.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
        this.uiGameInfo.classList.remove('hidden');
        
        // Initialize Game
        this.gameLogic.initGame();
        this.renderer.initScene(this.gameLogic.getBoardState());
        
        // Link renderer events to game logic
        this.renderer.onPieceClick = (row, col) => this.handleSquareClick(row, col);
        
        this.updateUIInfo();
        
        // Start render loop
        this.renderer.animate();
    }
    
    showMainMenu() {
        this.uiGameInfo.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
        this.uiMainMenu.classList.remove('hidden');
        this.renderer.stopAnimation();
    }
    
    handleSquareClick(row, col) {
        if (this.gameLogic.isGameOver) return;
        
        // 如果是 PvAI 且輪到 AI，則忽略點擊
        if (this.gameMode === 'pvai' && this.gameLogic.currentPlayer === 'black') return;

        const action = this.gameLogic.handleInteraction(row, col);
        
        if (action) {
            if (action.type === 'select') {
                this.renderer.highlightSquare(row, col);
                // 也可以 highlight 合法走法
                const legalMoves = this.gameLogic.getLegalMovesForPiece(row, col);
                this.renderer.highlightMoves(legalMoves);
            } else if (action.type === 'deselect') {
                this.renderer.clearHighlights();
            } else if (action.type === 'move') {
                this.renderer.clearHighlights();
                this.gameLogic.executeMove(action.fromRow, action.fromCol, action.toRow, action.toCol);
                this.renderer.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol, () => {
                    this.renderer.updateBoardState(this.gameLogic.getBoardState());
                    this.checkGameState();
                    
                    if (!this.gameLogic.isGameOver && this.gameMode === 'pvai' && this.gameLogic.currentPlayer === 'black') {
                        this.makeAIMove();
                    }
                });
                this.updateUIInfo();
            }
        }
    }
    
    makeAIMove() {
        document.getElementById('game-status').innerText = 'AI 思考中...';
        
        // 使用 setTimeout 讓 UI 有機會更新 (避免 AI 運算卡死主執行緒)
        setTimeout(() => {
            const move = this.ai.calculateBestMove(this.gameLogic.getBoardState(), this.gameLogic.currentPlayer, this.aiDifficulty);
            if (move) {
                // 套用 AI 的走法
                this.gameLogic.executeMove(move.from.row, move.from.col, move.to.row, move.to.col);
                this.renderer.movePiece(move.from.row, move.from.col, move.to.row, move.to.col, () => {
                    this.renderer.updateBoardState(this.gameLogic.getBoardState());
                    document.getElementById('game-status').innerText = '';
                    this.checkGameState();
                    this.updateUIInfo();
                });
            } else {
                // AI 認輸或無步可走
                this.gameLogic.isGameOver = true;
                this.gameLogic.winner = 'red'; // 黑方無步可走，紅方勝
                this.checkGameState();
            }
        }, 100);
    }
    
    checkGameState() {
        if (this.gameLogic.isGameOver) {
            const winnerName = this.gameLogic.winner === 'red' ? '紅方' : '黑方';
            document.getElementById('winner-text').innerText = `${winnerName} 獲勝！`;
            this.uiGameOver.classList.remove('hidden');
        } else if (this.gameLogic.isInCheck(this.gameLogic.currentPlayer)) {
            document.getElementById('game-status').innerText = '將軍！';
        } else {
            document.getElementById('game-status').innerText = '';
        }
    }
    
    updateUIInfo() {
        const playerSpan = document.getElementById('current-player');
        if (this.gameLogic.currentPlayer === 'red') {
            playerSpan.innerText = '紅方';
            playerSpan.className = 'red';
        } else {
            playerSpan.innerText = '黑方';
            playerSpan.className = 'black';
        }
    }
}

// 啟動應用程式
window.onload = () => {
    window.app = new App();
};