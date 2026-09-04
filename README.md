# 3D 象棋(3D-Xiangqi)

Three.js 中國象棋 PWA(vanilla,無建置)。**線上:<https://3d-xiangqi.pages.dev>**
(Cloudflare Pages 專案 `3d-xiangqi`,**直傳站**,未連 git)

## 功能

| | |
|---|---|
| 對局 | 玩家對玩家 / 玩家對 AI(初級・中級・高級;minimax + alpha-beta) |
| 💡 AI 提示 | 借同一支引擎從玩家這邊算一手;綠圈=要動的棋、綠點=要去的地方;同一局面按兩次同一手(不跳針) |
| 📅 每日殘局 | 每天一組 **5 題**(**N 手連將殺**,18 題題庫:2手×2 3手×5 4手×6 5手×5,每題機器窮舉驗過),全世界同一組;每題分開記最少步數(`localStorage` 鍵 `xiangqi-daily-v1`) |
| 3D | 滑鼠/手指拖曳旋轉、縮放;棋子的字一律**朝玩家**(0902 扶正) |
| PWA | 可安裝;LINE / Facebook / Instagram 內建瀏覽器會提示「換瀏覽器再安裝」 |
| 📡 統計 | 匿名三層打點(開啟 / `-done` 完賽 / `-dwell` 停留;0903 接上,端點 `/api/ping`、停留秒數參數 `t`),零個資、離線靜默;儀表板顯示名「3D 象棋(單機版・每日殘局)」 |

## 跑起來

```bash
npm install                                   # 只有 playwright-core(用系統 Edge/Chrome,不下載瀏覽器)
npm test                                      # test/daily.mjs 題庫驗算 129 項(零 DOM、零 three)
python -m http.server 8795                    # 任何靜態伺服器都行,browser-check 預設吃 8795
node scripts/browser-check.mjs                # 真瀏覽器冒煙 18 項(含 📡 打點三項:攔**回應**驗 200、完賽恰一次、零 404)
CHECK_URL=https://3d-xiangqi.pages.dev node scripts/browser-check.mjs   # 驗線上
```

## 部署(⚠ 直傳站,`git push` 不會上線)

```bash
# 在 main 分支上跑;wrangler 自動排除 node_modules / .git(0902 實測只上傳 18 檔)
npx wrangler pages deploy . --project-name=3d-xiangqi --branch main --commit-dirty=true
```

- 改任何檔都要 bump `service-worker.js` 的 `CACHE_NAME`(cache-first,不 bump 舊使用者永遠拿舊版)。
- 線上驗收**看內容**不看狀態碼,帶 `?bust=`:
  `curl -s "https://3d-xiangqi.pages.dev/service-worker.js?bust=1" | grep -o "3d-xiangqi-v[0-9]*"`

## 檔案

```
index.html                 殼、主選單、verTag 版本簡歷、內建瀏覽器偵測
js/app.js                  接線:選單 / 對局 / 每日殘局 / 💡 提示(_hintCache 同局面快取)/ 結算
js/renderer.js             Three.js 棋盤與棋子(圓柱 + Canvas 貼字;rotateX 躺平 + rotateZ 讓字朝玩家)
js/gameLogic.js            盤面 / 走子 / 將軍
js/pieces.js               走法規則
js/ai.js                   搜尋引擎:合法走法(過濾自將)/將軍/將死/困斃 + PST + MVV-LVA
                           + alpha-beta + 靜態搜尋 + 迭代加深(0904 重寫)
js/puzzles.js              每日殘局題庫 16 題 + 日期取題(UTC+8)
service-worker.js          cache-first;CACHE_NAME 要 bump
test/daily.mjs             題庫驗算(擺位合法 / 決定性 / 每題 AI 實打解得動 / 提示快取鑰匙)
scripts/browser-check.mjs  真瀏覽器冒煙(每日模式 → 提示 → 照建議打到贏 → 結算與戰績)
push.ps1                   git add / commit / push 一鍵(不部署)
```

## 踩過的坑

| # | 坑 | 防法 |
|---|---|---|
| 1 | **棋子的字轉了 90°**(0902 使用者退件「都需要朝下轉 90 度」) | r128 圓柱頂面 UV 是 u↔z、v↔x,疊 `rotateX(π/2)` 後每字順時針歪一個象限。`geometry.rotateZ(Math.PI/2)` 一行扶正。0901 對局場(xiangqi-arena)同一個病,正本在 skill `3d-game-kit`「圓柱棋子頂面貼字方向」。**方向類的錯要靠截圖看,不能靠推** |
| 2 | **提示不可借對手的難度檔** | 難度檔含刻意隨機/失誤;提示用最強且決定性的設定 + 同局面快取(memory `hint-must-not-borrow-opponent-difficulty`) |
| 3 | **每日殘局只有 1 題** | 使用者 0831 點名「不要只有 1 題」⇒ 一組 5 題、每題分開記步數 |

## 帳本

作品集 `hfpc-portfolio` id `3d-xiangqi`;`sites.json` 棋類;統計 Worker 顯示名(`NAMES['3d-xiangqi']`,0903 已登);manual-deploy-map(直傳 / 專案 `3d-xiangqi` / 目錄 `.`)。
