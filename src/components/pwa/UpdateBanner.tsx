/**
 * UpdateBanner — 检测到新版 PWA 时顶部提示「刷新升级」 · 1.0.46
 *
 * 背景: iOS PWA 在 standalone 模式下 Service Worker 缓存非常激进, 用户经常
 *       开几天还是旧版, 错过修复 / 新功能。Android Chrome 也类似但好一些。
 *
 * 工作流程:
 *   1. main.tsx 里 registerSW({ onNeedRefresh: () => dispatchEvent('pwa:update-available') })
 *      监听 vite-plugin-pwa 的 SW updatefound 事件
 *   2. 本组件监听 window 的 pwa:update-available 自定义事件 → 显示横幅
 *   3. 用户点「立即刷新」→ 调 window.__pwa_update_sw(true) 触发 SW skipWaiting + reload
 *   4. 用户点 × → 关闭, 不存储 dismiss (下次启动只要还有新版还会再提示, 因为
 *      onNeedRefresh 在每次 SW updatefound 都会触发)
 *
 * 注: 不用 localStorage dismiss key — 用户故意忽略,但每次启动 SW 检测到新版仍会再提示,
 *     防止用户长期跑旧版。这是与 InstallGate / IOSPushHint 的关键区别(那两个是引导性,
 *     可以 7 天 dismiss; UpdateBanner 是关乎安全的版本一致性, 不可长期忽略)。
 */

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('pwa:update-available', handler);

    // DEBUG: ?update_force=1 强制显示
    try {
      if (new URLSearchParams(location.search).get('update_force') === '1') {
        setVisible(true);
      }
    } catch { /* ignore */ }

    return () => window.removeEventListener('pwa:update-available', handler);
  }, []);

  if (!visible) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const updateFn = (window as unknown as { __pwa_update_sw?: (reload?: boolean) => Promise<void> }).__pwa_update_sw;
      if (updateFn) {
        await updateFn(true); // true = 自动 reload
      } else {
        // fallback: 直接刷新
        location.reload();
      }
    } catch (e) {
      console.warn('[UpdateBanner] update failed:', e);
      location.reload(); // 兜底强制刷新
    }
  };

  return (
    <div
      className="relative z-40 mx-3 my-2 flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/15 border border-blue-500/40"
      role="region"
      aria-label="发现新版本"
      style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
    >
      <div className="flex-none w-9 h-9 rounded-lg bg-blue-500/25 flex items-center justify-center text-blue-300" aria-hidden>
        <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">发现新版本</div>
        <div className="text-xs text-zinc-400 truncate">刷新页面以获取最新修复和功能</div>
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex-none px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {refreshing ? '刷新中...' : '立即刷新'}
      </button>
      <button
        onClick={() => setVisible(false)}
        className="flex-none w-7 h-7 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 text-lg leading-none transition-colors"
        aria-label="稍后"
      >
        <X className="w-4 h-4 mx-auto" />
      </button>
    </div>
  );
}
