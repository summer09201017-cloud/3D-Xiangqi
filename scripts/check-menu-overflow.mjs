// 🔬 主選單在矮螢幕不會把版本/簡歷推出畫面外(2026-09-10 使用者:「版本號與簡歷被遮住了」)。
// 跑法:python -m http.server 8795(另一個視窗)→ node scripts/check-menu-overflow.mjs
//      (或 CHECK_URL=線上網址 node scripts/check-menu-overflow.mjs)
//
// 由來:#ui-layer 是 100vh 置中的 flex,.panel 過去沒有 max-height/overflow ——
// 手機瀏覽器扣掉網址列的實際可用高度比 100vh 小,卡片內容一旦比可用高度高,
// 置中的卡會上下都超出畫面且**沒有捲軸**,超出的那截(常是版本/簡歷)直接看不到也捲不到。
// 這裡故意把視窗壓得比選單自然高度矮(390×560),模擬「手機瀏覽器扣掉網址列」,
// 驗「捲得到版本簡歷」而不是只驗「畫得出來」——那條在正常視窗高度下永遠是綠的。
import { chromium } from "playwright-core";

const URL = process.env.CHECK_URL || "http://localhost:8795";
const SHORT_VIEWPORT = { width: 390, height: 420 };   // 比主選單自然高度矮,逼出溢位

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

const page = await browser.newPage({ viewport: SHORT_VIEWPORT });
await page.goto(URL + "?v=" + Date.now(), { waitUntil: "domcontentloaded" });
await page.waitForSelector("#main-menu", { timeout: 10000 });

const overflow = await page.locator("#main-menu").evaluate((el) => ({
    scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
}));
ok(overflow.overflowY === "auto" || overflow.overflowY === "scroll",
    "#main-menu 的 overflow-y 是 auto/scroll(不是 visible 讓內容溢出)", overflow.overflowY);
ok(overflow.scrollHeight > overflow.clientHeight,
    "★ 這個視窗高度下,主選單內容真的比看得到的區域高(逼出了溢位,不是白測)",
    `scrollHeight=${overflow.scrollHeight} clientHeight=${overflow.clientHeight}`);

// 版本簡歷 <summary> 一開始是不是在可視區域內(沒捲動的狀態)
const before = await page.locator("#main-menu .ver-fold summary").boundingBox();
/* 判「看得見」用文字那一行的**頂緣**有沒有進到可視範圍——不要求整條到底緣都不越界,
   捲到底時最後一截是 `.panel` 30px 的底部 padding,行高本身可能被那截無意義的留白多算進去。
   只要這一行開始被看到,使用者就讀得到內容,那才是「拿不到」與「拿得到」的真正分界。 */
const viewportOk = (box) => box && box.y >= 0 && box.y < SHORT_VIEWPORT.height;

// 把主選單捲到底,版本簡歷這時應該完全進入可視區域內
await page.locator("#main-menu").evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(200);
const after = await page.locator("#main-menu .ver-fold summary").boundingBox();
ok(viewportOk(after),
    "★★ 捲到底之後,「版本 vN…」那一行真的進到看得見的範圍內(捲得到,不是永遠躲在畫面外)",
    after ? JSON.stringify(after) : "抓不到位置");

// 順手確認:捲動前如果本來就看不到(這個矮視窗下預期看不到),證明剛才真的是「捲了才看到」
if (!viewportOk(before)) {
    ok(true, "（附帶確認）捲動前版本簡歷確實在可視區域外 —— 上面那條紅燈才有意義", "");
}

await browser.close();
console.log("\n" + (fail === 0 ? "🟢" : "🔴") + ` menu-overflow:${pass} 過 / ${fail} 失敗\n`);
process.exit(fail === 0 ? 0 : 1);
