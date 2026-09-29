# CLAUDE.md — 3D 象棋(3D-Xiangqi)

## 現況(**2026-09-29,HFP 機**)

- 🎲 **執子 + 擲骰 / 擲硬幣決定先後(0929,HFP 機・Opus 5.5・0929-骰2骰3-家裡 場;SW v33、verTag v28)**:skill `dice-coin-toss` 第二個活例(骰2)。
  ★ 大表原本寫「index.html 已有選邊 = S 級」**不成立**:本站玩家寫死執紅、AI 寫死執黑 ⇒ 先做「可執黑、電腦先走」才接得上浮層(M 級)。
  ① 難度選單 `#side-row` 四顆:🔴 我執紅 / ⚫ 我執黑 / 🎲 擲骰決定 / 🪙 擲硬幣(贏的人執紅,紅先走)。`app.sidePick` = 選單值,`app.humanSide` = 這局真的顏色(dice/coin 不流進棋局)。
    `startGame` 改 async:`pickSide()` 每局重擲(重新 / 再來一局也走它);兩人同機 / 每日殘局一律 red。浮層的臉用 `PetKit.animalFor(mode, 難度)`(這局那隻,不是 opponent.kind)。
  ② `app.aiSide()` / `app.isAiTurn()` 取代所有寫死的 'black' / 'red'(點擊擋、提示擋、電腦接手、無步可走判勝、動物將軍 / 哇 / 贏輸、閒聊 waiting)。
    `_gen` 局號:電腦那手 setTimeout 回來時局已換 ⇒ 丟掉(電腦先走時按「重新」最容易撞到,不擋會在新局替你走一手)。
  ③ `renderer.setSide(side)`:只改 `INITIAL_CAM.y`(±60)⇒ 開場 / 🎯 重置 / fitCamera 同一邊;執黑時 `createPieceMesh` 的 rotateZ 多轉 π(字朝你)。動物坐「相機對面」自動換邊,一行沒改。
  ④ `js/dice-toss.js` = skill 正本同一份(站內不改);index.html 模組橋接 `window.DiceToss`,載不進 ⇒ 靜默亂數。HUD「紅方(你) / 黑方(電腦)」、結算「黑方(你) 獲勝!」。
  驗:`npm test` +dice 5 項全綠;`npm run check` **67/0**(🎲 段 +11:執黑電腦先走 / 鏡頭 +Y / 動物坐紅方 / HUD / dice & coin 畫面朝上 = 記錄 / 開始鈕 48px / 浮層是 🐰 / 誰先 ⇒ 執色 + 鏡頭 / 回紅方);兩跑都綠;portrait 36/0、menu-overflow 3/0;執黑截圖目視(字朝你、🐰 在紅方那側)。

## 前一輪現況(**2026-09-28,HFP 機**)

