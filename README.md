# 韬维 Taovate 官网

纯静态站点：HTML + Tailwind（本地编译）+ Alpine.js，部署在 Cloudflare Workers（静态资源）。中文是主版本（根路径），英文在 `/en/`。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/你的用户名/你的仓库名)

> 把上面链接里的 `你的用户名/你的仓库名` 换成真实的 GitHub 地址。一键部署按钮要求仓库是**公开**的。

## 页面与地址

| 中文 | 英文 | 文件 |
|---|---|---|
| `/` 封面 | `/en/` | `public/index.html`、`public/en/index.html` |
| `/seo/` 完整介绍 | — | `public/seo/index.html`（只有中文） |
| `/services` | `/en/services` | `public/services.html`、`public/en/services.html` |
| `/case-study` | `/en/case-study` | 同上规则 |
| `/about` | `/en/about` | 同上规则 |
| `/contact` | `/en/contact` | 同上规则 |

**地址一律不带 `.html`。** Cloudflare 会把 `/services.html` 307 跳转到 `/services`，所以站内链接、canonical、hreflang、sitemap 都写无后缀地址。`npm run check` 会拦住带 `.html` 的链接。旧地址 `/index-full` 会 301 到 `/seo/`（见 `public/_redirects`）。

## 本地开发

```bash
npm install
npm run dev        # 构建并启动本地环境：http://127.0.0.1:8787
```

本地环境和线上用同一套路由、重定向和响应头规则，所以直接双击打开 HTML 文件**不能**正常预览（链接是 `/` 开头的根路径），请用 `npm run dev`。

| 命令 | 作用 |
|---|---|
| `npm run build` | 复制 Alpine 和字体到 `public/`，编译 Tailwind 到 `public/taovate.css`，生成 `sitemap.xml` |
| `npm run check` | 上线前静态检查：内链、canonical、hreflang 互指、sitemap、第三方域名、CSP 与表单地址、残留占位符 |
| `npm run smoke` | 对运行中的站点做冒烟测试，本地和线上都能用：`npm run smoke -- https://taovate.com` |
| `npm run deploy` | 构建 + 检查 + 部署（需要先 `npx wrangler login`） |

`public/taovate.css`、`public/vendor/`、`public/fonts/` 是构建产物，**已提交进仓库**。这样即使部署平台不跑构建命令，网站也能正常工作。你改了 HTML 里的 Tailwind 类名后，要重新 `npm run build` 并一起提交。

## 部署到 Cloudflare

**方式 A：一键部署按钮。** 点 README 顶部按钮，按 Cloudflare 页面提示连接 GitHub 账号并确认。

**方式 B：连接 GitHub 自动部署。** 在 Cloudflare 控制台创建 Worker，选择从 Git 仓库导入。构建命令填 `npm run build`，部署命令填 `npx wrangler deploy`。之后每次 push 到主分支都会自动上线。界面上的具体文案以 Cloudflare 当前页面为准。

**方式 C：本地手动部署。** `npx wrangler login` 之后运行 `npm run deploy`。

### 绑定域名 taovate.com

域名的 DNS 需要托管在 Cloudflare。打开 `wrangler.jsonc` 底部被注释的 `routes` 并按需修改，或在 Cloudflare 控制台的 Worker 设置里添加自定义域名。

绑定后请做两件事：

1. 决定主域名是 `taovate.com` 还是 `www.taovate.com`，另一个做 301 跳转到主域名。本站所有 canonical 和 hreflang 写的是 `https://taovate.com`。
2. 上线后运行 `npm run smoke -- https://taovate.com`，再到 Google Search Console 添加站点并提交 `https://taovate.com/sitemap.xml`。

## 开通联系表单

表单在 `public/contact-form.js`，目前 `FORM_ENDPOINT` 是空的。**留空时，访客提交会看到"表单暂未开通，请直接发邮件"，不会假装发送成功。**

开通步骤：

1. 准备一个接收地址：表单服务（例如 Formspree，会给你一个 `https://formspree.io/f/xxxxxxxx`），或者你自己的接口（如 `/api/contact`）。
2. 把地址填进 `contact-form.js` 的 `window.FORM_ENDPOINT = window.FORM_ENDPOINT || '这里';`。
3. 如果是外部域名，同时把域名加进 `public/_headers` 的 `connect-src`，例如 `connect-src 'self' https://formspree.io;`。**漏掉这一步，浏览器会拦截提交。** `npm run check` 会检查这一点。
4. 部署后在 `/contact` 和 `/en/contact` 各提交一条真实询盘，确认你收到了。

提交内容是 JSON，字段：`name`、`company`、`email`、`website`、`industry`、`need`、`message`、`_gotcha`（蜜罐，正常用户为空）。

## 改文字与加页面

- 改文字：直接改 `public/` 里的 HTML。中英文是两份独立文件，要分别改。
- 新增页面：复制一个现有页面，改 `<title>`、`description`、`canonical`；有英文对应页就写 `hreflang`（**两个页面必须互相指向**）；然后 `npm run build && npm run check`。sitemap 会从各页面的 canonical 和 hreflang 自动生成。
- 站内链接一律写 `/` 开头的无后缀路径，如 `/services`、`/en/`。

## 安全头

`public/_headers` 设置了 CSP、`X-Frame-Options`、HSTS（180 天，不含子域名）等。已知取舍：Alpine.js 的标准版本需要 `'unsafe-eval'`，所以 `script-src` 里有它；脚本和样式只允许本站来源，字体、Alpine 都已自托管，页面不请求任何第三方域名。

## 上线前

看 [`docs/launch-checklist.md`](docs/launch-checklist.md)：页面上有哪些说法需要证据，以及目前发现的内容矛盾。

## 目录

```
public/            部署目录（wrangler.jsonc 的 assets.directory）
  *.html en/ seo/  页面
  _headers         响应头与 CSP
  _redirects       旧地址跳转
  404.html robots.txt sitemap.xml og.png
  site.js          渐入动画与页脚年份（同步加载，失败时内容仍可见）
  contact-form.js  联系表单逻辑与接收地址
  taovate.css      构建产物（Tailwind）
  vendor/ fonts/   构建产物（Alpine、自托管字体）
src/input.css      Tailwind 入口与自定义样式
scripts/           build / check / smoke 脚本
```
