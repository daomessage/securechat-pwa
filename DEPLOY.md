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

1. **Click the button** on the main README → takes you to `deploy.workers.cloudflare.com`
2. **Sign in / create a Cloudflare account** (if you don't have one — it's free)
3. **Authorize Cloudflare to access your GitHub** (one-time "Install Cloudflare Pages" app on your GitHub)
4. **Choose a project name** — default `<your-github>-daomessage` is fine. This becomes `<name>.pages.dev`
5. **Click "Create and deploy"** — Cloudflare will:
   - Fork `daomessage/securechat-pwa` to your GitHub
   - Run `npm run build`
   - Publish to `<name>.pages.dev`
6. **Wait ~90 seconds.** You'll see a success page with your URL.

**Done.** Open the URL, register an account, and start chatting.

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
