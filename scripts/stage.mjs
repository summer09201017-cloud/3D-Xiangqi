/* 產出乾淨的部署包 .deploy/(給 wrangler pages deploy 用)。
   跑法:npm run stage

   為什麼要有這一步(2026-09-08 使用者拍板「現在順手做掉」):
   `wrangler pages deploy <dir>` **沒有忽略檔機制** —— 目錄裡有什麼就傳什麼。
   本站原本是 `wrangler pages deploy .`(整個資料夾照原樣搬上去),結果
   CLAUDE.md / package.json / test/*.mjs / scripts/*.mjs 全都在線上拿得到真內容。
   ★ 那**不是**密鑰外洩(.env 沒進版控、repo 在 GitHub 本來就公開),真正的兩個理由是:
     ① 內部筆記(寫著「病根」「踩過的坑」「使用者退件」)可能被搜尋引擎收錄,
        老師搜遊戲名搜到的是它,不是遊戲;
     ② 「預設全部都上」這件事本身是留給未來的坑 —— 哪天有人在這個資料夾放一份草稿、
        一個備份、一張還沒想清楚要不要公開的圖,它會**自動變成公開網址而且沒有人會發現**。
   ⇒ 改成白名單:只有 SHIP 裡列的東西會上線(姊妹站 xiangqi-arena 與 chess5 早就是這樣)。

   ⚠⚠ 0908 實際踩過、寫下來免得下一手再試一次:
   **`.assetsignore` 對 `pages deploy` 完全無效。** 我先加了一份 `.assetsignore`
   列出不要上線的檔,部署之後上傳檔數從 24 變成 **25**(多的那個就是 `.assetsignore` 自己),
   CLAUDE.md / package.json / test/sw.mjs 一個都沒少。
   —— 而姊妹站 xiangqi-arena 的 `scripts/stage.mjs` 檔頭**早就寫過這一條**(manual-deploy-map 有實錄),
      我沒先讀就自己試了一輪。`.assetsignore` 是 Workers `--assets` 的機制,Pages 不吃。

   ⚠ 驗收要**看內容**,不要看狀態碼:這站找不到的路徑一律回首頁(HTTP 200,約 14 KB),
     所以「回 200」證明不了檔案在不在(0908 我自己就這樣判錯過一次,把兩個其實沒上去的檔說成上去了)。
     驗法:`curl -s <url> | head -c 60` 看拿到的是真內容還是首頁的 <!DOCTYPE html>。

   ★ 刻意**不做**成 `npm run deploy` 把 wrangler 包進去(沿用 xiangqi-arena 的理由):
     那樣守門 hook 看到的只是 `npm run deploy`,解析不到部署目錄 ⇒ 掃不到、等於關掉守門。
     部署那一行永遠明寫出來。 */
import { cp, rm, mkdir, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".deploy");

/* 只有這些會上線。
   ★ 這份清單 = service-worker.js 的 ASSETS_TO_CACHE(本機那幾項),少一個離線就壞。
     新增要上線的檔案時,**兩邊都要補**。 */
const SHIP = ["index.html", "manifest.json", "service-worker.js", "css", "js", "img"];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of SHIP) {
  await cp(path.join(root, item), path.join(out, item), { recursive: true });
}

/* 🔒 白名單漏一個檔的下場是「線上少一支 js,而且離線整站壞掉」——
   而 SW 的 install 現在是逐一 add + catch(v15 起),抓不到的**靜默略過**,
   所以漏檔不會有任何錯誤訊息。⇒ 這裡拿 service-worker.js 的清單回頭對賬。
   (chess5 的 stage 也有同一道:「SW CORE_ASSETS 15 項全部到齊」。) */
const swSrc = await readFile(path.join(root, "service-worker.js"), "utf8");
const block = (swSrc.match(/ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\]/) || [])[1] || "";
const wanted = [...block.matchAll(/['"]([^'"]+)['"]/g)]
  .map((m) => m[1])
  .filter((u) => !/^https?:/.test(u))          // CDN 的不在部署包裡
  .map((u) => u.replace(/^\.\//, ""))
  .map((u) => (u === "" ? "index.html" : u));  // './' = 首頁
const missing = [];
for (const rel of wanted) {
  if (!existsSync(path.join(out, rel))) missing.push(rel);
}
if (missing.length) {
  console.error(`🔴 SW 要快取但 .deploy/ 裡沒有:${missing.join(" / ")}`);
  console.error("   ⇒ 把它加進上面的 SHIP(或從 service-worker.js 的清單移除)。離線會壞,而且不會報錯。");
  process.exit(1);
}

const listed = await readdir(out);
console.log(`✅ .deploy/ 已備妥:${listed.join(" / ")}(SW 清單 ${wanted.length} 項全部到齊)`);
console.log("\n部署(⚠ 一定要 --branch main,否則只建 preview、正式網址不動):");
console.log("  npx wrangler pages deploy .deploy --project-name=3d-xiangqi --branch main --commit-dirty=true");
