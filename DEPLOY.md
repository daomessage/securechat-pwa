# Deploy Your Own DAO Message PWA

Complete, no-command-line guide to deploying this PWA to your own Cloudflare / Vercel / Netlify account.

**What you'll get**: a personal URL like `https://<your-name>.pages.dev`, running an end-to-end encrypted chat app identical to the official demo at `chat.daomessage.com`.

---

## 🎯 Which Platform Should I Pick?

| Platform | Free Tier | China Access | Best For |
|---|---|---|---|
| **Cloudflare Pages** ⭐ | Unlimited bandwidth, 500 builds/mo | 🟢 Good (330+ edges) | Most users, China-friendly |
| **Vercel** | 100 GB bandwidth, 100 builds/day | 🟡 OK | Next.js fans, quick iteration |
| **Netlify** | 100 GB bandwidth, 300 builds/mo | 🟡 OK | Longtime Netlify users |

All three give you HTTPS, PWA support, and a free subdomain. Pick whichever you already have an account on.

---

## 🚀 Cloudflare Pages (Recommended)

两种方式二选一，效果完全相同。

---

### 方式一 · CF Dashboard Git 集成（零代码，最省事）

> ⚠️ **不要**用 `deploy.workers.cloudflare.com/?url=...` 那种 Deploy Button — 会误当成 Worker 部署失败。

#### Step 1 · Fork 到你的 GitHub

打开 <https://github.com/daomessage/securechat-pwa> → 右上角 **Fork**

#### Step 2 · 进入 Pages 创建流程

1. <https://dash.cloudflare.com/> 登录
2. 左侧栏 **Compute → Workers & Pages**(2026 起 Pages 入口已合并到 Compute 折叠组)
3. 右上角 **Create application** → 滚到底点 *"Looking to deploy Pages? **Get started**"*
4. 选 **Import an existing Git repository** → **Get started**

#### Step 3 · 选仓库并授权(首次)

1. **GitHub** tab → 选 GitHub 账户(下拉)→ **Add account** 弹出 OAuth 授权 → 选 **Only select repositories** → 勾你 fork 的 `securechat-pwa` → **Install & Authorize**
2. 回到 CF 后,**Search repositories...** 搜 `securechat-pwa` → 选中 → **Begin setup**

> 已经授权过 Cloudflare Pages GitHub App 的账户可跳过授权步骤,直接搜仓库。

#### Step 4 · 配置构建

1. **Project name**: 默认与仓名同名(如 `securechat-pwa`)。**注意**: 如果同账号或全局已有同名项目,CF 会自动加 `-数字` 后缀(如 `securechat-pwa-326`),最终域名是 `<最终名>.pages.dev`
2. **Production branch**: `main`(默认即可)
3. **Framework preset**: 选 **React (Vite)** — 选完会**自动填好**下面两个字段
4. **Build command**: `npm run build`(自动填好)
5. **Build output directory**: `dist`(自动填好)
6. **Save and Deploy** → 构建 + 部署约 1-3 分钟

**完成！** 打开 `<最终名>.pages.dev`,之后每次 push 到 main 自动重新部署。

---

### 方式二 · GitHub Actions + Wrangler（CI 里显式控制）

如果你想在 GitHub Actions 里看到部署日志、加测试步骤、或者用 CI 触发，用这个方式。

#### Step 1 · Fork 到你的 GitHub

同上。

#### Step 2 · 在 CF 创建一个空项目

1. <https://dash.cloudflare.com/> → **Workers & Pages** → **Create** → **Pages**
2. 选 **Direct Upload** → 起个项目名（**记下来,后面要用**） → **Create project** → 跳过上传

#### Step 3 · 添加 GitHub Secrets + Variable

打开你 fork 的仓库 → **Settings → Secrets and variables → Actions**:

**Secrets** tab → 加两条:

