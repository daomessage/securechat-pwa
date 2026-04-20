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

> ⚠️ **Prerequisite**: Before clicking the Deploy Button, you need to install the
> **Cloudflare Pages GitHub App** on your GitHub account **once**. Cloudflare can't
> read any repo (even public ones) without this. See **Step 0 below**.

### Step 0 · First-time only: Authorize GitHub ↔ Cloudflare

Skip this if you've deployed a CF Pages project before.

1. Open <https://dash.cloudflare.com/> — create/login to your Cloudflare account
2. Left sidebar → **Workers & Pages**
3. Click **Create application** → **Pages** tab → **Connect to Git**
4. Click **Connect GitHub**
5. In GitHub popup: choose **"All repositories"** (easiest) or **"Only select repositories"** (pick `securechat-pwa` after you fork it in Step 1 below)
6. Install the `Cloudflare Workers and Pages` app

Done. You only need to do this once per GitHub account.

### Step 1 · Fork our template

Because the Deploy Button can't clone someone else's repo directly (see troubleshooting), fork first:

1. Go to <https://github.com/daomessage/securechat-pwa>
2. Click **Fork** (top-right)
3. Fork lands at `github.com/<your-github-username>/securechat-pwa`

### Step 2 · Deploy

1. **Click the "Deploy to Cloudflare" button** in the main README,
   **or** directly visit:
   ```
   https://deploy.workers.cloudflare.com/?url=https://github.com/<your-github-username>/securechat-pwa
   ```
   (replace `<your-github-username>` with yours)
2. **"克隆存储库" 页面会拿到 repo 内容** (because it's now in your own GitHub account)
3. Click **Continue**
4. **Choose a project name** — default is fine, becomes `<name>.pages.dev`
5. Build settings are auto-detected from our `wrangler.toml` + `package.json`:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 22 (from `.node-version`)
6. Click **Create and deploy**
7. Wait ~90 seconds for build

**Done.** Open `<name>.pages.dev`, register, chat.

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
