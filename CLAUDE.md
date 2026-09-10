# CLAUDE.md — 3D 象棋(3D-Xiangqi)

## 現況(**2026-09-10,agape250 機**)

- 🔄 **手機不必下滑也能拿到新版(0910 下午,SW v23、verTag v18)**:主選單 + 下棋中的 HUD
  各加一顆「🔄 更新」;聽 controllerchange 自動 reload;開啟/切前景/每 30 分鐘主動問新版。
  細節見 讀我-HANDOFF.txt 最新 ★ 段。
- 💡 **修好「AI 提示後點綠點沒反應」(0910,SW v22)**:paintHint() 補上
  `gameLogic.selectedPiece = {row,col}`(以前只畫圈畫點,handleInteraction 不知道有選棋子,
  點綠點直接沒反應)。細節見 讀我-HANDOFF.txt 最新 ★ 段。

## 現況(**2026-09-09,agape250 機**)

- 📐🖐🎥🎨 **相機裝不下棋盤 + 旋轉太靈敏 + HUD 擋棋盤 + 重置視角 + 舊站配色(0909,使用者實機退件三件)**:
  ① 📐 **相機距離寫死** —— 這是從一開始就在的真 bug:`initScene` 把相機釘在 `(0,-60,90)`,
     `onWindowResize` 只改 `aspect`、**距離永遠不動**。手機**直向**(390×844,aspect 0.46)
     水平視角只剩約 19°,在那個距離看得到約 36 單位寬,而棋盤有 90 單位 ⇒ 棋盤爆出畫面兩三倍、
     只看得到中間幾格。`manifest` 鎖 `landscape`,所以「裝成 App」剛好躲過,**用瀏覽器直向開就中**。
     這也讓「旋轉太靈敏」更嚴重(看不到全貌時轉一點就天翻地覆)。
     ⇒ 新增 `fitCamera()`,算法照抄姊妹站 `xiangqi-arena`(它 0902 重建時就修掉了這個病):
       用 fov 與 aspect 反推「要退多遠才裝得下」,寬高各算一次取大的;只改**距離**、不改俯角
       (方向沿用 `INITIAL_CAM` 的 (0,-60,90) ⇒ 維持 atan(90/60) ≈ 56°,和對局場同角度)。
       接在 `initScene`(controls 之後 —— fitCamera 會設 `controls.target`,順序反了會靜靜跳過)
       與 `onWindowResize`(⚠ 只更新 aspect 不夠,長寬比一變「要退多遠」也變了)。
     實測直向 390×844:棋盤四角全在畫面內、盤寬 330px。
  ② 🖐 觸控 `rotateSpeed 1.0 → 0.4`、`panSpeed → 0.5`(`pointer: coarse` 才調,滑鼠維持 1.0)。
     旋轉量 = 2π × 拖曳像素 ÷ 容器高 × rotateSpeed ⇒ 劃 150px 從 **64° 降到 25°**(實測)。
     兩象棋站同一天同一條。
  ③ 🗂 **`#game-info` 從「畫面正中央的大彈窗」改成「左上角小 HUD」**(退件原話「擋到棋盤了」)。
     病根:`#ui-layer` 是 `flex; justify-content:center; align-items:center`
     ⇒ **每一個** `.panel` 都被擺在畫面正中央,包括這張「下棋中一直開著」的卡,正好壓在棋盤上;
     又沿用 `.panel` 的 `padding:30px`、`h2` 的 `margin-bottom:20px`、全域 `button` 的
     `display:block/width:100%/font-size:18px` ⇒ 一張又大又高的卡。
     ⇒ `position:absolute` 貼左上、字級與間距縮小、三顆鈕排一列(`.btn-row`)、`h2` 藏掉
       (「遊戲進行中」四個字沒有資訊卻吃掉一行 + 20px)。實測只佔畫面 **7%**、不壓畫面中心。
     ★ 只改這一張:主選單 / 難度 / 結算是「彈出來等你回應」的,置中是對的。
  ④ 🎥 新增 `resetCamera()` + `#btn-camera`(「🎥 重置視角」)。⚠ 一定要連 `controls.target` 一起歸零
     —— 兩指平移會把 target 拖走,只搬 `camera.position` 會變成「從新位置看著被拖歪的中心」,更亂。
  ⑤ 🎨 配色照使用者指定的參考站 3chinese.netlify.app(**已經是 Netlify 404、站沒了**)⇒
     唯一依據是使用者存下的兩張手機截圖,取色寫進 `PALETTE`:棋子象牙白面 + **綠邊**、
     紅字 `#d81f26`、黑方字 **深藍 `#1b2a5e`**、棋盤面米白 `0xece0c0` + 深咖啡格線、背景深板岩藍。
     ★ 這一份要和 `xiangqi-arena` 一模一樣。💡 提示的綠圈綠點刻意不動(亮萊姆綠仍分得出來,截圖比對過)。
  驗收:`npm test` 265 過 0 失敗;`npm run check` 20 過 0 失敗;
    另有實機驗收腳本(scratchpad)14 條全綠:HUD 位置/佔比/不壓中心、棋盤四角在畫面內、
    重置視角回到開場座標與 target、劃 150px 轉 25°、棋子側面 `#3fa84c`、棋盤面 `#ece0c0`、32 顆棋子、零 pageerror。

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
- 線上 https://3d-xiangqi.pages.dev = 最新。**SW 現值 `3d-xiangqi-v19`、verTag v15**(0909 這一輪:🎨 配色/雙層棋子 + 🔍 setPixelRatio + 🗂 HUD 可收起 + 🚪 離開全螢幕/返回,`81e487c`,線上已驗);renderer 含 `rotateZ`、`pieceUpper`、`fillLight`;app.js 含 `sendBeacon`、`btn-hud-fold`。
  ⚠ **本站的兩個版號是刻意分開的**:SW 的 `CACHE_NAME` 任何檔案有改就 bump,verTag 是「功能版」⇒ 兩者不相等不是漂移(姊妹站 arena 相反,它有 test/vertag.mjs 守兩者相等)。
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
