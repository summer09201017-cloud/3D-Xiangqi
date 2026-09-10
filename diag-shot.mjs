import { chromium } from "playwright-core";
let browser = null;
for (const channel of ["msedge", "chrome"]) {
  try { browser = await chromium.launch({ channel, headless: true }); break; } catch {}
}
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
await page.goto("http://localhost:8795/?v=" + Date.now(), { waitUntil: "domcontentloaded" });
await page.click("#btn-pvai");
await page.click("#btn-ai-easy");
await page.waitForTimeout(1200);
await page.screenshot({ path: "C:/Users/agape250/AppData/Local/Temp/claude/C--Users-agape250-Downloads-0910--0910-/464d1797-ad8c-47d5-aad8-52edfe0f470a/scratchpad/xiangqi-landscape.png" });
await browser.close();
