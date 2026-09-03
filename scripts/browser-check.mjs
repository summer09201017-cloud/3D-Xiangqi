// 🔬 每日殘局真瀏覽器冒煙(playwright-core + 系統 Edge/Chrome,不佔 Playwright MCP 的瀏覽器)。
// 跑法:node scripts/browser-check.mjs   (先起本機伺服器,或 CHECK_URL=線上網址)
// 驗:選單入口 → 開局=今天的題 → 紅方照 AI 建議走同一條輸入管線打到贏 →
//     結算文字(新紀錄)→ localStorage 記一筆且**只記一次**(閂鎖)。
import { chromium } from "playwright-core";

const URL = process.env.CHECK_URL || "http://localhost:8795";
let browser = null;
for (const channel of ["msedge", "chrome"]) {
  try { browser = await chromium.launch({ channel, headless: true }); break; }
  catch { /* 換下一個 channel */ }
}
if (!browser) { console.error("找不到系統 Edge/Chrome"); process.exit(1); }

let pass = 0, fail = 0;
const ok = (cond, msg, note = "") => {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.error("  ✗ " + msg + (note ? " → " + note : "")); }
};

const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// 📡 統計打點:攔下送往 play-stats 的請求(sendBeacon 在 Chromium 也會經過 request 事件)
const beacons = [];
/* ★ 驗「伺服器收下」不是「瀏覽器送出」:0903 首版只攔 request 就全綠,而端點寫錯(/p 而非 /api/ping)
   ⇒ Worker 回 404、資料一筆沒進,前端零紅燈。攔 response 拿狀態碼才抓得到。 */
page.on("response", async (r) => { const u = r.url(); if (u.includes("hfpc-play-stats")) beacons.push({ u, s: r.status() }); });
await page.goto(URL + "/?v=" + Date.now(), { waitUntil: "networkidle" });
const opens = beacons.filter((b) => /[?&]g=3d-xiangqi(&|$)/.test(b.u));
ok(opens.length > 0 && opens.every((b) => b.s === 200), "📡 開啟打點:伺服器收下(200)", JSON.stringify(opens));
await page.waitForTimeout(900);

ok(await page.locator("#btn-daily").count() === 1, "主選單有「📅 每日殘局」鈕");
ok((await page.locator("#verTag").textContent()).includes("一組 5 題"), "verTag 講了一組 5 題");

await page.evaluate(() => localStorage.removeItem("xiangqi-daily-v1"));
await page.click("#btn-daily");
await page.waitForTimeout(1200);

const st = await page.evaluate(() => {
  const a = window.app;
  return { mode: a.gameMode, key: a.daily.key, name: a.daily.puzzle.name, diff: a.aiDifficulty,
    info: document.getElementById("daily-info").innerText };
});
ok(st.mode === "daily" && st.diff === "hard", "進每日模式,黑方=高級 AI", JSON.stringify(st));
ok(/^\d{4}-\d{2}-\d{2}$/.test(st.key), "日期鍵格式正確(" + st.key + " 「" + st.name + "」)");
ok(st.info.includes(st.key) && st.info.includes("0 步"), "狀態行帶日期與步數");

/* 💡 提示鈕:真的用滑鼠按(不是 evaluate 裡呼叫 showHint)——
   evaluate-not-click-guard 存在的理由就是這個:繞過真點擊的話,
   「鈕被別的東西蓋住、按不到」這種病照樣全綠。 */
ok(await page.locator("#btn-hint").count() === 1, "遊戲畫面有「💡 提示」鈕");
await page.click("#btn-hint");
await page.waitForTimeout(500);
const h1 = await page.evaluate(() => ({
  status: document.getElementById("game-status").innerText,
  marks: window.app.renderer.highlightMeshes.length,
  move: JSON.stringify(window.app._hintCache && window.app._hintCache.move),
}));
ok(h1.status.includes("建議走"), "按下去有給一手建議", h1.status);
ok(h1.marks >= 2, "盤上畫了綠圈(要動的棋)+ 綠點(要去的地方)= " + h1.marks + " 個標記");
ok(await page.evaluate(() => {                    // 建議的那一手必須真的合法
  const m = window.app._hintCache.move;
  return window.app.gameLogic.isValidMove(m.from.row, m.from.col, m.to.row, m.to.col);
}), "建議的那一手通得過真正的規則(玩家點得動)");

await page.click("#btn-hint");                    // ② 同局面再按一次
await page.waitForTimeout(400);
const h2 = await page.evaluate(() => JSON.stringify(window.app._hintCache.move));
ok(h2 === h1.move, "同一個局面按兩次 ⇒ 同一手(不跳針)", h1.move + " vs " + h2);

// 紅方照 AI 建議走(與真手指同一條 handleSquareClick 管線),黑方由遊戲自己回
const end = await page.evaluate(async () => {
  const a = window.app;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 60 && !a.gameLogic.isGameOver; i++) {
    if (a.gameLogic.currentPlayer !== "red") { await sleep(150); continue; }
    const mv = a.ai.calculateBestMove(a.gameLogic.getBoardState(), "red", "hard");
    if (!mv) break;
    a.handleSquareClick(mv.from.row, mv.from.col);
    a.handleSquareClick(mv.to.row, mv.to.col);
    await sleep(700);
  }
  await sleep(1600);   // 等最後一手的動畫回呼把結算開出來
  return { winner: a.gameLogic.winner, redMoves: a.redMoves,
    winText: document.getElementById("winner-text").innerText,
    overlay: !document.getElementById("game-over-menu").classList.contains("hidden"),
    store: localStorage.getItem("xiangqi-daily-v1") };
});
ok(end.winner === "red", "紅方打得贏今天的題(用了 " + end.redMoves + " 步)", JSON.stringify(end));
ok(end.overlay && end.winText.includes("題完成") && end.winText.includes("今天已解"),
  "結算畫面開了、帶今天進度", end.winText);
ok(end.winText.includes("新紀錄"), "第一次打=顯示「新紀錄!」(閂鎖沒讓第二次觸發蓋掉)", end.winText);
const rec = JSON.parse(end.store || "{}");
ok(Object.values((rec[st.key] || {}).solved || {})[0] === end.redMoves,
  "★ 戰績每題分開記(" + JSON.stringify(rec) + ")");
const dones = beacons.filter((b) => b.u.includes("g=3d-xiangqi-done"));
ok(dones.length === 1 && dones.every((b) => b.s === 200), "📡 完賽打點:每局一次且伺服器收下 200(" + dones.length + " 次)", JSON.stringify(dones));
ok(!beacons.some((b) => b.s === 404), "📡 沒有任何打點被伺服器退回 404", JSON.stringify(beacons.filter((b) => b.s !== 200)));
ok(errors.length === 0, "整場零 pageerror", errors.join(" | "));

await browser.close();
console.log(`\n🔬 browser-check:${pass} 過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
