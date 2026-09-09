// ★ 任何檔案有改就 bump CACHE_NAME(這支 SW 是 cache-first,不 bump 舊使用者永遠拿舊版)
//
// ★★ 2026-09-08 修「安裝到手機、打開就 ERR_FAILED」(使用者實機截圖:
//    https://3d-xiangqi.pages.dev/index.html 無法連上這個網站 / ERR_FAILED)。
//    三個病一起造成它,一個一個記下來免得再犯:
//    ① install 用 cache.addAll(全部或全無)—— 清單裡有兩個 CDN 的 three.js,
//       安裝那一刻只要**任一個**抓不到(手機切網、CDN 抖一下、擋第三方),整批 reject
//       ⇒ 快取裡**一個檔都沒有**,而 SW 照樣註冊成功、畫面上零錯誤。
//       之後獨立視窗開 start_url,沒網路就直接 ERR_FAILED(瀏覽器裡開反而沒事,
//       因為那時通常有網路)。⇒ 改成逐一 add + catch,抓不到的略過,其他照樣進快取。
//    ② fetch 沒有「導覽請求(navigate)的退路」:PWA 的 start_url 帶 ?utm / ?src 之類的
//       查詢字串時 caches.match 就 miss(預設不 ignoreSearch)⇒ 落到 network ⇒ 離線就死。
//       ⇒ 導覽請求一律走「index.html → ./ → 網路」的退路鏈。
//    ③ 沒有執行期快取:install 那次沒抓到的檔,之後永遠不會補進快取。
//       ⇒ 同源 GET 成功就順手存一份,任何一次成功連線之後就真的能離線。
const CACHE_NAME = '3d-xiangqi-v19';

// 導覽退路(離線開 App 時拿它當殼層)
const SHELL = './index.html';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/renderer.js',
  './js/gameLogic.js',
  './js/pieces.js',
  './js/ai.js',
  './js/puzzles.js',
  './img/icon-192.png',
  './img/icon-512.png',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // ⚠ 逐一 add:addAll 只要**一個**外部資產抓不到就整批失敗 ⇒ 整站靜默不離線(見檔頭 ①)
      Promise.all(ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** 網路成功就順手存一份(只存同源 + 我們自己列的 CDN;不存 200 以外的回應) */
function keepCopy(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return response;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // ── 導覽請求(開 App / 重整):快取優先,但一定要有退路,離線也開得起來 ──
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // ① 這個網址本身(忽略查詢字串:start_url 可能帶 ?src=pwa 之類)
      const exact = await cache.match(request, { ignoreSearch: true });
      if (exact) return exact;
      // ② 網路
      try {
        return keepCopy(request, await fetch(request));
      } catch (_) {
        // ③ 殼層退路:index.html → ./
        return (await cache.match(SHELL)) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      return keepCopy(request, await fetch(request));
    } catch (_) {
      return Response.error();
    }
  })());
});

// 🏷️ 版號回報(0820 全艦隊範本):頁尾徽章問「實際執行中的版本」,答案 = 本 SW 的快取名。
self.addEventListener('message', (e) => {
  if (e && e.data === 'GET_VERSION' && e.source) e.source.postMessage({ type: 'SW_VERSION', v: CACHE_NAME });
});