| Secret 名 | 取值 |
|---|---|
| `CF_ACCOUNT_ID` | CF Dashboard 右侧栏 Account ID |
| `CF_API_TOKEN` | [生成 token](https://dash.cloudflare.com/profile/api-tokens) → 模板选 **"Cloudflare Pages: Edit"** |

**Variables** tab → 加一条（**可选**,不加就用仓库名）:

| Variable 名 | 取值 |
|---|---|
| `CF_PROJECT_NAME` | Step 2 起的 CF Pages 项目名 |

> 💡 如果你的 fork 仓库名和 CF Pages 项目名**完全一样**,这条 Variable 可以省 — workflow 默认 fallback 到仓库名。

#### Step 4 · 启用 Workflow

仓库已内置 `.github/workflows/deploy-cloudflare-pages.yml`，推送到 main 或手动触发即可：

1. **Actions tab** → **Deploy to Cloudflare Pages** → **Run workflow**
2. 等 ~2 分钟 → 访问 `https://<你的项目名>.pages.dev`

> **如果你已经用了方式一**（CF Dashboard Git 集成），此 workflow 会和 CF 的 Git 集成各自独立触发，可能重复部署。二选一即可：要么在 CF Dashboard 断开 Git 连接，要么禁用这个 workflow。

---

### Optional: Custom Domain

1. CF Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 填 `chat.yourname.com`
3. 如果域名在 Cloudflare DNS 里 → 自动加 CNAME；否则手动添加：
   ```
   chat  CNAME  <你的项目名>.pages.dev
   ```
4. 5-10 分钟 SSL 自动签发

---

## ▲ Vercel

1. **Click the button** → takes you to `vercel.com/new/clone`
2. **Sign in with GitHub** (creates a Vercel account if new)
3. **Choose a project name** — e.g. `my-daomessage`
4. **(Optional)** Configure environment variables:
   - `VITE_API_BASE` = custom relay URL (leave blank to use `relay.daomessage.com`)
5. **Click "Deploy"** — ~60 seconds
6. Get your URL: `https://<name>.vercel.app`

---

## 🟢 Netlify

1. **Click the button** → takes you to `app.netlify.com/start/deploy`
2. **Authorize GitHub** access to Netlify
3. **Configure**:
   - Base directory: leave blank
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Click "Deploy site"** — ~90 seconds
5. Get your URL: `https://<random-name>.netlify.app` (you can rename in site settings)

---

## 🐙 GitHub Pages — 免第三方平台

模板内置了 GitHub Actions workflow (`.github/workflows/deploy-github-pages.yml`), 用户 fork 后
只需要启用 GitHub Pages 就自动构建 + 部署,完全不需要 CF / Vercel / Netlify 账号。

### Step 1 · Fork 模板

[github.com/daomessage/securechat-pwa → Fork](https://github.com/daomessage/securechat-pwa/fork)

### Step 2 · 启用 GitHub Pages

1. 打开你 fork 的仓库
2. **Settings** tab → 左栏 **Pages**
3. **Source**: 从下拉菜单选 **"GitHub Actions"**(不是 "Deploy from a branch")
4. 保存

### Step 3 · 启用 Actions(fork 默认禁用)

GitHub 出于安全考虑,**所有 fork 仓库默认禁用 workflows**。第一次必须手动启用:

1. **Actions** tab
2. 看到提示 *"Workflows aren't being run on this forked repository"*
3. 点绿色按钮 **"I understand my workflows, go ahead and enable them"**
4. 出现 *"Actions Enabled."* 横幅 → 完成

> 这一步**只需要做一次**,以后 push 到 main 会自动触发 workflow。

### Step 4 · 触发首次部署

**方法 A · 手动触发**(推荐,启用 Actions 后立刻能用):
1. Actions tab → 左栏选 **"Deploy to GitHub Pages"**
2. 右上角 **"Run workflow"** 下拉 → 再点 **"Run workflow"** 绿按钮确认
3. 等 ~1 分钟构建 + 部署

**方法 B · 推个空 commit**:
```bash
git clone https://github.com/<你>/securechat-pwa
cd securechat-pwa
git commit --allow-empty -m "trigger pages deploy"
git push
```

### Step 5 · 访问你的站

部署成功后 URL 是:

```
https://<你的 GitHub 用户名>.github.io/<repo 名>/
```

例如 fork 后没改名:`https://alice.github.io/securechat-pwa/`

### Step 6 · (可选)自定义域名

1. Settings → Pages → **Custom domain** 填 `chat.yourname.com`
2. DNS 加 CNAME:`chat.yourname.com CNAME <你>.github.io`
3. 等待 DNS 生效 + GitHub 自动签 Let's Encrypt 证书(10-30 分钟)

### ⚠️ GitHub Pages 限制

- **中国大陆访问 github.io 很不稳定**(被污染常见)。海外用户没问题,国内用户需用自定义域名 + 境外 DNS
- **100 GB/月带宽限制**(对大部分个人用户足够)
- **`base` path 必须是 `/<repo>/`** — workflow 会自动配置,无需手工改代码
- **PWA `start_url` 和 `scope`** 会自动跟随 base path(我们已处理)

### 故障排查

**workflow 没自动跑**:确认 Source 选了 "GitHub Actions" 不是 "Deploy from a branch"

**404 找不到页面**:等 2-3 分钟 GitHub Pages 生效;检查 URL 末尾 `/` 不能丢

**刷新子路由 404**:已用 `404.html` 技巧解决 (workflow 自动 copy index.html → 404.html)

**资源路径错**:确认 Settings → Pages 里显示的 URL 和 `<user>.github.io/<repo>/` 一致,仓库改名的话要改 base path

---

## 🔐 Your Privacy, Explained

- **We (DAO Message) don't see your deployment.** The Deploy Button takes you to Cloudflare/Vercel/Netlify's own site. We never get your credentials, your repo access, or your analytics.
- **Your messages are still zero-knowledge.** The PWA talks to `relay.daomessage.com`, which only relays encrypted blobs. Neither your hosting platform nor the relay can read your chats.
- **You own your fork.** The repo lives under your GitHub account. You can modify, extend, or abandon it freely.
- **Revoke access any time.**
  - GitHub: Settings → Applications → Installed GitHub Apps → Uninstall "Cloudflare Pages" / "Vercel" / "Netlify"
  - Cloudflare: Delete project in Pages dashboard
  - Your fork repo: Delete under GitHub repo settings

---

## 🛠️ Common Issues

### Build fails with "Missing environment variable"

We try hard to make fork-and-deploy work with zero config. If you see this, it's likely a version drift. Try:

1. Sync your fork with upstream:
   ```
   Go to github.com/<you>/securechat-pwa → Click "Sync fork"
   ```
2. Redeploy

### "CORS error" / "Failed to fetch" (注册或登录时)

**症状**:部署好了、站能打开,但注册/登录时 Network 面板显示 `CORS error` 或 `Failed to fetch`。Preflight OPTIONS 200 OK 但实际 POST 被浏览器拒绝。

**原因**:relay 服务端的 CORS 策略没允许你的部署域名。

**解决**:
- 这是 relay 的 bug,**不是你部署的问题**
- 已在 2026-04-21 修复:relay CORS 完全开放,支持任意 origin
- 如果你还遇到:清浏览器缓存 + 刷新,或者等官方 relay 重新部署

### package-lock.json out of sync / "npm ci EUSAGE"

**症状**:CF 构建日志里 `Invalid: lock file's @daomessage_sdk/sdk@1.0.3 does not satisfy @daomessage_sdk/sdk@1.0.12`。

**原因**:fork 的代码 `package.json` 和 `package-lock.json` 版本脱节。

**解决**:Sync fork(见下方"如何更新"),再重新部署。官方上游已修复。

### "无法获取存储库内容" / "Unable to fetch repository contents" (Cloudflare)

**症状**:点 Deploy Button 后,"克隆存储库"页面显示红色 `无法获取存储库内容` / `Unable to fetch repository contents`。

**原因**:Cloudflare 无法访问 `daomessage/securechat-pwa`,因为:
1. 你的 Cloudflare 账号没有装 "Cloudflare Pages GitHub App"
2. 或装了但没授权访问 `daomessage` 组织下的仓(那不是你的仓)

**解决**:**先 fork 到你自己的 GitHub,再从 fork 部署**(这是 Deploy Button 的标准玩法):

1. 打开 <https://github.com/daomessage/securechat-pwa>
2. 右上角 **Fork** → fork 到你自己账号
3. 再访问:
   ```
   https://deploy.workers.cloudflare.com/?url=https://github.com/<your-username>/securechat-pwa
   ```
4. 这次 CF 能读到(因为 repo 在你账号下)
5. 如果仍读不到:去 GitHub **Settings → Applications → Installed GitHub Apps → Cloudflare Pages → Configure**,确认权限设为 "All repositories" 或至少包含你 fork 的 `securechat-pwa`

### Build fails with Node version error

The template requires Node 20+. Each platform uses a different default:

- **Cloudflare Pages**: Default Node 22 (new projects). If you see an older Node error, go to Project Settings → Environment variables → add `NODE_VERSION=22`
- **Vercel**: Reads `engines.node` from `package.json` (already set to `>=20`). Should Just Work.
- **Netlify**: Reads `netlify.toml` (bundled in the repo, pins Node 22). Should Just Work.

### The app loads but can't connect to relay

Check browser DevTools → Console. You'll see messages like "WS connection failed". Possible cause: your region has connectivity issues with `relay.daomessage.com`. Try switching networks (mobile hotspot vs. WiFi) to confirm. If the issue persists, report it at [github.com/daomessage/securechat-pwa/issues](https://github.com/daomessage/securechat-pwa/issues).

### How do I update to latest version?

1. Go to `github.com/<you>/securechat-pwa`
2. Click **"Sync fork"** → **"Update branch"**
3. Cloudflare / Vercel / Netlify auto-rebuilds and redeploys

### My users on iPhone can't receive notifications

- iOS requires the PWA to be **added to home screen first** before Web Push can be requested
- Guide users via Safari → Share → Add to Home Screen
- The built-in InstallBanner component will show this hint on iOS devices automatically

---

## 🤝 Advanced: Mobile Web Clip (iOS)

Want to give iOS users a **one-tap install** that's smoother than "Add to Home Screen"? Web Clip serves a `.mobileconfig` file users tap to install.

**The default flow is unsigned — works out of the box, $0 cost.** iOS shows an orange "Unsigned" label users can ignore (it's a warning about provenance, not security; the install itself is exactly identical to a signed one).

If you want the green "Verified by [your name]" label, you can optionally configure an S/MIME cert (~$12/yr) — see `docs/WEBCLIP_CERT_SETUP.md` for the optional cert pipeline.

---

## 🙋 Need Help?

- 💬 Main docs: [doc.daomessage.com](https://doc.daomessage.com)
- 🐛 Issues: [github.com/daomessage/securechat-pwa/issues](https://github.com/daomessage/securechat-pwa/issues)
- 📧 Contact: admin@daomessage.com

---

**Happy chatting!** 🔒
