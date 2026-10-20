// 上线前静态检查（无需启动服务）。有错误时退出码为 1，npm run deploy 会因此中止。
//   1. 内链/资源：每个站内链接都能解析到真实文件，且不依赖 Cloudflare 的 .html 跳转
//   2. canonical：每个可索引页面都有，且与自己的规范 URL 一致
//   3. hreflang：互相指向（A 指 B，B 必须指回 A），且目标页面存在
//   4. sitemap / robots：与页面一致
//   5. 第三方域名：页面不再依赖 Google Fonts、CDN 等外部资源
//   6. CSP：contact-form.js 里的 FORM_ENDPOINT 域名必须被 _headers 的 connect-src 允许
//   7. 未清理的占位符：只警告，不报错
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const ORIGIN = 'https://taovate.com';
const errors = [];
const warns = [];
const err = (m) => errors.push(m);

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'fonts' && f !== 'vendor') yield* walk(p); }
    else if (f.endsWith('.html')) yield p;
  }
}

// 把站内路径解析成「Cloudflare 实际会返回 200 的 URL 路径」
function routeOf(file) {
  const rel = file.slice(pub.length).replace(/\\/g, '/');
  if (rel.endsWith('/index.html')) return rel.slice(0, -'index.html'.length); // /seo/ , /en/ , /
  return rel.slice(0, -'.html'.length); // /services
}
const pages = new Map(); // route -> {file, html}
for (const f of walk(pub)) pages.set(routeOf(f), { file: f, html: readFileSync(f, 'utf8') });
const redirects = new Set(
  (existsSync(join(pub, '_redirects')) ? readFileSync(join(pub, '_redirects'), 'utf8') : '')
    .split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split(/\s+/)[0])
);

const assetExists = (path) => existsSync(join(pub, path.replace(/^\//, '')));

for (const [route, { html }] of pages) {
  const is404 = route === '/404';
  const where = route;

  // 1. 链接与资源
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(mailto:|tel:|#|data:)/.test(u)) continue;
    if (/^https?:\/\//.test(u)) {
      if (u.startsWith(ORIGIN)) continue; // canonical / hreflang / og:url 另行检查
      if (!/^https?:\/\/(www\.)?w3\.org/.test(u)) err(`${where}: 依赖外部地址 ${u}`);
      continue;
    }
    if (!u.startsWith('/')) { err(`${where}: 使用了相对路径 ${u}（请改成 / 开头）`); continue; }
    const path = u.split('#')[0].split('?')[0];
    if (/\.html$/.test(path)) { err(`${where}: 链接 ${u} 带 .html，Cloudflare 会 307 跳转到无后缀地址`); continue; }
    if (pages.has(path) || (pages.has(path + '/') && false)) continue;
    if (assetExists(path)) continue;
    if (redirects.has(path)) { err(`${where}: 链接 ${u} 指向一个重定向，请直接链接到目标`); continue; }
    err(`${where}: 链接 ${u} 找不到对应文件`);
  }

  if (is404) continue;
  const noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(html);

  // 2. canonical
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!noindex) {
    if (!canon) err(`${where}: 缺少 canonical`);
    else if (canon !== ORIGIN + route) err(`${where}: canonical ${canon} 与页面地址 ${ORIGIN + route} 不一致`);
  }

  // 3. hreflang 互指
  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ lang: m[1], url: m[2] }));
  if (alts.length) {
    const self = alts.find((a) => a.url === canon && a.lang !== 'x-default');
    if (!self) err(`${where}: hreflang 缺少指向自己的条目`);
    for (const a of alts) {
      if (a.lang === 'x-default' || a.url === canon) continue;
      const target = pages.get(a.url.replace(ORIGIN, ''));
      if (!target) { err(`${where}: hreflang ${a.lang} 指向不存在的页面 ${a.url}`); continue; }
      // 互指：对方页面必须用「我的语言」指回「我的规范 URL」
      const back = [...target.html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]}|${m[2]}`);
      if (self && !back.includes(`${self.lang}|${canon}`))
        err(`${where}: hreflang ${a.lang}→${a.url}，但对方页面没有用 ${self.lang} 指回 ${canon}`);
    }
    if (!alts.some((a) => a.lang === 'x-default')) err(`${where}: 缺少 hreflang x-default`);
  }

  // 7. 占位符（警告）
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  for (const m of text.matchAll(/\[[^\]\n]{2,}\]/g)) warns.push(`${where}: 疑似占位符 ${m[0]}`);
  for (const m of text.matchAll(/\S*XX\S*/g)) warns.push(`${where}: 疑似匿名占位 ${m[0]}`);
  if (/PLACEHOLDER/.test(html)) warns.push(`${where}: 含 PLACEHOLDER 注释`);
}

// 4. sitemap / robots
const sm = existsSync(join(pub, 'sitemap.xml')) ? readFileSync(join(pub, 'sitemap.xml'), 'utf8') : '';
if (!sm) err('缺少 sitemap.xml（运行 npm run build）');
for (const [route, { html }] of pages) {
  if (route === '/404' || /<meta[^>]+noindex/i.test(html)) continue;
  if (!sm.includes(`<loc>${ORIGIN + route}</loc>`)) err(`sitemap.xml 缺少 ${ORIGIN + route}（运行 npm run build）`);
}
for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) if (!pages.has(m[1].replace(ORIGIN, ''))) err(`sitemap.xml 里的 ${m[1]} 没有对应页面`);
if (!/Sitemap:\s*https:\/\/taovate\.com\/sitemap\.xml/.test(readFileSync(join(pub, 'robots.txt'), 'utf8'))) err('robots.txt 没有声明 sitemap');

// 6. FORM_ENDPOINT 与 CSP
const cf = readFileSync(join(pub, 'contact-form.js'), 'utf8');
const ep = cf.match(/window\.FORM_ENDPOINT\s*=\s*window\.FORM_ENDPOINT\s*\|\|\s*'([^']*)'/)?.[1];
const csp = readFileSync(join(pub, '_headers'), 'utf8').match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? '';
const connect = csp.match(/connect-src ([^;]+)/)?.[1] ?? '';
if (ep === undefined) err('contact-form.js 里找不到 window.FORM_ENDPOINT 的默认值');
else if (ep === '') warns.push('contact-form.js: FORM_ENDPOINT 为空，联系表单未开通（访客提交时会看到“请直接发邮件”）');
else if (/^https?:\/\//.test(ep)) {
  const origin = new URL(ep).origin;
  if (!connect.split(/\s+/).includes(origin)) err(`FORM_ENDPOINT 的域名 ${origin} 没有写进 _headers 的 connect-src，浏览器会拦截提交`);
}

for (const w of warns) console.log('警告 ' + w);
for (const e of errors) console.log('错误 ' + e);
console.log(`\n检查了 ${pages.size} 个 HTML 文件：${errors.length} 个错误，${warns.length} 个警告`);
process.exit(errors.length ? 1 : 0);
