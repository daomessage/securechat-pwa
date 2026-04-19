import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { registerSW } from 'virtual:pwa-register';

// 显式激活 ServiceWorker 代理，允许触发浏览器底层的 PWA PWA 安装横幅
registerSW({ immediate: true });

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
