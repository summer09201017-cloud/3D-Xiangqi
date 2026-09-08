# CLAUDE.md — 3D 象棋(3D-Xiangqi)

## 現況(**2026-09-08,agape250 機**)

- 🩹💡 **修「裝到手機打開就 ERR_FAILED」+ 提示先算「幾手必勝」(0908,使用者實機退件兩件)**:
  ① 退件是一張實機截圖:安裝後打開 → `3d-xiangqi.pages.dev/index.html`「無法連上這個網站 / ERR_FAILED」。
     三個病一起造成它:
       · `install` 用 `cache.addAll()`(**全部或全無**)。清單裡有兩個外部 CDN 的 three.js,
         安裝那一刻只要**任一個**抓不到(手機切網 / CDN 抖一下 / 擋第三方),整批 reject
         ⇒ 快取裡一個檔都沒有,而 SW 照樣註冊成功、畫面零錯誤、沒有任何測試會紅。
         之後從主畫面獨立視窗開 `start_url`,網路不順就直接 ERR_FAILED。
         ⚠ 姊妹站 `xiangqi-arena` 的 `sw.js` 早就因為同一個坑改成逐一 add,**這邊沒同步到** ——
           兩站的 `js/ai.js` 有「逐字相同」的規矩,SW 卻沒有,所以漂了。
       · `fetch` 沒有導覽請求(navigate)的退路,也沒 `ignoreSearch` ⇒ `start_url` 帶查詢字串就 miss。
       · 沒有執行期快取 ⇒ 安裝時沒抓到的檔永遠補不回來。
     修法(`service-worker.js` v14 → **v15**):逐一 `add` + `catch`;
     navigate 走「本網址(ignoreSearch)→ 網路 → 殼層 `index.html` → `./`」;
     同源 GET 成功順手存一份;`skipWaiting` + `clients.claim`;補 `GET_VERSION` 回報。
     `manifest.json`:`start_url` `./index.html` → `./`、補 `scope`/`id`/`lang`/`purpose`。
     新增 `test/sw.mjs`(已接進 `npm test`):餵它一個「抓不到的 CDN 資產」,量最後快取剩幾筆。
     ★★ **為什麼不用真瀏覽器驗**:Playwright 的 `page.route` **攔不到 Service Worker 自己發的請求**
        —— 0908 實際踩到:`route(...).abort()` 擋了 CDN,SW 照樣把 14 個資產全抓到、離線照樣開得起來,
        那個實驗**證不到任何事**(而且看起來像綠燈)。改用假的 `caches` 直接餵失敗才驗得到。
     實測:新 SW 13 筆進快取 / 舊 SW **0 筆**(測試會咬);真瀏覽器離線開 `/index.html` 也開得起來。
  ② 退件原話「我按照 AI 提示去走,結果車九被將吃了,AI 提示太弱」。
     `js/ai.js` 與 `xiangqi-arena` 同步(逐字相同的一份),細節見那邊的 CLAUDE.md;摘要:
     病根不是搜得不夠深,是提示不知道自己在解殘局 ⇒ 新增 `findForcedMate` 連將殺搜尋、
     `hintMove()` 當提示唯一入口、`LEVELS.hint.minDepth=3`(不再跟著裝置速度變笨)、
     🛡 掉子關、文案三態(含「這顆會被吃掉,是故意的——棄子換將位」)。
     `scripts/browser-check.mjs` 的自動打通關那一段從 `calculateBestMove(red,'hard')` 改成**照 💡 提示走**:
     ★ 舊寫法**本來就會隨機紅**(hard 有 tieRandom,實測從這一題開打「紅 hard vs 黑 hard」六局只贏 2~4 局),
       而且它守的不是使用者在做的事。現在守「照提示走一定在標示手數內解掉」+「每一手都講得出 N 手必勝」,
       實測 **3 步解掉 mateIn 3**(退件那一局是 7 步還在走),跑兩次都一樣(確定性)。

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
- 線上 https://3d-xiangqi.pages.dev = 最新。**SW 現值 `3d-xiangqi-v15`、verTag v11**(本輪我推到 v13/v9,之後別場的「🏷 版本簡歷可收合」批次續推到 v14/v10);renderer 含 `rotateZ`;app.js 含 `sendBeacon`。
- 測試:`npm test` = **daily 251/0 + hint 6/0**;`node scripts/browser-check.mjs` 18/0(本機與線上都跑過;含攔 play-stats 請求驗開啟/完賽打點真的送出)。
- 待做見 `roadmap.md`;給人讀的在 `README.md`;給另一台機的在 `讀我-HANDOFF.txt`。

## 一檔一責

- `index.html` 殼 + 主選單 + verTag + 內建瀏覽器偵測(LINE/FB/IG 只提醒不擋)。
- `js/app.js` 接線(選單 / 對局 / 每日 / 提示 / 結算);`js/renderer.js` Three.js(棋盤、棋子、標記、動畫、點擊射線);
  `js/gameLogic.js` 盤面規則;`js/pieces.js` 走法;`js/ai.js` 搜尋引擎(合法走法/將軍/PST/靜態搜尋/迭代加深);`js/puzzles.js` 題庫與取題。
- `service-worker.js` cache-first;`test/daily.mjs` 題庫驗算;`scripts/browser-check.mjs` 真瀏覽器冒煙。

## 鐵則(務必守)

- **改任何檔就 bump `service-worker.js` 的 `CACHE_NAME`**。不 bump = 舊使用者永遠拿舊版,而且沒有任何紅燈。
- **部署是兩步(0908 起改白名單,不再直傳整個資料夾)**:`npm run stage` → `npx wrangler pages deploy .deploy --project-name=3d-xiangqi --branch main --commit-dirty=true`;
  `git push` / `push.ps1` **不會**上線。線上驗收**看內容不看狀態碼**(這站找不到的路徑一律回首頁 200 約 14 KB;`curl -s <url> | head -c 60` 看是真內容還是 `<!DOCTYPE html>`)。
  為什麼改:原本 `pages deploy .` 是「整個資料夾照原樣搬上去」⇒ CLAUDE.md / package.json / test/ / scripts/ 全都在線上拿得到真內容。
  那不是密鑰外洩(`.env` 沒進版控、repo 本來就公開),而是 ①內部筆記可能被搜尋引擎收錄 ②「預設全上」是留給未來的坑
  (哪天有人在資料夾放草稿/備份/名單,會自動變成公開網址而且沒人發現)。`scripts/stage.mjs` 的 `SHIP` 白名單 = 12 個檔,
  而且它會拿 `service-worker.js` 的 `ASSETS_TO_CACHE` 回頭對賬(漏檔就 exit 1 —— SW v15 起 install 是逐一 add + catch,漏檔會**靜默**不離線)。
  ⚠⚠ **`.assetsignore` 對 `pages deploy` 完全無效**(0908 實測:加了之後上傳檔數 24 → 25,多的就是它自己,該擋的一個都沒少)。
  那是 Workers `--assets` 的機制。姊妹站 `xiangqi-arena/scripts/stage.mjs` 檔頭早就寫過這一條。
  ⚠ 部署完那一刻,**先前被抓取過的舊路徑會有幾分鐘的 CDN 殘留**(`CF-Cache-Status: HIT`,標頭是 `max-age=0, must-revalidate`)⇒ 隔一下再驗就對了。
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
