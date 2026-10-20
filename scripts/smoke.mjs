// 对正在运行的站点做冒烟测试：本地 `npm run dev` 或线上都能用。
//   npm run smoke                       -> 测 http://127.0.0.1:8787
//   npm run smoke -- https://taovate.com -> 测线上
// 检查：规范 URL 全部 200；旧 .html 地址跳转到规范 URL；内链不经过任何跳转；
//       安全响应头；404 页返回 404；sitemap/robots 可访问。
const base = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const canonical = ['/', '/services', '/case-study', '/about', '/contact', '/seo/', '/en/', '/en/services', '/en/case-study', '/en/about', '/en/contact'];
const legacy = {
  '/index.html': '/', '/services.html': '/services', '/en/index.html': '/en/', '/en/contact.html': '/en/contact',
  '/index-full': '/seo/', '/index-full.html': '/seo/', '/en': '/en/', '/seo': '/seo/',
};
const needHeaders = ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'strict-transport-security'];

let bad = 0;
const fail = (m) => { bad++; console.log('✗ ' + m); };
const ok = (m) => console.log('✓ ' + m);
const get = (path) => fetch(base + path, { redirect: 'manual' });

for (const p of canonical) {
  const r = await get(p);
  if (r.status !== 200) { fail(`${p} 返回 ${r.status}，应为 200`); continue; }
  const miss = needHeaders.filter((h) => !r.headers.get(h));
  miss.length ? fail(`${p} 缺少响应头 ${miss.join(', ')}`) : ok(`${p} 200，安全头齐全`);
}

for (const [from, to] of Object.entries(legacy)) {
  const r = await get(from);
  const loc = r.headers.get('location');
  const target = loc ? new URL(loc, base).pathname : null;
  [301, 302, 307, 308].includes(r.status) && target === to
    ? ok(`${from} -> ${r.status} ${to}`)
    : fail(`${from} 应跳转到 ${to}，实际 ${r.status} ${loc ?? ''}`);
}

// 内链不应经过跳转
const seen = new Set();
for (const p of canonical) {
  const html = await (await get(p)).text();
  for (const m of html.matchAll(/<a [^>]*href="(\/[^"#]*)"/g)) seen.add(m[1]);
}
for (const l of seen) {
  const r = await get(l);
  r.status === 200 ? null : fail(`内链 ${l} 返回 ${r.status}（内链应直接 200，不要经过跳转）`);
}
if (!bad) ok(`${seen.size} 个不同的内链全部直接返回 200`);

const nf = await get('/this-page-does-not-exist');
nf.status === 404 && (await nf.text()).includes('这个页面不存在') ? ok('不存在的地址返回 404 并显示自定义 404 页') : fail(`404 页异常：${nf.status}`);
for (const f of ['/sitemap.xml', '/robots.txt', '/taovate.css', '/vendor/alpine.min.js', '/fonts/fonts.css', '/og.png']) {
  const r = await get(f);
  r.status === 200 ? ok(`${f} 200`) : fail(`${f} 返回 ${r.status}`);
}

console.log(bad ? `\n失败 ${bad} 项` : '\n全部通过');
process.exit(bad ? 1 : 0);
