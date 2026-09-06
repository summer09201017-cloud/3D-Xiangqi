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
        // 💡 AI 提示:借同一支引擎,從「玩家這一邊」算一手
        const btnHint = document.getElementById('btn-hint');
        if (btnHint) btnHint.addEventListener('click', () => this.showHint());
        document.getElementById('btn-back-to-main').addEventListener('click', () => this.showMainMenu());
        // 📅 每日殘局:每天一題、全世界同一題(題目從日期算,零後端)
        const btnDaily = document.getElementById('btn-daily');
        if (btnDaily) btnDaily.addEventListener('click', () => this.startGame('daily'));
        // 結束畫面的「再來一局」:每日模式=同一題再試(今天的題不會變)
        const btnRetry = document.getElementById('btn-retry');
        if (btnRetry) btnRetry.addEventListener('click', () => this.startGame(this.gameMode, this.aiDifficulty));
        /* 📅 每日模式的結算兩顆(★ 幻影版冒煙抓到的教訓:結算框會蓋住上面的每日鈕,
           孩子接不到下一題;而通用的「再來一局」在每日模式語意不清) */
        const btnDailyNext = document.getElementById('btn-daily-next');
        if (btnDailyNext) btnDailyNext.addEventListener('click', () => {
            const next = this.nextUnsolvedIndex();
            this.startGame('daily', 'easy', next >= 0 ? next : undefined);
        });
        const btnDailyRetry = document.getElementById('btn-daily-retry');
        if (btnDailyRetry) btnDailyRetry.addEventListener('click', () => {
            this.startGame('daily', 'easy', this.daily ? this.daily.index : undefined);
        });
        /* 🔗 ?daily 深連結(0906,信友火花「今日挑戰」卡直達):等於代按「📅 每日殘局」。
           setTimeout 0 = 等 constructor 把 renderer 等都建好再開局。 */
        if (/[?&]daily(?:=|&|$)/.test(location.search)) setTimeout(() => this.startGame('daily'), 0);
    }

    /* 📅 每日殘局的本機戰績:{ "YYYY-MM-DD": { solved: { 題id: 那題最少步 } } }。
       一天一組多題 ⇒ **每題分開記**;零上傳、全包 try/catch、只留 60 天。
       ⚠ 舊格式(單題版是 `日期: 步數`)沒有 solved ⇒ 視為未解、可重解(寬鬆遷移,不炸)。 */
    loadDailyBook() {
        try { const s = JSON.parse(localStorage.getItem('xiangqi-daily-v1') || '{}'); return s && typeof s === 'object' ? s : {}; }
        catch (_) { return {}; }
    }
    dailySolved(key) {
        const d = this.loadDailyBook()[key];
        return (d && typeof d === 'object' && d.solved) ? d.solved : {};
    }
    saveDailyResult(key, puzzleId, moves) {
        const all = this.loadDailyBook();
        const day = (all[key] && typeof all[key] === 'object' && all[key].solved) ? all[key] : { solved: {} };
        const prev = day.solved[puzzleId] | 0;
        const isNewBest = !prev || moves < prev;
        if (isNewBest) day.solved[puzzleId] = moves;
        all[key] = day;
        const days = Object.keys(all).sort();
        while (days.length > 60) delete all[days.shift()];
        try { localStorage.setItem('xiangqi-daily-v1', JSON.stringify(all)); } catch (_) { /* 私密模式 */ }
        return { best: day.solved[puzzleId], isNewBest, solvedCount: Object.keys(day.solved).length };
    }
    /** 今天這一組的進度 */
    dailyProgress() {
        if (!this.daily) return null;
        const solved = this.dailySolved(this.daily.key);
        return { done: this.daily.set.puzzles.filter((p) => solved[p.id]).length,
            total: this.daily.set.puzzles.length, solved };
    }
    /** 還沒解、且不是現在這題的下一題索引(-1=沒有了) */
    nextUnsolvedIndex() {
        const prog = this.dailyProgress();
        if (!prog) return -1;
        for (let i = 0; i < this.daily.set.puzzles.length; i += 1) {
            if (!prog.solved[this.daily.set.puzzles[i].id] && i !== this.daily.index) return i;
        }
        return -1;
    }

    startGame(mode, difficulty = 'easy', dailyIndex) {
        this.gameMode = mode;
        this._donePinged = false;   // 📡 每局只送一次 -done(統計)
        this.aiDifficulty = mode === 'daily' ? 'hard' : difficulty;   // 📅 殘局的黑方守得認真才有題味

        // Hide Menus
        this.uiMainMenu.classList.add('hidden');
        this.uiAiMenu.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
        this.uiGameInfo.classList.remove('hidden');

        // Initialize Game
        if (mode === 'daily') {
            /* 📅 每日一組多題(0831):不指定題號=接「今天還沒解的第一題」。 */
            const key = dailyPuzzleKey();
            const set = puzzlesForDate(key);
            const solved = this.dailySolved(key);
            const idx = Number.isInteger(dailyIndex)
                ? Math.max(0, Math.min(dailyIndex, set.puzzles.length - 1))
                : Math.max(0, set.puzzles.findIndex((p) => !solved[p.id]));   // -1(全解完)→ 0,可重玩
            this.daily = { key, set, index: idx, puzzle: set.puzzles[idx] };
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

    /* 💡 AI 提示(2026-09-01 全艦隊棋類批次)
       借的是**同一支** this.ai,不另寫一套搜尋 —— 提示與對手同源,說出來的話才算數
       (另寫一份的話,兩邊分岔的那天不會有任何測試變紅)。同 shot-success-odds
       「借判定同一支 simulate」的作法。
       三條規矩:
        ① 給出去之前先過 gameLogic.isValidMove —— ai.js 的走法產生器與 gameLogic 是兩支程式碼 ⇒ 不驗的話,
           哪天分岔了會提示一手玩家**點不動**的棋,
           那比沒有提示更糟(他會以為遊戲壞了,而他是對的)。
        ② 同一個局面按幾次都要回同一手:calculateBestMove 裡有 moves.sort(() => random)
           ⇒ 同分的兩手會輪流跳,看起來像跳針。快取的鑰匙**認位置、不排序**。
        ③ 文案分三態、不可混講:有建議 / 沒有合法著法 / 算的時候出事。 */
    showHint() {
        if (this.gameLogic.isGameOver) return;
        // 輪到 AI 的時候不給提示(那是它在想,不是玩家在想)
        if ((this.gameMode === 'pvai' || this.gameMode === 'daily')
            && this.gameLogic.currentPlayer === 'black') return;
        if (this._hintBusy) return;

        const statusEl = document.getElementById('game-status');
        const me = this.gameLogic.currentPlayer;
        const key = this.hintKey();

        if (this._hintCache && this._hintCache.key === key) {   // ②
            this.paintHint(this._hintCache.move, statusEl);
            return;
        }

        this._hintBusy = true;
        statusEl.innerText = '💡 想一手…';
        /* 先讓瀏覽器把「想一手…」畫出來再進搜尋:深度 3 是同步的,
           不讓出一幀的話畫面會整個凍住,看起來像當掉。 */
        setTimeout(() => {
            let move = null;
            try {
                move = this.ai.calculateBestMove(this.gameLogic.getBoardState(), me, 'hint');
                if (move && !this.gameLogic.isValidMove(          // ①
                    move.from.row, move.from.col, move.to.row, move.to.col)) move = null;
            } catch (e) {
                console.error('[hint] calculateBestMove threw:', e);
                this._hintBusy = false;
                statusEl.innerText = '💡 這一手算不出來,先自己走走看';   // ③ 出事
                return;
            }
            this._hintBusy = false;
            if (!move) { statusEl.innerText = '💡 找不到可走的棋了'; return; }   // ③ 無步
            this._hintCache = { key, move };
            this.paintHint(move, statusEl);                                      // ③ 有建議
        }, 30);
    }

    /* 把提示畫到盤上:綠圈=要動的那顆、綠點=要去的地方。
       文字只講「哪一顆」,不自創座標記法 —— 這站其他地方都沒有記法,
       發明一套只是多一個要學的東西,而綠圈綠點已經指得很清楚了。 */
    paintHint(move, statusEl) {
        const board = this.gameLogic.getBoardState();
        const piece = board[move.from.row][move.from.col];
        const eat = board[move.to.row][move.to.col];
        this.renderer.highlightSquare(move.from.row, move.from.col);   // 內含 clearHighlights
        this.renderer.highlightMoves([{ row: move.to.row, col: move.to.col }]);
        statusEl.innerText = `💡 建議走「${piece ? piece.name : '這顆'}」`
            + (eat ? `,吃掉對方的「${eat.name}」` : '')
            + '(綠圈是它,綠點是要去的地方)';
    }

    /* 提示快取的鑰匙 = 盤面 + 輪到誰。用完整 type:'king'/'knight' 取首字都是 k 會撞。 */
    hintKey() {
        const b = this.gameLogic.getBoardState();
        let s = this.gameLogic.currentPlayer + '|';
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
            const p = b[r][c];
            s += p ? p.color[0] + p.type + ',' : '.';
        }
        return s;
    }

    checkGameState() {
        if (this.gameLogic.isGameOver) {
            /* 📡 完賽打點:每局只送一次(動畫回呼會讓本函式跑兩次);統計壞掉不可以影響遊戲 */
            if (!this._donePinged) {
                this._donePinged = true;
                try { if (window.__xqPingDone) window.__xqPingDone(); } catch (_) { /* best-effort */ }
            }
            /* 📅 每日殘局的收場:贏=記步數(當日取最少)+新紀錄;輸=溫柔的「再試一次」
               (同一題重開,btn-restart 走 startGame('daily') 拿到的還是今天這一題)。 */
            if (this.gameMode === 'daily' && this.daily) {
                let txt;
                if (this.gameLogic.winner === 'red') {
                    /* ★ 只記一次:動畫回呼可能讓 checkGameState 跑兩次,第二次會把
                       「新紀錄!」蓋成「今天最佳」——同一局的成績只上帳一次。 */
                    if (this._dailySaved) return;
                    this._dailySaved = true;
                    const r = this.saveDailyResult(this.daily.key, this.daily.puzzle.id, this.redMoves);
                    const total = this.daily.set.puzzles.length;
                    txt = `📅 第 ${this.daily.index + 1} 題完成！用了 ${this.redMoves} 步`
                        + (r.isNewBest ? '(新紀錄！)' : `(這題最佳 ${r.best} 步)`)
                        + `・今天已解 ${r.solvedCount}/${total} 題`
                        + (r.solvedCount >= total ? '\n今天全解完了,明天有新的一組！' : '');
                } else {
                    txt = '差一點——按「🔁 這題再來一次」重試!';
                }
                document.getElementById('winner-text').innerText = txt;
                /* 📅 結算按鈕依情境給:有沒有下一題、要不要重試
                   (「再來一局」在每日模式會回同一題,語意混亂 ⇒ 明確拆成兩顆) */
                const next = this.nextUnsolvedIndex();
                const bNext = document.getElementById('btn-daily-next');
                const bRetry = document.getElementById('btn-daily-retry');
                const bRetryOld = document.getElementById('btn-retry');
                if (bNext) bNext.classList.toggle('hidden', next < 0);
                if (bRetry) bRetry.classList.remove('hidden');
                if (bRetryOld) bRetryOld.classList.add('hidden');
                this.uiGameOver.classList.remove('hidden');
                return;
            }
            const winnerName = this.gameLogic.winner === 'red' ? '紅方' : '黑方';
            document.getElementById('winner-text').innerText = `${winnerName} 獲勝！`;
            // 一般模式:把每日那兩顆藏回去、把「再來一局」放回來(不然上一場的殘留在框裡)
            const bN = document.getElementById('btn-daily-next');
            const bR = document.getElementById('btn-daily-retry');
            const bOld = document.getElementById('btn-retry');
            if (bN) bN.classList.add('hidden');
            if (bR) bR.classList.add('hidden');
            if (bOld) bOld.classList.remove('hidden');
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
                const prog = this.dailyProgress();
                di.innerText = `📅 ${this.daily.key} 第 ${this.daily.index + 1}/${prog ? prog.total : 1} 題`
                    + `(今天已解 ${prog ? prog.done : 0} 題)「${this.daily.puzzle.name}」・你已走 ${this.redMoves} 步\n${this.daily.puzzle.hint}`;
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

/* 📡 統計打點(hfpc-play-stats;skill play-stats-lite / play-stats-dwell 三層):
   ① 開啟 g=3d-xiangqi ② 完賽 -done(checkGameState 每局一次)③ 真實停留 -dwell(離頁/切背景時回報這次開頁的秒數)。
   零個資:只送站名與事件,沒有 cookie、沒有帳號。離線時 sendBeacon 靜默失敗,不影響下棋。
   與對局場(xiangqi-arena)同一份範本;站名=CF 專案名 3d-xiangqi,Worker NAMES 已登(0903)。
   ⚠ 端點是 /api/ping(不是 /p)、停留秒數的參數叫 t(不是 s)——寫錯的話 Worker 回 404 或丟棄,
      打點全部靜默消失而前端零紅燈(0903 首版就是抄到錯範本,當天抓到修掉)。 */
(() => {
    try {
        const ping = (evt) => {
            try { navigator.sendBeacon(`https://hfpc-play-stats.summer09201017.workers.dev/api/ping?g=${evt}`); }
            catch (_) { /* statistics are best-effort */ }
        };
        ping('3d-xiangqi');
        const openedAt = Date.now();
        let sent = false;
        const dwell = () => {
            if (sent) return;
            sent = true;
            ping(`3d-xiangqi-dwell&t=${Math.round((Date.now() - openedAt) / 1000)}`);
        };
        document.addEventListener('visibilitychange', () => { if (document.hidden) dwell(); });
        window.addEventListener('pagehide', dwell);
        window.__xqPingDone = () => ping('3d-xiangqi-done');
    } catch (_) { /* 統計壞掉不可以影響遊戲 */ }
})();