- 🐾 **動物對手坐到你對面(0928,HFP 機・Fable 5.1・0928-3D動物對手-象棋家族-家裡 場;SW v32、verTag v27)**:skill `animal-opponent-kit` 第六個活例
  (正本 majiang3d、範本 gomoku3d;象棋家族六站同一場接)。對 AI:初級 🐰 / 中級 🐱 / 高級 🐻;📅 每日殘局 🦉 守黑方;玩家對戰玩家不出現。
  ① `js/animals.js`(引擎)/ `js/voice.js`(人聲 runtime)/ `js/three-shim.js`(全域 THREE → ESM 具名匯出 + 補 CapsuleGeometry)三支與 skill assets
    **同一份,不在這裡改**(browser-check 🐾 有逐位元對賬);本站接線在 `js/opponent.js`、唸稿在 `js/voicePhrases.js`。
  ② ★ 本站是 **CDN 全域 THREE r128 + 傳統 script**,動物引擎是 ES module `import 'three'` ⇒ index.html 加一張 **import map**(`three` → `./js/three-shim.js`,
    必須放在第一個 `<script type="module">` 之前)+ 一段模組橋接掛成 `window.PetKit`(跟 view-kit 同一招);app.js `initPet()` 等 `pet-kit-ready`。舊瀏覽器載不進 ⇒ 沒動物、棋照下。
  ③ ★ 本站世界是 **Z-up**(棋盤躺 XY、camera.up=+Z),引擎假設 Y-up ⇒ 動物掛在轉 +90°(繞 X)的父群組 `petRoot` 底下;不用引擎的 lookAt(它拿世界座標算、up 是 +Y),
    `opponent.js` 自己設 `group.rotation.y` 朝盤心。座位永遠在相機對面(每幀量相機方位角,2° 一格重擺;🔃 換邊跟著坐到 -Y),距離 = 矩形盤緣 + 1.25×scale。
  ④ 大小 **0.215 倍**(半盤 45 ⇒ 7.4;頭直徑 ≈ 兩顆棋子):0.24 倍時頭頂 NDC 剛好 0.97、但貓 / 熊耳尖被切幾 px,讓位已頂到上限救不回 ⇒ 縮一點 + 取景點加 EAR_ROOM 0.55。
  ⑤ 相機讓位:`renderer.fitCamera` 加 `fitExtra(dir)`(二分法拉遠到取景點入鏡,**上限 1.28 倍**;俯角 ≥76° 不讓);`renderer.floorZ`(=板底 -4)給凳子落地;
    `renderer.onFrame(dt)` 每幀回呼(順手修了「每局 startGame 再叫 animate() 會疊一條 rAF 鏈」:先 cancel 再排)。桌機實測讓位縮盤 0.76(≥0.75)。
  ⑥ 反應跟狀態文字同分岔(這站沒音效):牠想棋 think(人聲每三手一次)/ 落子 place / 將你的軍 hop+「將軍!」/ 被你吃子・被你將軍 gasp+「哇」/ 贏 win / 輸 lose(每局一次閂鎖 `_petEnded`);
    等你太久閒聊(15s 第一句、再 30s 第二句、一回合兩句;任何 pointerdown / keydown 歸零)。
  ⑦ 人聲照 baked-voice 三件套:`npm run voice`(= `gen-voice.mjs --phrases js/voicePhrases.js --out voice --sw service-worker.js`;skill 的 gen-voice 0928 加了 `--out` / `--sw`
    給沒有 public/ 的平放站)⇒ `voice/` 32 支 mp3 + manifest,service-worker.js 的 `/* voice:begin */…/* voice:end */` 段照目錄重生;`scripts/stage.mjs` SHIP 加 `voice`。
  ⑧ UI:難度選單多一組「🐾 對手動物」三段(會說話 / 不出聲 / 關,localStorage `xiangqi3d-pet`);HUD 多一行「對手:🐱 橘貓」;`body.pet-on` 手機橫向把左上 HUD 卡收窄到 42vw 讓臉。
  ⑨ 驗:browser-check +29(檔案對賬 / 引擎同 skill / 坐對面 / 鐵則遍歷 / 頭在畫面裡 ×3 視口 / 臉沒被 HUD 蓋 / 讓位 ≤25% / figs.log 有 think+place / 姿勢手動推時間 /
    換邊 / 對局視角 / 三段開關 / pvp 不坐 / 人聲 runtime / 每日 🦉)⇒ **56/0**;npm test 全綠;三視口截圖目視過(貓整隻入鏡、HUD 沒蓋臉)。
  ⚠ 姿勢一律 `opponent.figs.update(0.4)` 手動推時間(無頭 fps 低、dt 上限 0.05);`opponent.probe()` 一次量頭頂 / 凳子 / 座位(世界 XY)。

## 前一輪現況(**2026-09-14,HFP 機**)

