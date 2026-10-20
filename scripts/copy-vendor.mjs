// 把前端依赖复制到 public/，让线上页面不依赖任何第三方域名（Google Fonts、jsDelivr 等）。
// 产物（public/vendor、public/fonts）会提交进仓库，所以即使部署平台不跑构建，网站也能正常工作。
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => join(root, 'node_modules', ...p);
const pub = (...p) => join(root, 'public', ...p);

mkdirSync(pub('vendor'), { recursive: true });
mkdirSync(pub('fonts'), { recursive: true });

// 1. Alpine.js（版本由 package.json 锁定，不再用 3.x.x 浮动版本）
copyFileSync(nm('alpinejs', 'dist', 'cdn.min.js'), pub('vendor', 'alpine.min.js'));

// 2. 字体：解析 fontsource 的 @font-face，改写为 /fonts/ 路径，并复制被引用的 woff2
const blocks = [];
function take(cssPath, keep) {
  const css = readFileSync(cssPath, 'utf8');
  const dir = dirname(cssPath);
  for (const m of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
    let block = m[0];
    const urls = [...block.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)].map((u) => u[1]);
    if (!urls.length || !keep(block, urls[0])) continue;
    // 只保留 woff2 源，去掉 woff 回退（所有现代浏览器都支持 woff2）
    block = block.replace(/src:[^;]+;/, `src: url(/fonts/${urls[0]}) format('woff2');`);
    if (/variations/.test(m[0])) block = block.replace(/format\('woff2'\)/, "format('woff2-variations')");
    copyFileSync(join(dir, 'files', urls[0]), pub('fonts', urls[0]));
    blocks.push(block);
  }
}

// Inter：只要拉丁字符集（站内英文与符号）
take(nm('@fontsource-variable', 'inter', 'wght.css'), (_b, f) => /inter-latin-wght-normal/.test(f));
// Noto Serif SC：全部切片，浏览器按页面实际用到的汉字按需下载
take(nm('@fontsource-variable', 'noto-serif-sc', 'wght.css'), () => true);
// Spectral（英文页标题）：拉丁字符集 400/500/600 + 400 斜体
for (const f of ['latin-400', 'latin-500', 'latin-600', 'latin-400-italic']) {
  take(nm('@fontsource', 'spectral', `${f}.css`), () => true);
}

writeFileSync(pub('fonts', 'fonts.css'), blocks.join('\n\n') + '\n');
console.log(`vendor: alpine + ${blocks.length} @font-face 规则`);
