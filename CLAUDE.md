# CLAUDE.md — 3D 象棋(3D-Xiangqi)

## 現況(**2026-09-07,HFP 機**)

- 🎯 **💡 提示加「多賺半個卒才建議吃子」門檻(0907)**:四站統一的規矩(西洋棋 ×2、中國象棋、暗棋);
  `LEVELS.hint.tradeMargin = 50`、`_hintRoot()` 兩段式根層、`_captureGain()` 純子力交換試算。AI 對手三檔不受影響。
  ★ 同一輪順手修好「提示每局只搜到 depth 1」的真 bug(「算到殺棋就收工」漏了有限數檢查,`Math.abs(-Infinity) > MATE` 恆真)⇒ 現在穩定 depth 4~6。
  ⚠ 不可以拿 `calculateBestMove` 的 `scored` 去比門檻:迭代加深根層只有冠軍是精確分,其餘是上界 ⇒ 門檻永遠高於冠軍,任何吃子都過不了關。細節見 `js/ai.js` 的 `_hintRoot` 註解。
  測試:`npm test` = daily 251/0 + hint 6/0。

- 🧠 **AI 引擎重寫 + 📅 題庫全換「N 手連將殺」+ 規則層補「不得自將」(0904)**。細節見 `roadmap.md` 已完成段與 `js/ai.js` 檔頭註解。
  ⚠ 題庫由 scripts 生成 + 求解器窮舉驗證,**不要手改題目座標**;改了必跑 `npm test`。
  ⚠ 隨機只能給初級檔:中級以上一旦加「機率亂走」,實測一盤就丟掉一台車等級的分數。

- ✅ v1 對局(PvP / PvAI 三檔)・v2→v3 📅 每日殘局(一組 5 題,0831)・💡 AI 提示(0901,`de6c242`)・
  🔄 棋子文字扶正(0902,`09d7982`,rotateZ 一行)・verTag v4(0903 補寫版本簡歷)・📡 統計三層(0903:開啟 / `-done` / `-dwell`,app.js 尾段 IIFE + checkGameState 每局一次;verTag v5、SW v8)。
- 🩹 0903 同日修:首版抄到的範本端點是 `/p`(Worker 只認 `/api/ping`)、停留秒數參數寫 `s`(要 `t`)⇒ 打點全部 404、資料一筆沒進。
  📡 打點驗收要看**回應狀態碼**,不是「有沒有送出」(0903 實錘:端點寫 /p 而非 /api/ping,請求照樣送出、sendBeacon 不看回應、前端零紅燈,而 Worker 回 404、資料一筆不進);browser-check 已改成攔 `page.on("response")` 驗 200 並斷言「沒有任何打點被退回 404」。
  端到端證明:`/api/summary` 出現 `3d-xiangqi`(open=1、dwellAvg=95),KV 有 `g:`/`dw:`/`dl:` 三把鍵。
- 線上 https://3d-xiangqi.pages.dev = 最新。**SW 現值 `3d-xiangqi-v14`、verTag v10**(本輪我推到 v13/v9,之後別場的「🏷 版本簡歷可收合」批次續推到 v14/v10);renderer 含 `rotateZ`;app.js 含 `sendBeacon`。
- 測試:`npm test` = **daily 251/0 + hint 6/0**;`node scripts/browser-check.mjs` 18/0(本機與線上都跑過;含攔 play-stats 請求驗開啟/完賽打點真的送出)。
- 待做見 `roadmap.md`;給人讀的在 `README.md`;給另一台機的在 `讀我-HANDOFF.txt`。

## 一檔一責

- `index.html` 殼 + 主選單 + verTag + 內建瀏覽器偵測(LINE/FB/IG 只提醒不擋)。
- `js/app.js` 接線(選單 / 對局 / 每日 / 提示 / 結算);`js/renderer.js` Three.js(棋盤、棋子、標記、動畫、點擊射線);
  `js/gameLogic.js` 盤面規則;`js/pieces.js` 走法;`js/ai.js` 搜尋引擎(合法走法/將軍/PST/靜態搜尋/迭代加深);`js/puzzles.js` 題庫與取題。
- `service-worker.js` cache-first;`test/daily.mjs` 題庫驗算;`scripts/browser-check.mjs` 真瀏覽器冒煙。

## 鐵則(務必守)

- **改任何檔就 bump `service-worker.js` 的 `CACHE_NAME`**。不 bump = 舊使用者永遠拿舊版,而且沒有任何紅燈。
- **部署是直傳**:`npx wrangler pages deploy . --project-name=3d-xiangqi --branch main --commit-dirty=true`;
  `git push` / `push.ps1` **不會**上線。線上驗收看內容不看狀態碼(帶 `?bust=`)。
- **棋子貼字方向**:`createPieceMesh` 裡 `rotateX` 後面那行 `geometry.rotateZ(Math.PI / 2)` 不可刪;
  動到棋子幾何或貼圖就用真瀏覽器截圖看字(車/士/兵接近對稱,掃一眼看不出來)。
- **💡 提示**:借引擎不借難度檔、同局面快取(`_hintCache`)、送出前過真規則。**0907 起還多兩道關卡**:吃子要①交換算到底子力有賺(`_captureGain > 0`)②比最好的安靜手多賺 `tradeMargin`(半個卒),否則建議走位;走 `_hintRoot()` 那條路,AI 對手不受影響。四鐵則在 memory
  `hint-must-not-borrow-opponent-difficulty` 與 skill `solitaire-solver-kit` 第〇課。
- **📅 每日殘局**:題庫每一題都要機器驗「解得動」(test/daily.mjs ③);改題庫必跑 `npm test`。
- `js/` 是瀏覽器全域 class(不是 module);測試用 `new Function` 串檔取回類別,**不要改成 ESM**。
- 驗收腳本用 `playwright-core` + 系統 Edge/Chrome(零下載);**真點擊 `page.click`**,不在 evaluate 裡呼叫函式。

## 本機地雷

- 埠 8795 給 browser-check 用;repo 沒有 serve 腳本,`python -m http.server 8795` 即可。
- `.wrangler/` 是 wrangler 暫存,不進 git;`node_modules/` 只有 playwright-core。
- 同引擎的姊妹站 `xiangqi-arena`(對局場)是**另一個 repo、另一個 CF 專案**,別搞混。
