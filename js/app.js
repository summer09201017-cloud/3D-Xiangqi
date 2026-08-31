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
        // 📅 每日殘局:每天一題、全世界同一題(題目從日期算,零後端)
        const btnDaily = document.getElementById('btn-daily');
        if (btnDaily) btnDaily.addEventListener('click', () => this.startGame('daily'));
        // 結束畫面的「再來一局」:每日模式=同一題再試(今天的題不會變)
        const btnRetry = document.getElementById('btn-retry');
        if (btnRetry) btnRetry.addEventListener('click', () => this.startGame(this.gameMode, this.aiDifficulty));
    }

    /* 📅 每日殘局的本機戰績:{ "YYYY-MM-DD": 當天最少步數 }。
       零上傳、全包 try/catch(私密模式照玩,只是記不住);只留 60 天。 */
    loadDailyBook() {
        try { const s = JSON.parse(localStorage.getItem('xiangqi-daily-v1') || '{}'); return s && typeof s === 'object' ? s : {}; }
        catch (_) { return {}; }
    }
    saveDailyResult(key, moves) {
        const all = this.loadDailyBook();
        const prev = all[key] | 0;
        const isNewBest = !prev || moves < prev;
        if (isNewBest) all[key] = moves;
        const days = Object.keys(all).sort();
        while (days.length > 60) delete all[days.shift()];
        try { localStorage.setItem('xiangqi-daily-v1', JSON.stringify(all)); } catch (_) { /* 私密模式 */ }
        return { best: all[key] || moves, isNewBest };
    }

    startGame(mode, difficulty = 'easy') {
        this.gameMode = mode;
        this.aiDifficulty = mode === 'daily' ? 'hard' : difficulty;   // 📅 殘局的黑方守得認真才有題味

        // Hide Menus
        this.uiMainMenu.classList.add('hidden');
        this.uiAiMenu.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
        this.uiGameInfo.classList.remove('hidden');

        // Initialize Game
        if (mode === 'daily') {
            this.daily = puzzleForDate(dailyPuzzleKey());
            this.redMoves = 0;
            this._dailySaved = false;   // 新的一局,成績閂鎖歸零
            this.gameLogic.initGame(buildPuzzleBoard(this.daily.puzzle));
        } else {
            this.daily = null;
            this.gameLogic.initGame();
        }
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
        
        // 如果是 PvAI/每日殘局 且輪到 AI，則忽略點擊
        if ((this.gameMode === 'pvai' || this.gameMode === 'daily') && this.gameLogic.currentPlayer === 'black') return;

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
                if (this.gameMode === 'daily') this.redMoves++;   // 📅 記「今天用了幾步」(只數紅方)
                this.renderer.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol, () => {
                    this.renderer.updateBoardState(this.gameLogic.getBoardState());
                    this.checkGameState();

                    if (!this.gameLogic.isGameOver && (this.gameMode === 'pvai' || this.gameMode === 'daily') && this.gameLogic.currentPlayer === 'black') {
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
            /* 📅 每日殘局的收場:贏=記步數(當日取最少)+新紀錄;輸=溫柔的「再試一次」
               (同一題重開,btn-restart 走 startGame('daily') 拿到的還是今天這一題)。 */
            if (this.gameMode === 'daily' && this.daily) {
                let txt;
                if (this.gameLogic.winner === 'red') {
                    /* ★ 只記一次:動畫回呼可能讓 checkGameState 跑兩次,第二次會把
                       「新紀錄!」蓋成「今天最佳」——同一局的成績只上帳一次。 */
                    if (this._dailySaved) return;
                    this._dailySaved = true;
                    const r = this.saveDailyResult(this.daily.key, this.redMoves);
                    txt = `📅 殘局完成！用了 ${this.redMoves} 步`
                        + (r.isNewBest ? '——今天的新紀錄！' : `（今天最佳 ${r.best} 步）`)
                        + ' 明天有新題！';
                } else {
                    txt = '差一點——按「再來一局」同一題再試！';
                }
                document.getElementById('winner-text').innerText = txt;
                this.uiGameOver.classList.remove('hidden');
                return;
            }
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
        // 📅 每日殘局的狀態行(題名/日期/步數/提示)
        const di = document.getElementById('daily-info');
        if (di) {
            di.classList.toggle('hidden', this.gameMode !== 'daily');
            if (this.gameMode === 'daily' && this.daily) {
                di.innerText = `📅 ${this.daily.key}「${this.daily.puzzle.name}」・你已走 ${this.redMoves} 步\n${this.daily.puzzle.hint}`;
            }
        }
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