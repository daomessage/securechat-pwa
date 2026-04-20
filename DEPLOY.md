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

> ⚠️ **重要**: 不要用 `deploy.workers.cloudflare.com/?url=...` 那种 "Deploy Button"。
> CF 的 Deploy Button 实际走的是 **Worker** 创建流程,会误把我们的 PWA 当成 Worker,
> 预填 `npx wrangler deploy`(错的!应该是 pages deploy)→ 构建失败。
>
> **正确做法: 3 步手动**(总耗时 ~3 分钟)。

### Step 1 · Fork 模板到你的 GitHub

1. 打开 <https://github.com/daomessage/securechat-pwa>
2. 右上角点 **Fork**
3. Fork 到 `github.com/<你的用户名>/securechat-pwa`

### Step 2 · 首次:授权 GitHub ↔ Cloudflare Pages

(做过一次就跳到 Step 3)

1. 打开 <https://dash.cloudflare.com/> 注册/登录 Cloudflare 免费账号
2. 左侧 **Workers & Pages**
3. 点 **Create** → 选 **Pages** tab(**不是** Workers tab!)
4. 点 **Connect to Git**
5. **Connect GitHub** → 弹窗授权
6. 选 **Only select repositories** → 勾选你刚 fork 的 `securechat-pwa`
7. **Install & Authorize**

### Step 3 · 创建项目 + 部署

1. Connect to Git 页面选你 fork 的 `securechat-pwa`(Git 帐户下拉里)
2. Begin setup
3. **项目名**: 默认 `securechat-pwa` 或改成你想要的 `<name>`(这会是 `<name>.pages.dev`)
4. **Framework preset**: 选 **Vite** (或保持 None,我们 `wrangler.toml` 会自动识别)
5. **Build command**: `npm run build`
6. **Build output directory**: `dist`
7. **环境变量**(可选): 留空就好,默认连官方 relay.daomessage.com
8. 点 **Save and Deploy**
9. 等 ~90 秒

**完成**。打开 `<name>.pages.dev`,注册账号,开始聊天。

### Optional: Custom Domain

1. In Cloudflare Pages dashboard → your project → **Custom domains** → **Set up a custom domain**
2. Enter e.g. `chat.yourname.com`
3. Follow CNAME instructions (auto if your domain is on Cloudflare)
4. SSL cert is issued automatically in 5-10 minutes

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

## 🔐 Your Privacy, Explained

- **We (DAO Message) don't see your deployment.** The Deploy Button takes you to Cloudflare/Vercel/Netlify's own site. We never get your credentials, your repo access, or your analytics.
- **Your messages are still zero-knowledge.** The PWA talks to the relay server (ours or yours — you can self-host that too) which only relays encrypted blobs. Neither your hosting platform nor the relay can read your chats.
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

Check browser DevTools → Console. You'll see messages like "WS connection failed". Possible causes:

- `VITE_API_BASE` is set to a bad URL — unset it to fall back to the official relay
- Your region blocks the relay server — you can self-host (see below)

### I want my own relay server (full self-hosted)

Relay server source is at `github.com/daomessage/securechat-relay` (coming soon — currently closed-source, on the roadmap to open). Until then, the official relay at `relay.daomessage.com` is the only option. It's zero-knowledge — it can't read your messages.

### How do I update to latest version?

1. Go to `github.com/<you>/securechat-pwa`
2. Click **"Sync fork"** → **"Update branch"**
3. Cloudflare / Vercel / Netlify auto-rebuilds and redeploys

### My users on iPhone can't receive notifications

- iOS requires the PWA to be **added to home screen first** before Web Push can be requested
- Guide users via Safari → Share → Add to Home Screen
- The built-in InstallBanner component will show this hint on iOS devices automatically

---

## 🤝 Advanced: Mobile App Clip (iOS)

Want to give iOS users a **one-tap install** that's smoother than "Add to Home Screen"? Use signed `.mobileconfig` (Web Clip) files.

See `docs/WEBCLIP_CERT_SETUP.md` in the main repo — explains how to buy a $15/year S/MIME cert and serve signed profiles.

---

## 🙋 Need Help?

- 💬 Main docs: [doc.daomessage.com](https://doc.daomessage.com)
- 🐛 Issues: [github.com/daomessage/securechat-pwa/issues](https://github.com/daomessage/securechat-pwa/issues)
- 📧 Contact: admin@daomessage.com

---

**Happy chatting!** 🔒
