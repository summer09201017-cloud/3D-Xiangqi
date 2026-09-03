# roadmap — 3D 象棋(3D-Xiangqi)(**2026-09-03 對齊**)

## ✅ 已完成(別重做)

- v1 3D 象棋 PWA:PvP / PvAI 三檔、OrbitControls 自由轉、安裝鈕、內建瀏覽器提示。
- v2 → v3 📅 每日殘局:16 題題庫、每天一組 5 題、每題分開記最少步數、題庫逐題機器驗(0831)。
- 💡 AI 提示(0901,棋類批次 1/5,`de6c242`):同引擎算一手、同局面快取、綠圈/綠點標記、送出前過真規則。
- 🔄 棋子文字扶正(0902):`rotateZ(π/2)` 一行,所有棋子的字朝玩家;SW v5。
- 🏷 verTag v4(0903):版本簡歷補上 0902 兩件(原本只寫到 v3);SW v6。
- 🩹 打點端點修正(0903 同日):首版抄的範本寫 `/p` 與 `&s=`,Worker 只認 `/api/ping` 與 `&t=` ⇒ 打點全部 404、資料一筆沒進。
  驗法一起改:browser-check 從「攔 request 看送出沒」改成「攔 response 看狀態碼」+ 斷言零 404(17→18);SW v8,線上端到端驗過
  (`/api/summary` 出現 `3d-xiangqi`、KV 有 `g:`/`dw:`/`dl:` 三把鍵)。病根已在 skill `play-stats-dwell` 與守門 `dwell-beacon-guard` 收編。
- 📡 統計打點三層(0903,agape250 機):開啟 `g=3d-xiangqi` / `-done`(checkGameState 每局一次,`_donePinged` 閂鎖)/ `-dwell`(pagehide/visibilitychange),與對局場同一份範本;Worker `NAMES` 已登;browser-check +2 攔請求驗真的送出(15→17);verTag v5、SW v7。

## 🔜 待做(CP 值 = 價值 ÷ 時間)

| 項 | ⏱ | ★ | 說明 |
|---|---|---|---|
| ⛶ 全螢幕棋盤 | 1h | ★★ | 對局場 0902 剛做過(skill `embed-fullscreen-fit` #8)。**這站畫布本來就是整個視窗**,先實機量是不是真的太小,再決定做不做 |
| AI 考慮將軍 | 半天 | ★★ | `ai.js` 註解自己寫「不考慮將軍」;提示已過真規則但棋力受限。改了要重驗 129 題 |
| 手機直向版面 | 1h | ★ | 主選單與 HUD 在直向手機的可讀性沒實機驗過 |

## 🚫 刻意不做

- 黑方棋子的字轉 180° 朝黑方(實體擺法):使用者要的是全部朝玩家、看得懂;對局場也一致。
- 改成 ESM / 打包工具:1400 行 vanilla,測試靠 `new Function` 串檔已足夠。
- 連 git 自動部署:低頻改動的直傳站,手動一行 + `/deploy-drift-scan` 兜底(同 chess5 0902 拍板)。
