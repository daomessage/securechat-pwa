# DAO MESSAGE - Web PWA Starter Template

This is the official Web/PWA boilerplate for building applications on top of the **DAO MESSAGE Zero-Knowledge Protocol**. This starter kit completely decouples the cryptographic and real-time messaging logic from the UI, allowing you to focus entirely on building your frontend experience.

## ✨ Features
- **UI Framework:** React 19 + Vite 8
- **Styling:** Tailwind CSS 4
- **State Management:** Zustand
- **Real-Time Engine:** Official `@daomessage_sdk/sdk` (handles E2EE, Websocket, IndexDB storage)
- **PWA Ready:** Includes Service Worker configurations for Web Push Notifications

## 🚀 Quick Start

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
