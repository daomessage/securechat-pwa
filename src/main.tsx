import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { registerSW } from 'virtual:pwa-register';

// 显式激活 ServiceWorker 代理，允许触发浏览器底层的 PWA 安装横幅。
// 1.0.46: 加 onNeedRefresh 回调, 检测到新版 SW 时挂全局事件, UpdateBanner 监听后弹提示。
// iOS PWA 在 standalone 模式下 SW 缓存激进, 用户经常开几天还是旧版 — 用户需要主动提示。
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // 派发自定义事件给 React 层 (UpdateBanner 监听), 不直接弹 alert
    window.dispatchEvent(new CustomEvent('pwa:update-available'));
  },
  onOfflineReady() {
    console.log('[PWA] offline ready');
  },
});
// 让 UpdateBanner 通过 window 全局拿到 updateSW 函数(用户点"刷新"时调它)
(window as unknown as { __pwa_update_sw?: (reload?: boolean) => Promise<void> }).__pwa_update_sw = updateSW;

// 扫码加好友用 @yudiel/react-qr-scanner → barcode-detector → zxing-wasm
// 默认从 CDN (fastly.jsdelivr.net) 拉 WASM,被本站 CSP connect-src 拦截。
// 把 WASM 指向本地 /wasm/ 路径(已 cp 到 public/wasm/),符合零知识应用不依赖第三方 CDN 的原则。
import { setZXingModuleOverrides } from 'barcode-detector/pure';
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => {
    if (path.endsWith('.wasm')) return '/wasm/' + path;
    return prefix + path;
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
