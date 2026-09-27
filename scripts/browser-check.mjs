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

/* 🎥 視角工具列(2026-09-20 六款 3D 棋類統一):三段預設 + 兩條滑桿 + 換邊 + 重置都要真的在畫面上、真的按得到。
   ★ 用真點擊(不是 evaluate 呼叫 kit.flip()):鈕被蓋住/收在 details 裡按不到這種病才抓得到。 */
await page.evaluate(() => { const f = document.getElementById("view-kit-fold"); if (f) f.open = true; });
ok(await page.locator("[data-vk-view]").count() === 3, "🎥 視角工具列有三顆預設鈕(斜俯視/正俯視/對局視角)");
const readVk = () => page.evaluate(() => ({
  yaw: document.querySelector('[data-vk-range="yaw"]').value,
  pitch: document.querySelector('[data-vk-range="pitch"]').value,
  flatPressed: document.querySelector('[data-vk-view="flat"]').getAttribute("aria-pressed"),
}));
const vk0 = await readVk();
ok(vk0.yaw === "0" && Math.abs(Number(vk0.pitch) - 56) <= 2, "開場:水平旋轉 0°、俯視角度 ≈ 56°(INITIAL_CAM 的 atan(90/60))", JSON.stringify(vk0));
await page.click("[data-vk-flip]");
await page.waitForTimeout(700);
const vk1 = await readVk();
ok(vk1.yaw === "180", "按 🔃 換邊 ⇒ 水平旋轉滑桿變 180°", JSON.stringify(vk1));
await page.click('[data-vk-view="flat"]');
await page.waitForTimeout(700);
const vk2 = await readVk();
ok(vk2.pitch === "88" && vk2.flatPressed === "true", "按「正俯視」⇒ 俯視角度 88°、那顆鈕亮起", JSON.stringify(vk2));
await page.click("[data-vk-reset]");
await page.waitForTimeout(400);
const vk3 = await readVk();
ok(vk3.yaw === "0" && Math.abs(Number(vk3.pitch) - 56) <= 2, "按 🎯 重置視角 ⇒ 回到 0° / ≈56°", JSON.stringify(vk3));
ok(await page.locator("#btn-camera").count() === 0, "舊的 #btn-camera 已拆掉(重置併進工具列)");

/* 紅方照 💡 提示走(與真手指同一條 handleSquareClick 管線),黑方由遊戲自己回。
   ★★ 2026-09-08 改用「提示」而不是 calculateBestMove(red,'hard'),兩個理由:
     ① 舊寫法**本來就會隨機紅**:hard 檔有 tieRandom(同分的手裡隨機挑),
        node 實測從這一題開打「紅 hard vs 黑 hard」六局只贏 2~4 局 ——
        也就是說這條斷言過不過一直是碰運氣的,只是以前運氣好。
     ② 這一題是 3 手殺的殘局,使用者真正在做的事是「按提示、照它走」
        (0908 退件原話:「我按照 AI 提示去走,結果車九被將吃了」)。
        ⇒ 要守的就是**照提示走一定在規定手數內解掉**,不是「電腦自己打得贏嗎」。
   ⇒ 現在是確定性的:提示會窮舉出必勝殺法,黑方怎麼應都躲不掉。 */
const end = await page.evaluate(async () => {
  const a = window.app;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const hints = [];
  for (let i = 0; i < 60 && !a.gameLogic.isGameOver; i++) {
    if (a.gameLogic.currentPlayer !== "red") { await sleep(150); continue; }
    const res = a.ai.hintMove(a.gameLogic.getBoardState(), "red", {
      puzzle: a.gameMode === "daily",
      rootFilter: (m) => a.gameLogic.isValidMove(m.from.row, m.from.col, m.to.row, m.to.col),
    });
    const mv = res && res.move;
    if (!mv) break;
    hints.push(res.kind + (res.mateIn ? res.mateIn : ""));
    a.handleSquareClick(mv.from.row, mv.from.col);
    a.handleSquareClick(mv.to.row, mv.to.col);
    await sleep(700);
  }
  await sleep(1600);   // 等最後一手的動畫回呼把結算開出來
  return { winner: a.gameLogic.winner, redMoves: a.redMoves, hints,
    mateIn: a.daily && a.daily.puzzle ? a.daily.puzzle.mateIn : null,
    winText: document.getElementById("winner-text").innerText,
    overlay: !document.getElementById("game-over-menu").classList.contains("hidden"),
    store: localStorage.getItem("xiangqi-daily-v1") };
});
ok(end.winner === "red", "★ 照 💡 提示走,紅方贏了今天的題(用了 " + end.redMoves + " 步)", JSON.stringify(end));
ok(end.mateIn != null && end.redMoves <= end.mateIn,
  `★★ 照提示走在規定手數內解掉:${end.redMoves} 步 ≤ 標示的 ${end.mateIn} 手`
  + `(退件那一局是 mateIn 3 的題「已走 7 步」還在走)`, JSON.stringify(end.hints));