- 🎥 **視角工具列統一(0920,使用者拍板「六款 3D 棋類長一樣:預設三段 + 滑桿微調 + 換邊 + 重置」;SW v31、verTag v26)**:
  `js/view-kit.js` = 艦隊共用複本(來源 `hfpc-claude-skills/plugins/hfpc-skills/skills/board3d-kit/assets/view-kit.js`,**別在站內改它**,要改回 kit 改再複製過來)。
  HUD 卡 `#hud-body` 的 `.btn-row` 底下多一個 `<details id="view-kit-fold">🎥 視角</details>`,`renderer.mountViewKit()` 在每局 `initScene` 的 `fitCamera()` 之後用模組的 `orbitAdapter` 掛進去;
  **所有裝置預設收起**(展開後卡高 ~376px:直向在底部吃掉棋盤高度;橫向/桌機是左上浮卡、把左邊兩路棋子整個蓋住——0920 截圖實測),撥開過記在 `localStorage xiangqi3d.viewkit.open`。舊的 `#btn-camera` 拆掉(重置併進工具列)。
  直向 CSS 補 `#game-info #hud-body { align-self: stretch }`(卡片是 align-items:flex-start 的直向 flex,不撐開的話鈕排/滑桿只有 ~240px 寬、右邊一大塊空白)。
  ★ 兩個順手修的相機行為:①`camera.up` 改 **+Z**(棋盤法線),OrbitControls 才是「繞棋盤中心水平轉 / 離正上方幾度」——原本預設 +Y 是繞棋盤上下方向那條軸轉、會轉到桌面底下;
    **一定要在 new OrbitControls 之前設**(它建構時就抓死 up 的四元數);`maxPolarAngle` 改 π/2−0.02(不再鑽到桌底)。開場畫面一個像素不變(INITIAL_CAM 方向落在 YZ 平面)。
    ②`fitCamera(opts)` 改成**照目前方向只重算距離**,只有 `{reset:true}`(🎯 重置視角)才回 INITIAL_CAM——以前視窗轉向 / HUD 高度一變(直向狀態行多一行也算)就把角度彈回開場,工具列會變成擺著好看。
  驗收:`npm test` 全綠;`npm run check` 26/0(新增 6 條:三顆預設鈕、開場 0°/≈56°、換邊→180°、正俯視→88° 亮燈、重置→回 0°/56°、#btn-camera 已拆);`npm run check:portrait` 36/0。
- 🩹 **拔掉「index.html 進 SW 快取名單」地雷(0914 全艦隊,SW v30、verTag v25)**:Cloudflare Pages 把 `/index.html` 308 到 `/`,
  名單裡有 `./index.html` ⇒ install 存到 redirected:true 的回應 ⇒ 導覽拿到它就 ERR_FAILED(3D-Chess 幻影版實錘「裝成 App 打開就無法連上」),
  每次 bump SW 重踩。改動:`ASSETS_TO_CACHE` 拔 `./index.html`、`SHELL` 改 `./`;test/sw.mjs 改守「快取有 `./`、名單/退路/match() 零 index.html」。
  補丁來源 skill `static-pwa-ship/patches/patch-sw-index.mjs`(--cf --write);線上重演 `scripts/check-sw-nav-fleet.mjs` 🟢。**永遠不要把 index.html 加回名單。**
- ↩️ **俯角改回 56.3°(0913 第四輪,SW v29、verTag v24)**:第三輪照「棋盤朝上,順時鐘 8 度,接近 2D」改 64.3°,使用者實機
  看過後說「棋盤角度恢復上一版的角度 56.3 度,新版角度不 OK」⇒ `INITIAL_CAM` 回 (0,-60,90)。**這一站的角度使用者已親自否決過
  「更陡」一次,再動之前先問。** 兩欄主選單保留。check:portrait ① 改量 56.3°。
- 🎥🗂 **俯角 +8°(56.3→64.3°,已於第四輪撤回)+ 橫式主選單兩欄(0913 第三輪,SW v28、verTag v23)**:使用者「棋盤朝上,順時鐘 8 度,
  接近 2D 視角」⇒ `js/renderer.js` `INITIAL_CAM` (0,-60,90) → (0,-43.3,90)(只有方向有意義,fitCamera 沿它重算距離;
  攤平公式不隨角度變,角度越陡餘裕只會更夠)。使用者拍板「橫式的鈕排成兩欄」⇒ index.html
  五顆鈕包進 `.menu-grid`,`css/style.css` 尾段 `@media (orientation:landscape) and (max-height:500px)` 排兩欄 + 縮 h1/padding,
  整張選單在 844×390 不用捲(直向、桌機一字不動;⚠ 兩顆鈕有行內 margin-top,grid 裡用 !important 蓋)。
  `check:portrait` ① 加「開場俯角 64° 量真相機」、新 ⑥ 橫式主選單 scrollHeight ≤ clientHeight / 兩欄 / 每顆鈕在視窗內。
- 🔓 **manifest 解鎖橫式(0913 第二輪,SW v27、verTag v22)**:使用者看完 v21 回報「手機直式時也想要有主選單,
  目前只有橫式才有主選單」—— 真因不是版面,是 `manifest.json` 的 `"orientation": "landscape"`:裝成 App 後系統
  **強制轉橫**,直著拿永遠進不到主選單,v21 的直向版面在 App 裡也看不到。改成 `"any"`(姊妹站 xiangqi-arena 同值,
  3d-chinese-chess 沒設)。新 `test/manifest.mjs` 守「不可以鎖回橫式」;`check:portrait` 加 ⑤ 直向主選單全在視窗內
  + 線上 manifest 不鎖橫。⚠ 已裝的 App 要等瀏覽器更新 manifest(通常一天內)或移除重裝才解鎖。
  ⚠ 橫向主選單本來就比 390 高、要捲(使用者截圖可見),這輪沒動;要改的話是把六顆鈕在橫向排兩欄。
- 📱 **直向手機有獨立版面(0913,SW v26、verTag v21)**:使用者對 0910 那句「也需要有直式的選單,
  目前只有橫式選單」拍板選「獨立的直向版面」。做法:
  · `css/style.css` 尾段 `@media (orientation: portrait) and (max-width: 768px)`:`#game-info` 從左上角
    浮層改成**停在畫面底部的整寬控制列**(鈕三欄 grid、≥44px),`#game-container` 高 =
    `calc(100dvh − var(--hud-h))`。橫向完全不變。
  · `js/app.js` 尾段 IIFE:ResizeObserver + MutationObserver(只讀 class)量 `#game-info` 真實高度
    寫進 `--hud-h`,再 rAF 發 `resize` 讓 renderer 重 fit;橫向 / HUD 隱藏時寫 0。把手 `window.__hudLayout`。
  · `js/renderer.js` 新增 `viewSize()`(讀 `#game-container` 的 clientWidth/Height),initScene /
    fitCamera / onWindowResize / **onMouseClick 的 NDC** 全改照容器算 —— 照 window 算的話直向
    棋盤會裝滿整個視窗、最下排躲在 HUD 底下,點擊也整體偏掉。
  · ⚠ 直向是「寬度卡住」:收起 HUD 棋盤**不會**變大(多出來的是空白),verTag 沒寫「收起就放大」。
  · 驗收 `npm run check:portrait`(scripts/check-portrait-layout.mjs,22 項:底部整寬 / 不重疊 /
    畫布高 = 視窗 − HUD / 四角投影在畫布裡 / 三欄 ≥44px / 收起不變小 / 直向真點擊選得到炮 /
    橫向 HUD 仍左上小卡且畫布 = 視窗)。⚠ 腳本要先等 SW 首次接管的自動 reload 做完再點鈕
    (`performance.getEntriesByType('navigation')[0].type==='reload'`),不然隨機紅;check-refresh 同一條。

## 現況(**2026-09-10,agape250 機**)

- 🩹 **修好「更新鈕把版本/簡歷擠出畫面外」(0910 傍晚,SW v24、verTag v19)**:`.panel` 補
  `max-height:100vh; overflow-y:auto`——`#ui-layer` 是 100vh 置中的 flex,卡片從沒處理過
  「內容比手機可用高度高」,超出的一截以前直接消失、沒有捲軸。細節見 讀我-HANDOFF.txt 最新 ★ 段。
  📋 使用者另提「需要直式選單,目前只有橫式」——0913 拍板「獨立的直向版面」,已做(見上一段)。
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
- 🐾 `js/animals.js` / `js/voice.js` / `js/three-shim.js` = skill animal-opponent-kit/assets **同一份(不在這裡改;browser-check 逐位元對賬)**;
  `js/opponent.js` 本站接線(誰坐 / Z-up 父群組 / 坐相機對面 / 讓位取景點 / 閒聊)、`js/voicePhrases.js` 四隻唸稿;`scripts/gen-voice.mjs` 烤 mp3 → `voice/`(npm run voice);
  `scripts/serve.mjs` 本機伺服器(埠 8795,npm run serve)。

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
