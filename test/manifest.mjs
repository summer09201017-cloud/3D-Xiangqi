// 🔬 manifest.json 不可以把畫面鎖成橫式(2026-09-13 立)
//
// 由來:使用者「手機直式時也想要有主選單,目前只有橫式才有主選單」。查出來不是版面沒做,
//   是 manifest 寫著 `"orientation": "landscape"` —— 裝成 App 之後系統把畫面**強制轉橫**,
//   直著拿手機根本進不到主選單;0913 剛做好的直向版面(HUD 停底部)在 App 裡也永遠看不到。
//   姊妹站 xiangqi-arena 是 "any"、3d-chinese-chess 沒設(= 跟裝置走),只有本站鎖了。
// ★ 這條守的是「以後誰也別再把它鎖回去」:三站象棋都是直向型(棋盤寬度卡住、直排選單),不該鎖橫。
// 跑法:node test/manifest.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const m = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, msg, note = '') => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg + (note ? ' → ' + note : '')); }
};

ok(m.orientation !== 'landscape' && m.orientation !== 'landscape-primary' && m.orientation !== 'landscape-secondary',
  `★★ manifest 沒把畫面鎖成橫式(orientation=${JSON.stringify(m.orientation)})—— 鎖了直著拿就進不到主選單`);
ok(m.orientation === undefined || m.orientation === 'any' || m.orientation === 'natural',
  `orientation 是 any / natural / 不設(跟裝置走);現在是 ${JSON.stringify(m.orientation)}`);
ok(typeof m.start_url === 'string' && typeof m.scope === 'string', 'start_url / scope 都在(離線殼層靠它們)');
ok(Array.isArray(m.icons) && m.icons.some((i) => /512/.test(i.sizes)), '有 512 圖示(安裝提示要用)');

console.log((fail ? '🔴' : '🟢') + ` manifest:${pass} 過 / ${fail} 失敗`);
if (fail) process.exitCode = 1;