ok(end.hints.length > 0 && end.hints.every((k) => k.startsWith("mate")),
  "★ 每一手提示都講得出「N 手必勝」(不是拿位置分硬猜一手)", end.hints.join(","));
ok(end.overlay && end.winText.includes("題完成") && end.winText.includes("今天已解"),
  "結算畫面開了、帶今天進度", end.winText);
ok(end.winText.includes("新紀錄"), "第一次打=顯示「新紀錄!」(閂鎖沒讓第二次觸發蓋掉)", end.winText);
const rec = JSON.parse(end.store || "{}");
ok(Object.values((rec[st.key] || {}).solved || {})[0] === end.redMoves,
  "★ 戰績每題分開記(" + JSON.stringify(rec) + ")");
const dones = beacons.filter((b) => b.u.includes("g=3d-xiangqi-done"));
ok(dones.length === 1 && dones.every((b) => b.s === 200), "📡 完賽打點:每局一次且伺服器收下 200(" + dones.length + " 次)", JSON.stringify(dones));
ok(!beacons.some((b) => b.s === 404), "📡 沒有任何打點被伺服器退回 404", JSON.stringify(beacons.filter((b) => b.s !== 200)));

/* ══════ 🐾 動物對手(2026-09-28,skill animal-opponent-kit 第六個活例;照 gomoku3d smoke ⑩ 段)══════
   檔案側對賬 → 真點擊開一局中級 → 坐對面 / 鐵則遍歷 / 頭在畫面裡 / 凳子落地 / HUD 帶臉 / 臉沒被 HUD 蓋到(桌機・手機橫向・直向)
   → 讓位縮盤 ≤ 25% → 走一手等牠回手(figs.log 有 think + place)→ 姿勢手動推時間(無頭 fps 低,等真實秒數等不到)
   → 🔃 換邊仍坐對面 → 三段開關 → pvp 不坐 → 人聲 runtime → 每日 = 🦉。
   ★ 這一站的世界是 Z-up:pos 回世界 XY,相機在 -Y 時牠在 +Y(黑方那一側)。 */
