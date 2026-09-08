// 🔬 service-worker.js 的離線韌性(2026-09-08 立)
//
// 由來:使用者把 App 裝到手機上,打開就是「無法連上這個網站 / ERR_FAILED」(實機截圖)。
//   病根在 install:舊版用 `cache.addAll(ASSETS_TO_CACHE)` —— **全部或全無**。
//   清單裡有兩個外部 CDN 的 three.js;安裝那一刻只要**任一個**抓不到
//   (手機切網、CDN 抖一下、被擋第三方),整批 reject ⇒ 快取裡一個檔都沒有,
//   而 SW 照樣註冊成功、畫面上零錯誤、也沒有任何測試會紅。
//   之後從主畫面獨立視窗開 start_url,網路不順就直接 ERR_FAILED。
//
// ★ 為什麼用「假的 caches」而不是真瀏覽器:Playwright 的 page.route 攔不到
//   **Service Worker 自己發的** 請求(0908 實際踩到:route abort 了 CDN,
//   SW 照樣把 14 個資產全抓到、離線照樣開得起來 ⇒ 那個實驗證不到任何事)。
//   要驗「某一個資產抓不到會怎樣」,最誠實的辦法就是直接餵它一個抓不到的資產。
//
// 跑法:node test/sw.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg, note = '') => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg + (note ? ' → ' + note : '')); }
};

/** 假的 SW 環境。failUrls 裡的網址一 add 就 reject(模擬 CDN 抓不到)。 */
function runSw(failUrls = []) {
  const store = new Map();
  const listeners = {};
  const cache = {
    add: async (url) => {
      if (failUrls.some((f) => String(url).includes(f))) throw new TypeError('Failed to fetch');
      store.set(String(url), 'body:' + url);
    },
    addAll: async (urls) => {
      // 真 addAll 的語意:任一個失敗 ⇒ 整批 reject,而且**什麼都不留**
      for (const u of urls) if (failUrls.some((f) => String(u).includes(f))) throw new TypeError('Failed to fetch');
      for (const u of urls) store.set(String(u), 'body:' + u);
    },
    match: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      return store.has(url) ? { url, cached: true } : undefined;
    },
    put: async (req, res) => { store.set(typeof req === 'string' ? req : req.url, res); },
    keys: async () => [...store.keys()],
  };
  const self = {
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
    registration: {},
  };
  const caches = {
    open: async () => cache,
    keys: async () => ['3d-xiangqi-old'],
    delete: async () => true,
    match: async (req) => cache.match(req),
  };
  const fn = new Function('self', 'caches', 'fetch', 'Response', 'TypeError', src);
  fn(self, caches, async () => { throw new TypeError('offline'); }, { error: () => ({ error: true }) }, TypeError);
  return { listeners, store, cache };
}

async function install(env) {
  const waits = [];
  for (const fn of env.listeners.install || []) {
    await fn({ waitUntil: (p) => waits.push(p) });
  }
  /* ⚠ 一定要吞掉 rejection:舊版的 addAll 在這裡會 reject,
     不吞的話 node 直接炸掉、看不到底下那條「快取 0 筆」的紅燈
     —— 而那條紅燈才是這支測試要講的話。 */
  await Promise.all(waits.map((p) => Promise.resolve(p).catch(() => null)));
}

console.log('—— ① 安裝時有一個外部資產抓不到 ——');
const env = runSw(['cdnjs.cloudflare.com']);
await install(env);
const keys = await env.cache.keys();
ok(keys.length >= 10,
  `★★ CDN 抓不到時,其餘資產仍然進了快取(${keys.length} 筆)` +
  '—— 舊版的 addAll 這裡是 0 筆,然後離線就 ERR_FAILED',
  keys.length + ' 筆:' + keys.slice(0, 3).join(' '));
ok(keys.some((k) => k.includes('index.html')),
  '★ 殼層 index.html 在快取裡(從主畫面開 App 靠它)');

console.log('—— ② 離線導覽要有退路 ——');
ok(/request\.mode === ['"]navigate['"]/.test(src),
  '★ fetch 有導覽請求(navigate)的專用分支');
ok(/ignoreSearch:\s*true/.test(src),
  '★ 導覽比對忽略查詢字串(start_url 帶 ?src=pwa 之類也命中)');
ok(/SHELL|index\.html['"]\)\)\s*\|\|/.test(src),
  '★ 抓不到網路時退回殼層(index.html → ./)');

console.log('—— ③ 執行期快取(安裝時沒抓到的,之後要補上)——');
ok(/cache\.put\(/.test(src) || /keepCopy/.test(src),
  '★ 網路成功時會順手存一份');

console.log('—— ④ 版號回報 ——');
ok(/GET_VERSION/.test(src), '徽章問得到版號(GET_VERSION)');
ok(/skipWaiting\(\)/.test(src) && /clients\.claim\(\)/.test(src),
  '新版 SW 會接手(skipWaiting + clients.claim)—— 不用等下一次開');

console.log((fail ? '🔴' : '🟢') + ` sw:${pass} 過 / ${fail} 失敗`);
if (fail) process.exitCode = 1;
