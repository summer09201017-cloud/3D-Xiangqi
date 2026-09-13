// 🔬 直向版面真瀏覽器驗收(2026-09-13 使用者拍板「獨立的直向版面」)。
// 跑法:python -m http.server 8795(另一個視窗)→ node scripts/check-portrait-layout.mjs
//      (或 CHECK_URL=線上網址 node scripts/check-portrait-layout.mjs)
//
// 守的事(每一條都是這輪改動的目的,不是憑空想的):
//   ① 直向 390×844 開一局(真點擊「玩家對戰 AI → 初級」):HUD 停在畫面**底部**、整寬;
//      3D 畫布從頂到 HUD 上緣、不重疊;棋盤四個角都投影在畫布**裡**(不是被 HUD 蓋著);
//      HUD 的鈕排成三欄、每顆 ≥ 44px 高。
//   ② 按 ▲ 收起 HUD ⇒ HUD 變矮、畫布變高、棋盤不變小(直向是寬度卡住,不會更大;fit 有重算)。
//   ③ 橫向 844×390 完全不變:HUD 還是左上角小卡(top/left < 30、寬 ≤ 380),畫布 = 整個視窗。
//   ⑤ 直向主選單本身看得全(鈕都在視窗內、卡片不比螢幕寬)+ manifest 不鎖橫式(鎖了直著拿進不到主選單)。
//   ④ 直向點棋盤要點得到:用相機把「紅方右邊的炮」投影成螢幕座標、真滑鼠點下去 ⇒ 它被選中
//      (onMouseClick 改成對畫布算 NDC 的那一條 —— 照 window 算會偏掉,點到隔壁排)。
// ★ 一律真點擊(page.click / page.mouse.click),不在 evaluate 裡呼叫 startGame。
import { chromium } from "playwright-core";

const URL = process.env.CHECK_URL || "http://localhost:8795";
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

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

/** 開頁 + 真點擊進「玩家對戰 AI → 初級」 */
const openGame = async (viewport) => {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(URL + "/?v=" + Date.now(), { waitUntil: "domcontentloaded" });
    /* ⚠ 第一次載入會裝 SW,SW 接管那一刻 app.js 的 controllerchange 會自動 reload 一次(1~3 秒後)。
         點鈕若剛好落在 reload 前後,選單狀態被重整掉、#btn-ai-easy 永遠不可見(0913 實測隨機紅)。
         ⇒ 先等「這一頁是 reload 進來的」再往下;6 秒沒等到(SW 已在 / 不支援)就放行。 */
    await page.waitForFunction(() => (performance.getEntriesByType("navigation")[0] || {}).type === "reload",
        null, { timeout: 6000 }).catch(() => {});
    await page.waitForSelector("#btn-pvai", { timeout: 10000 });
    /* ⚠ window.app 在 window.onload 才建(要等 CDN 的 three.js 載完);DOMContentLoaded 就點鈕 ⇒ 沒人接、選單不會切
         (0913 首跑就中,check-refresh 0910 全綠是運氣)。 */
    await page.waitForFunction(() => !!window.app, null, { timeout: 30000 });
    await page.click("#btn-pvai");
    await page.click("#btn-ai-easy");
    await page.waitForSelector("#game-container canvas", { timeout: 10000 });
    await page.waitForFunction(() => window.app && window.app.renderer && window.app.renderer.camera, null, { timeout: 10000 });
    await page.waitForTimeout(500);   // 讓 ResizeObserver → --hud-h → resize → fitCamera 這一串跑完
    return { page, errors };
};

/** HUD / 畫布的幾何 + 棋盤四角投影(NDC,|x|,|y| ≤ 1 = 在畫布裡) */
const geo = (page) => page.evaluate(() => {
    const hud = document.getElementById("game-info").getBoundingClientRect();
    const cv = document.querySelector("#game-container canvas").getBoundingClientRect();
    const r = window.app.renderer;
    const hx = r.BOARD_WIDTH / 2, hy = r.BOARD_HEIGHT / 2;
    const corners = [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy]].map(([x, y]) => {
        const v = new THREE.Vector3(x, y, 0).project(r.camera);
        return { x: +v.x.toFixed(3), y: +v.y.toFixed(3) };
    });
    const worst = Math.max(...corners.map((c) => Math.max(Math.abs(c.x), Math.abs(c.y))));
    const btns = [...document.querySelectorAll("#game-info .btn-row button")]
        .filter((b) => b.offsetParent !== null).map((b) => b.getBoundingClientRect());
    return {
        hud: { top: hud.top, bottom: hud.bottom, left: hud.left, width: hud.width, height: hud.height },
        cv: { top: cv.top, bottom: cv.bottom, height: cv.height, width: cv.width },
        win: { w: window.innerWidth, h: window.innerHeight },
        hudH: window.__hudLayout ? window.__hudLayout.hudH : null,
        corners, worst,
        btnRows: new Set(btns.map((b) => Math.round(b.top))).size, btnMinH: Math.min(...btns.map((b) => b.height)),
        gridCols: getComputedStyle(document.querySelector("#game-info .btn-row")).gridTemplateColumns,
    };
});