console.log("—— 🐾 動物對手 ——");
{
  const fs = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const { VOICE_FILES } = await import(pathToFileURL(join(root, "js", "voicePhrases.js")).href);
  const vdir = join(root, "voice");
  const mp3 = fs.existsSync(vdir) ? fs.readdirSync(vdir).filter((f) => f.endsWith(".mp3")).sort() : [];
  const want = [...VOICE_FILES].sort();
  ok(mp3.join() === want.join(), `🗣 voice/ 有 ${mp3.length} 支 mp3,跟詞庫 ${want.length} 句一一對應`);
  const sw = fs.readFileSync(join(root, "service-worker.js"), "utf8");
  const missing = mp3.filter((f) => !sw.includes(`"./voice/${f}"`));
  ok(missing.length === 0 && sw.includes('"./voice/manifest.json"'), `🗣 service-worker.js 清單含 manifest + 每支 mp3(gen-voice 照目錄重生)${missing.length ? ":漏 " + missing.join(",") : ""}`);
  let manifestOk = false;
  try { const mf = JSON.parse(fs.readFileSync(join(vdir, "manifest.json"), "utf8")); manifestOk = mp3.length > 0 && mp3.every((f) => mf[f.replace(/\.mp3$/, "")] === "voice/" + f); } catch { /* 沒烤 */ }
  ok(manifestOk, "🗣 manifest.json 的鍵值跟目錄一致");
  const tiny = mp3.filter((f) => fs.statSync(join(vdir, f)).size < 2048);
  ok(tiny.length === 0, `🗣 每支 mp3 > 2KB(空檔 = 烤失敗)${tiny.length ? ":" + tiny.join(",") : ""}`);
  const webSpeech = fs.readdirSync(join(root, "js")).filter((f) => f.endsWith(".js") && fs.readFileSync(join(root, "js", f), "utf8").includes("speech" + "Synthesis"));
  ok(webSpeech.length === 0, `🗣 js/ 裡沒有 Web Speech 機器聲${webSpeech.length ? ":" + webSpeech.join(",") : ""}`);
  /* 引擎三支要跟 skill 那份逐位元相同(改了 skill 要 cp 回來、不在站裡改);沒裝 skill 的機器略過 */
  const kit = join(process.env.USERPROFILE || process.env.HOME || "", ".claude", "skills", "animal-opponent-kit", "assets");
  if (fs.existsSync(kit)) {
    const drift = [["animals.js", "animals.js"], ["voice.js", "voice.js"], ["three-shim.js", "three-global-shim.js"]]
      .filter(([site, asset]) => fs.readFileSync(join(root, "js", site), "utf8") !== fs.readFileSync(join(kit, asset), "utf8")).map(([site]) => site);
    ok(drift.length === 0, `🐾 引擎三支與 skill 同一份${drift.length ? ":漂移 " + drift.join(",") : ""}`);
  }
}
await page.setViewportSize({ width: 1000, height: 720 });
await page.click("#btn-back-to-main");
await page.waitForTimeout(300);
await page.click("#btn-pvai");
await page.click('#pet-row [data-pet="voice"]');
ok(await page.locator('#pet-row .pet-opt[aria-pressed="true"]').getAttribute("data-pet") === "voice", "🐾 難度選單有三段動物開關,按了會亮");
await page.click("#btn-ai-medium");
await page.waitForFunction(() => window.app.gameMode === "pvai" && window.app.opponent && window.app.opponent.kind === "cat", null, { timeout: 5000 });
await page.waitForTimeout(400);
const pet0 = await page.evaluate(() => {
  const O = window.app.opponent, f = O.figure;
  let neck = 0, eyes = 0, ears = 0, brows = 0, mouth = 0;
  f.group.traverse((o) => { if (o.userData.neck) neck++; if (o.userData.eye) eyes++; if (o.userData.ear) ears++; if (o.userData.brow) brows++; if (o.userData.mouth) mouth++; });
  return { ...O.probe(), neck, eyes, ears, brows, mouth, petName: document.getElementById("pet-name").textContent,
    petLineShown: !document.getElementById("pet-line").classList.contains("hidden"), petOn: document.body.classList.contains("pet-on"), capsule: !!window.THREE.CapsuleGeometry };
});
ok(pet0.figure && pet0.visible && pet0.kind === "cat" && pet0.pos.y > 0, `🐾 中級 ⇒ 🐱 橘貓坐在對面(黑方那一側,世界 ${JSON.stringify(pet0.pos)},scale ${pet0.scale})`);
ok(pet0.capsule, "🐾 three-shim 補上了 r128 沒有的 CapsuleGeometry");
ok(pet0.neck === 1 && pet0.eyes === 2 && pet0.ears === 2 && pet0.brows === 2 && pet0.mouth === 1, "🐾 人物鐵則遍歷:脖子 1、眼 2、耳 2、眉 2、嘴 1");
ok(pet0.head.inside, `🐾 桌機:頭頂在畫面裡(NDC ${pet0.head.x}, ${pet0.head.y})`);
ok(pet0.stoolZ <= pet0.floorZ + 0.05, `🐾 凳子不懸空(凳底 z ${pet0.stoolZ} ≤ 板底 ${pet0.floorZ})`);
ok(pet0.petLineShown && /^🐱/.test(pet0.petName) && pet0.petOn, `🐾 HUD 對手名字帶動物(${pet0.petName})、body.pet-on`);
const hudHits = (box) => [...document.querySelectorAll("#game-info, #mfsFull")].filter((el) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && !(r.right < box.l || r.left > box.r || r.bottom < box.t || r.top > box.b);
}).map((el) => el.id);
const faceAt = () => page.evaluate((fn) => { const hits = eval(fn); const p = window.app.opponent.probe(); return { box: p.headBox, head: p.head, hits: hits(p.headBox) }; }, `(${hudHits.toString()})`);
const faceDesk = await faceAt();
ok(faceDesk.hits.length === 0, `🐾 桌機:牠的臉沒被 HUD 蓋到(頭框 ${JSON.stringify(faceDesk.box)}${faceDesk.hits.length ? ";蓋到 " + faceDesk.hits.join(",") : ""})`);
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(500);
const faceLand = await faceAt();
ok(faceLand.head.inside && faceLand.hits.length === 0, `🐾 手機橫向:頭在畫面裡(${faceLand.head.x}, ${faceLand.head.y})、臉沒被 HUD 蓋到${faceLand.hits.length ? ":" + faceLand.hits.join(",") : ""}`);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
const facePort = await faceAt();
ok(facePort.head.inside, `🐾 手機直向:頭在畫面裡(${facePort.head.x}, ${facePort.head.y})`);
await page.setViewportSize({ width: 1000, height: 720 });
await page.waitForTimeout(500);
const shrink = await page.evaluate(() => {
  const r = window.app.renderer;
  const px = (row, col) => { const g = r.getGridPosition(row, col); const v = new THREE.Vector3(g.x, g.y, 0).project(r.camera); const { w, h } = r.viewSize(); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; };
  const width = () => { const a = px(0, 0), b = px(0, 8); return Math.hypot(b.x - a.x, b.y - a.y); };
  const on = width();
  window.app.opponent.setMode("off"); const off = width();
  window.app.opponent.setMode("voice");
  return { on: Math.round(on), off: Math.round(off), ratio: +(on / off).toFixed(3) };
});
ok(shrink.ratio >= 0.75 && shrink.ratio <= 1.0001, `🐾 為牠讓位但棋盤最多縮 25%(開 ${shrink.on}px / 關 ${shrink.off}px = ${shrink.ratio})`);
/* 走一手(紅炮二平五)等牠回手:think 在牠開算時、place 在牠落子後 —— 看 figs.log,不是 grep 程式碼 */
const moved = await page.evaluate(async () => {
  const a = window.app;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  a.handleSquareClick(2, 1); a.handleSquareClick(2, 4);
  for (let i = 0; i < 60 && !(a.gameLogic.currentPlayer === "red" && a.opponent.figs.log.some((e) => e.kind === "place")); i++) await sleep(250);
  await sleep(200);
  return { turn: a.gameLogic.currentPlayer, log: a.opponent.figs.log.map((e) => e.kind), focus: !!a._focus };
});
ok(moved.turn === "red" && moved.log.includes("think") && moved.log.includes("place") && moved.focus, `🐾 事件真的接到(figs.log):${moved.log.join(",")}`);
const pose = await page.evaluate(() => {
  const O = window.app.opponent, f = O.figure, F = O.figs;
  const said = []; const o = O.voice.say.bind(O.voice); O.voice.say = (a, e, d) => { said.push(a + ":" + e); return o(a, e, d); };
  O.react("win", "win"); F.update(0.4);
  const up = { armL: +f.arms[0].rotation.x.toFixed(2), armR: +f.arms[1].rotation.x.toFixed(2), open: f.mouthOpen.visible };
  F.update(3.5); F.update(0.5);
  const back = { armL: +f.arms[0].rotation.x.toFixed(2), smile: f.smile.visible };
  O.react("lose", "lose"); F.update(0.4);
  const sad = { pitch: +f.head.rotation.x.toFixed(2), smileZ: +f.smile.rotation.z.toFixed(2) };
  F.update(3.5); F.update(0.5);
  O.react("think", null); F.update(0.4);
  const think = { armR: +f.arms[1].rotation.x.toFixed(2), tilt: +f.head.rotation.z.toFixed(2) };
  O.cancel(); F.update(1);
  O.voice.say = o;
  return { up, back, sad, think, said };
});
ok(pose.up.armL < -2.2 && pose.up.armR < -2.2 && pose.up.open, `🐾 win:雙手高舉 + 張嘴(${JSON.stringify(pose.up)})`);
ok(Math.abs(pose.back.armL + 1.2) < 0.15 && pose.back.smile, `🐾 反應完回休息姿勢、笑臉回來(${JSON.stringify(pose.back)})`);
ok(pose.sad.pitch > 0.3 && pose.sad.smileZ < 1.6, `🐾 lose:低頭 + 苦臉(${JSON.stringify(pose.sad)})`);
ok(pose.think.armR < -1.9 && pose.think.tilt < -0.05, `🐾 think:手托腮、頭歪(${JSON.stringify(pose.think)})`);
ok(pose.said.join(" ") === "cat:win cat:lose", `🗣 同一個入口也叫了人聲:${pose.said.join(" ")}`);
/* 🔃 換邊(真的按工具列那顆):相機轉到 +Y 那側 ⇒ 牠要坐到 -Y(還是你對面),頭還在畫面裡 */
await page.evaluate(() => { const f = document.getElementById("view-kit-fold"); if (f) f.open = true; });
const beforeFlip = await page.evaluate(() => window.app.opponent.probe().pos);
await page.click("[data-vk-flip]");
await page.waitForTimeout(900);
const afterFlip = await page.evaluate(() => { window.app.opponent.update(0.016); return window.app.opponent.probe(); });
ok(Math.sign(beforeFlip.y) !== Math.sign(afterFlip.pos.y) && afterFlip.head.inside, `🐾 🔃 換邊後牠還是坐你對面(y ${beforeFlip.y} → ${afterFlip.pos.y})、頭在畫面裡(${afterFlip.head.x}, ${afterFlip.head.y})`);
await page.click('[data-vk-view="sit"]');
await page.waitForTimeout(900);
const sitPet = await page.evaluate(() => window.app.opponent.probe().head);
ok(sitPet.inside, `🐾 對局視角(34°):頭頂在畫面裡(${sitPet.x}, ${sitPet.y})`);
await page.click("[data-vk-reset]");
await page.waitForTimeout(600);
const toggled = await page.evaluate(() => {
  const O = window.app.opponent;
  O.setMode("off"); const off = { visible: O.figure.group.visible, saved: localStorage.getItem("xiangqi3d-pet"), line: document.getElementById("pet-line").classList.contains("hidden") };
  O.setMode("mute"); const mute = { visible: O.figure.group.visible, voiceOn: O.voiceOn };
  O.setMode("voice");
  return { off, mute };
});
ok(toggled.off.visible === false && toggled.off.saved === "off", `🐾 關掉 ⇒ 隱藏、localStorage 記 off(${JSON.stringify(toggled.off)})`);
ok(toggled.mute.visible === true && toggled.mute.voiceOn === false, `🐾 不出聲 ⇒ 還坐著、不唸(${JSON.stringify(toggled.mute)})`);
await page.click("#btn-to-menu");
await page.waitForTimeout(200);
await page.click("#btn-pvp");
await page.waitForTimeout(600);
const pvp = await page.evaluate(() => ({ kind: window.app.opponent.kind, on: window.app.opponent.on, line: document.getElementById("pet-line").classList.contains("hidden"), petOn: document.body.classList.contains("pet-on") }));
ok(pvp.kind === null && pvp.on === false && pvp.line && !pvp.petOn, "🐾 玩家對戰玩家 ⇒ 沒有動物、HUD 不寫對手");
await page.waitForFunction(() => window.app.voice && window.app.voice.ready(), null, { timeout: 10000 }).catch(() => {});
const v = await page.evaluate(() => ({ ready: window.app.voice.ready(), has: window.app.voice.has("owl", "check"), yes: window.app.voice.say("cat", "win"), no: window.app.voice.say("cat", "nope") }));
ok(v.ready && v.has && v.yes === true && v.no === false, `🗣 人聲 runtime:manifest 載到、cat-win 送去放、沒烤的不唸(${JSON.stringify(v)})`);
await page.click("#btn-to-menu");
await page.waitForTimeout(200);
await page.click("#btn-daily");
await page.waitForFunction(() => window.app.gameMode === "daily" && window.app.opponent.kind === "owl", null, { timeout: 5000 });
const owl = await page.evaluate(() => ({ ...window.app.opponent.probe(), name: document.getElementById("pet-name").textContent }));
ok(owl.kind === "owl" && owl.visible && owl.head.inside && /^🦉/.test(owl.name), `🐾 每日殘局 ⇒ 🦉 貓頭鷹守黑方(${owl.name};頭 ${owl.head.x}, ${owl.head.y})`);

ok(errors.length === 0, "整場零 pageerror", errors.join(" | "));

await browser.close();
console.log(`\n🔬 browser-check:${pass} 過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
