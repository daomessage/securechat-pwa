# DAO MESSAGE - Web PWA Starter Template

This is the official Web/PWA boilerplate for building applications on top of the **DAO MESSAGE Zero-Knowledge Protocol**. This starter kit completely decouples the cryptographic and real-time messaging logic from the UI, allowing you to focus entirely on building your frontend experience.

## 🚀 Deploy in One Click

No command line required. Pick a platform:

### Vercel / Netlify — 直接点按钮即可

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/daomessage/securechat-pwa&project-name=my-daomessage&repository-name=my-daomessage)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/daomessage/securechat-pwa)

Vercel / Netlify 会自动帮你 fork 到你的 GitHub,然后部署。2 分钟拿到 `<x>.vercel.app` / `<x>.netlify.app`。

### Cloudflare — 需要先 fork(2 步)

Cloudflare 要求你先 fork 到自己 GitHub,它才能读到仓库内容:

1. 点 **[Fork this repository](https://github.com/daomessage/securechat-pwa/fork)** 到你的 GitHub
2. 点 [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/daomessage/securechat-pwa) — 在 URL 输入框里把 `daomessage` 改成你的 GitHub 用户名

部署完拿到 `<x>.pages.dev`,中国用户访问最快。

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