console.log("\n── ① 直向:HUD 在底部整寬、畫布在它上面、棋盤整張在畫布裡 ──");
{
    const { page, errors } = await openGame(PORTRAIT);
    const g = await geo(page);
    ok(Math.abs(g.hud.bottom - g.win.h) <= 2, "★ HUD 貼著畫面底部", JSON.stringify(g.hud));
    ok(g.hud.width >= g.win.w - 2 && g.hud.left <= 1, "★ HUD 整寬(不是左上角小卡)", JSON.stringify(g.hud));
    ok(g.cv.top <= 1, "畫布從畫面頂端開始", JSON.stringify(g.cv));
    ok(g.cv.bottom <= g.hud.top + 1, "★★ 畫布底緣 ≤ HUD 頂緣(不重疊,HUD 不蓋棋盤)", JSON.stringify({ cv: g.cv, hud: g.hud }));
    ok(Math.abs(g.cv.height - (g.win.h - g.hud.height)) <= 3, "★ 畫布高 = 視窗高 − HUD 高(--hud-h 真的寫進去了)", JSON.stringify({ cvH: g.cv.height, winH: g.win.h, hudH: g.hud.height, var: g.hudH }));
    ok(g.worst <= 1.0, `★★ 棋盤四個角都投影在畫布裡(最外 ${(g.worst * 100).toFixed(1)}%)—— fitCamera 照容器算了`, JSON.stringify(g.corners));
    ok(g.worst >= 0.8, "★ 而且沒有退太遠(至少佔滿 80%)", String(g.worst));
    ok(/^(\S+\s+){2}\S+$/.test(g.gridCols.trim()), "★ 鈕排成三欄 grid", g.gridCols);
    ok(g.btnMinH >= 44, `★ 每顆鈕 ≥ 44px 高(量到最矮 ${g.btnMinH.toFixed(0)}px)`, String(g.btnMinH));

    console.log("\n── ② 按 ▲ 收起 HUD ⇒ 畫布變高、棋盤放大 ──");
    const cvH0 = g.cv.height, hudH0 = g.hud.height;
    const spanBefore = Math.abs(g.corners[0].y - g.corners[2].y);
    await page.click("#btn-hud-fold");
    await page.waitForFunction((h0) => document.querySelector("#game-container canvas").getBoundingClientRect().height > h0 + 20, cvH0, { timeout: 5000 })
        .then(() => ok(true, "★ 收起後畫布變高"))
        .catch(() => ok(false, "★ 收起後畫布變高", "5 秒內畫布高度沒變"));
    await page.waitForTimeout(400);
    const g2 = await geo(page);
    ok(g2.hud.height < hudH0 - 20, `★ HUD 真的變矮(${hudH0.toFixed(0)} → ${g2.hud.height.toFixed(0)}px)`);
    ok(g2.cv.bottom <= g2.hud.top + 1 && g2.worst <= 1.0, "★ 收起後仍然不重疊、棋盤整張在畫布裡", JSON.stringify({ cv: g2.cv, hud: g2.hud, worst: g2.worst }));
    /* ⚠ 直向的 fit 是「寬度卡住」:畫布再高棋盤也不會更大(寬已經填滿),多出來的高是空白。
         第一版斷言「收起後棋盤變大」就是搞錯這一點(272→271px,一樣大)—— 收起的好處是**把控制列從棋盤旁邊拿開**,
         不是放大。這裡守「不變小」就對了(變小才是 fit 壞了)。 */
    const spanAfter = Math.abs(g2.corners[0].y - g2.corners[2].y);
    ok(spanAfter * g2.cv.height >= spanBefore * cvH0 - 3, "★ 收起後棋盤沒有變小(直向是寬度卡住,本來就不會再大)", `${(spanBefore * cvH0 / 2).toFixed(0)} → ${(spanAfter * g2.cv.height / 2).toFixed(0)}px`);
    // 收合狀態記在 localStorage;下面 ④ 要點棋子,先展開回來免得影響版面判讀
    await page.click("#btn-hud-fold");
    await page.waitForTimeout(400);

    console.log("\n── ④ 直向真點擊棋子要選得到(NDC 對畫布算,不對 window 算)──");
    {
        /* 紅方右邊的炮:本站座標 board[row][col],紅在 row 0~4 ⇒ 紅炮在 (2,7)(和 hint 測試同一顆) */
        const pos = await page.evaluate(() => {
            const r = window.app.renderer;
            const p = r.getGridPosition(2, 7);
            const v = new THREE.Vector3(p.x, p.y, r.PIECE_HEIGHT / 2 + 0.1).project(r.camera);
            const rect = r.renderer.domElement.getBoundingClientRect();
            return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
        });
        ok(pos && pos.y > 0 && pos.y < g.hud.top, "算得出紅炮的螢幕座標,而且它在畫布裡(不在 HUD 底下)", JSON.stringify(pos));
        await page.mouse.click(pos.x, pos.y);
        await page.waitForTimeout(300);
        const sel = await page.evaluate(() => window.app.gameLogic.selectedPiece);
        ok(sel && sel.row === 2 && sel.col === 7, "★★ 真滑鼠點下去,選中的就是那顆炮(點擊座標沒有偏到隔壁排)", JSON.stringify(sel));
    }
    ok(errors.length === 0, "直向整段零 pageerror", errors.join(" | "));
    await page.close();
}

