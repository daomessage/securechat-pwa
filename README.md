# DAO MESSAGE - Web PWA Starter Template

This is the official Web/PWA boilerplate for building applications on top of the **DAO MESSAGE Zero-Knowledge Protocol**. This starter kit completely decouples the cryptographic and real-time messaging logic from the UI, allowing you to focus entirely on building your frontend experience.

## 🚀 Deploy in One Click

No command line required. Pick a platform:

### Vercel / Netlify — 直接点按钮即可

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/daomessage/securechat-pwa&project-name=my-daomessage&repository-name=my-daomessage)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/daomessage/securechat-pwa)

Vercel / Netlify 会自动帮你 fork 到你的 GitHub,然后部署。2 分钟拿到 `<x>.vercel.app` / `<x>.netlify.app`。

### Cloudflare Pages — 3 步手动(官方 Deploy Button 踩坑)

> ⚠️ **不要**用 `deploy.workers.cloudflare.com` 那种"Deploy Button"—— 它会把我们当成 Worker,
> 误预填 `npx wrangler deploy`,导致构建失败。手动 3 步最稳。

1. **Fork 模板** → [点这里 fork](https://github.com/daomessage/securechat-pwa/fork) 到你的 GitHub
2. **打开 CF Pages 新建页** → [dash.cloudflare.com Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages)
3. **Connect to Git** → 选你刚 fork 的 `securechat-pwa` → 保持默认(`npm run build` / `dist`)→ 点 Deploy

2-3 分钟拿到 `<你的项目名>.pages.dev`,中国访问最快。完整截图教程见 **[DEPLOY.md](./DEPLOY.md)**。

### GitHub Pages — 只需 Fork + 启用 Pages

最简单,**不需要任何第三方平台账号**,只用你的 GitHub:

1. **Fork 模板** → [点这里 fork](https://github.com/daomessage/securechat-pwa/fork)
2. Fork 仓库 → **Settings → Pages → Source 选 "GitHub Actions"**
3. 等内置的 workflow 跑完(~2 分钟)
4. 访问 `https://<你的用户名>.github.io/securechat-pwa/`

完全免费,但**中国大陆访问 github.io 不稳**。适合海外用户。详见 [DEPLOY.md](./DEPLOY.md)。

---

所有平台的站都连接免费公共 relay `relay.daomessage.com`(零知识,端到端加密)。详见 **[DEPLOY.md](./DEPLOY.md)** 完整教程和故障排查。

---

## ✨ Features
- **UI Framework:** React 19 + Vite 8
- **Styling:** Tailwind CSS 4
- **State Management:** Zustand
- **Real-Time Engine:** Official `@daomessage_sdk/sdk` (handles E2EE, Websocket, IndexDB storage)
- **PWA Ready:** Includes Service Worker configurations for Web Push Notifications

## 🛠️ Or Run Locally

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env.local` and configure your API endpoint:
   ```env
   VITE_API_URL=https://relay.daomessage.com
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📂 Directory Structure

```text
src/
├── components/      # UI components (Build your layouts here)
├── store/           # Zustand state management (App level states)
├── App.tsx          # Main entry and Routing
├── main.tsx         # React root
└── sw.ts            # Service Worker for push notifications & background sync
```

## 🔒 Security Note
All cryptographic operations (Ed25519 & X25519), key generation, message encryption/decryption, and local database (IndexedDB) persistence are natively handled by the underlying SDK. **Do not modify the key-exchange or push notification logic unless you know what you are doing.**

For more details on the SDK API, visit the [DAO MESSAGE Documentation](https://doc.daomessage.com).
