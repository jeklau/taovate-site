// 从各页面 <head> 里的 canonical + hreflang 生成 sitemap.xml。
// HTML 是唯一的事实来源：新增页面时只要写好 canonical / hreflang，运行 npm run build 即可。
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'fonts' && f !== 'vendor') yield* walk(p); }
    else if (f.endsWith('.html')) yield p;
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const entries = [];
for (const file of walk(pub)) {
  const h = readFileSync(file, 'utf8');
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(h)) continue;
  const canon = h.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canon) { console.error(`缺少 canonical：${file}`); process.exit(1); }
  const alts = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  entries.push({ canon, alts });
}
entries.sort((a, b) => a.canon.localeCompare(b.canon));

const body = entries
  .map(({ canon, alts }) =>
    `  <url>\n    <loc>${esc(canon)}</loc>\n` +
    alts.map(([l, u]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(u)}"/>`).join('\n') +
    (alts.length ? '\n' : '') + '  </url>')
  .join('\n');

writeFileSync(
  join(pub, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`
);
console.log(`sitemap.xml：${entries.length} 个页面`);
