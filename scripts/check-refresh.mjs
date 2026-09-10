// 🔬 🔄 更新鈕真瀏覽器驗收(2026-09-10 使用者:「選單也沒有更新鈕」)。
// 跑法:python -m http.server 8795(另一個視窗)→ node scripts/check-refresh.mjs
//      (或 CHECK_URL=線上網址 node scripts/check-refresh.mjs)
//
// 守三件:①主選單看得到「🔄 更新」②下棋中的 HUD 也看得到(換頁不會漏掉)
//        ③按下去真的呼叫了 registration.update()(不是擺好看,沒接線一樣過不了①②)。
// ★ 一律真滑鼠 page.click —— 理由同 browser-check.mjs 檔頭那句。
import { chromium } from "playwright-core";

const URL = process.env.CHECK_URL || "http://localhost:8795";

let browser = null;
for (const channel of ["msedge", "chrome"]) {
    try { browser = await chromium.launch({ channel, headless: true }); break; }
    catch { /* 換下一個 channel */ }
}
if (!browser) { console.error("找不到系統 Edge/Chrome"); process.exitCode = 1; }

let pass = 0, fail = 0;
const ok = (cond, msg, note = "") => {
    if (cond) { pass++; console.log("  ✓ " + msg); }
    else { fail++; console.error("  ✗ " + msg + (note ? " → " + note : "")); }
};

const page = await browser.newPage();
await page.goto(URL + "?v=" + Date.now(), { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => "serviceWorker" in navigator, null, { timeout: 10000 }).catch(() => {});

console.log("\n── ① 主選單 ──");
const menuBtn = page.locator("#btn-refresh");
ok(await menuBtn.count() > 0, "「🔄 更新」鈕在主選單裡");
const box = await menuBtn.boundingBox();
ok(box !== null && box.height > 0, "★ 真的看得見、按得到(有實際大小)", box ? JSON.stringify(box) : "沒有版面(可能被 hidden 蓋住)");

console.log("\n── ② 下棋中的 HUD ──");
await page.click("#btn-pvai");
await page.click("#btn-ai-easy");
await page.waitForSelector("#game-info:not(.hidden)", { timeout: 10000 });
const gameBtn = page.locator("#btn-refresh-game");
ok(await gameBtn.count() > 0, "「🔄 更新」鈕在下棋中的 HUD 裡");
ok((await gameBtn.boundingBox())?.height > 0, "★ 下棋中也按得到");

console.log("\n── ③ 按下去真的問了 SW 有沒有新版 ──");
// 攔截 registration.update():真的接了線,呼叫一次就會被記到 window.__updateCalled。
await page.evaluate(() => new Promise((resolve) => {
    const wait = () => navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return setTimeout(wait, 100);
        window.__updateCalled = 0;
        const orig = reg.update.bind(reg);
        reg.update = (...a) => { window.__updateCalled++; return orig(...a); };
        resolve();
    });
    wait();
}));
await page.click("#btn-refresh-game");
// forceRefresh 裡會 reload,攔截前先確認 update 真的被呼叫過(reload 前的那一刻)。
await page.waitForFunction(() => window.__updateCalled > 0, null, { timeout: 5000 })
    .then(() => ok(true, "★★ 按下去真的呼叫了 registration.update()(不是純裝飾的鈕)"))
    .catch(() => ok(false, "★★ 按下去真的呼叫了 registration.update()", "沒被呼叫到,鈕可能沒接線或選錯 id"));

await browser.close();
console.log("\n" + (fail === 0 ? "🟢" : "🔴") + ` refresh:${pass} 過 / ${fail} 失敗\n`);
process.exit(fail === 0 ? 0 : 1);