console.log("\n── ③ 橫向完全不變:HUD 還是左上角小卡、畫布 = 整個視窗 ──");
{
    const { page, errors } = await openGame(LANDSCAPE);
    const g = await geo(page);
    ok(g.hud.top < 30 && g.hud.left < 30, "HUD 在左上角", JSON.stringify(g.hud));
    ok(g.hud.width <= 380, "HUD 是小卡(寬 ≤ 380)", JSON.stringify(g.hud));
    ok(Math.abs(g.cv.height - g.win.h) <= 2 && Math.abs(g.cv.width - g.win.w) <= 2, "★ 畫布 = 整個視窗(--hud-h 是 0)", JSON.stringify({ cv: g.cv, win: g.win, hudH: g.hudH }));
    ok(g.hudH === 0, "--hud-h 在橫向寫 0", String(g.hudH));
    ok(g.worst <= 1.0, "棋盤整張在畫布裡", String(g.worst));
    ok(errors.length === 0, "橫向整段零 pageerror", errors.join(" | "));
    await page.close();
}

console.log("\n── ⑤ 直向主選單本身要進得去、看得全(0913 使用者:「手機直式時也想要有主選單」)──");
{
    /* 真因是 manifest 鎖橫式(裝成 App 直著拿被強制轉橫),不是選單版面;但既然解鎖了,直向的主選單
       也要真的看得全:每顆鈕都在視窗內、卡片沒有比螢幕寬(390 是最常見的窄邊)。 */
    const page = await browser.newPage({ viewport: PORTRAIT });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(URL + "/?v=" + Date.now(), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (performance.getEntriesByType("navigation")[0] || {}).type === "reload",
        null, { timeout: 6000 }).catch(() => {});
    await page.waitForFunction(() => !!window.app, null, { timeout: 30000 });
    const menu = await page.evaluate(() => {
        const panel = document.getElementById("main-menu").getBoundingClientRect();
        const btns = [...document.querySelectorAll("#main-menu > button")]
            .filter((b) => b.offsetParent !== null)
            .map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; });
        return { panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom, width: panel.width },
            btns, win: { w: window.innerWidth, h: window.innerHeight }, scrollW: document.documentElement.scrollWidth };
    });
    ok(menu.btns.length >= 4, `主選單有 ${menu.btns.length} 顆看得見的鈕`, JSON.stringify(menu.btns.map((b) => b.id)));
    ok(menu.panel.width <= menu.win.w && menu.panel.left >= -1 && menu.panel.right <= menu.win.w + 1,
        "★ 直向主選單卡片沒有比螢幕寬", JSON.stringify(menu.panel));
    ok(menu.btns.every((b) => b.top >= 0 && b.bottom <= menu.win.h + 1),
        "★★ 鈕全部在視窗內(不用捲就看得到、按得到)", JSON.stringify(menu.btns));
    ok(menu.btns.every((b) => b.h >= 40), "每顆鈕 ≥ 40px 高", JSON.stringify(menu.btns.map((b) => b.h)));
    ok(menu.scrollW <= menu.win.w, "頁面沒有橫向溢出", String(menu.scrollW));
    /* manifest 不鎖橫式:CHECK_URL=線上 跑時這條就是在驗線上那份 manifest */
    const man = await page.evaluate(async () => {
        try { const r = await fetch("manifest.json?v=" + Date.now(), { cache: "no-store" }); return await r.json(); } catch (e) { return { error: String(e) }; }
    });
    ok(man && man.orientation !== "landscape" && man.orientation !== "landscape-primary",
        `★★ manifest 沒鎖橫式(orientation=${JSON.stringify(man && man.orientation)})—— 鎖了直著拿就進不到主選單`, JSON.stringify(man && (man.error || man.orientation)));
    ok(errors.length === 0, "直向主選單零 pageerror", errors.join(" | "));
    await page.close();
}

await browser.close();
console.log("\n" + (fail === 0 ? "🟢" : "🔴") + ` portrait-layout:${pass} 過 / ${fail} 失敗\n`);
process.exit(fail === 0 ? 0 : 1);
