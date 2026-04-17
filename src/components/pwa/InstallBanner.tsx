import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

/**
 * 跨平台 PWA 安装引导
 *
 *  ┌──────────┬────────────────────────────────────────────────┐
 *  │ 场景      │ 表现                                           │
 *  ├──────────┼────────────────────────────────────────────────┤
 *  │ 已安装    │ 什么都不渲染(用 display-mode: standalone 检测)│
 *  │ Android  │ 显示"一键安装"按钮 → 调用 deferredPrompt       │
 *  │ iOS 浏览器│ 显示一张"点分享 → 添加到主屏幕"的引导图         │
 *  │ 桌面 PC  │ 根据 beforeinstallprompt 支持情况显示按钮       │
 *  └──────────┴────────────────────────────────────────────────┘
 *
 * 用户点 × 关闭 → 7 天内不再打扰(存 localStorage)
 */

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_MS = 7 * 24 * 3600 * 1000; // 7 天

function isStandalone(): boolean {
  // iOS Safari 用 navigator.standalone,Android 和其他都用 matchMedia
  const mm = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = 'standalone' in window.navigator && (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}

// DEBUG: 支持 ?ios_test=1 / ?pwa_banner_force=1 强制显示(便于产品/QA 排查)
function debugForce(): 'ios' | 'android' | null {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('ios_test') === '1') return 'ios';
    if (q.get('pwa_banner_force') === 'android') return 'android';
  } catch { /* ignore */ }
  return null;
}

function isIOS(): boolean {
  if (debugForce() === 'ios') return true;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isIOSSafari(): boolean {
  if (debugForce() === 'ios') return true;
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  // CriOS = Chrome on iOS, FxiOS = Firefox on iOS,都不支持 "添加到主屏幕"
  if (/CriOS|FxiOS|EdgiOS/.test(ua)) return false;
  return /Safari/.test(ua);
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    return !isNaN(dismissedAt) && (Date.now() - dismissedAt < DISMISS_MS);
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const { deferredPrompt, setDeferredPrompt } = useAppStore();
  const [visible, setVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // 已经装了 → 不显示
    if (isStandalone()) return;
    // 最近关过 → 不显示
    if (wasRecentlyDismissed()) return;

    // Android / 桌面:等 beforeinstallprompt(App.tsx 已监听并塞进 store)
    // iOS Safari:直接显示引导
    // iOS 非 Safari(Chrome iOS 等):不支持,不显示
    if (isIOSSafari() || deferredPrompt) {
      setVisible(true);
    }
  }, [deferredPrompt]);

  if (!visible) return null;

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
      }
      // prompt 只能触发一次,触发后清掉
      setDeferredPrompt(null);
    } catch (e) {
      console.warn('[InstallBanner] Android install failed:', e);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
    setShowIOSGuide(false);
  };

  const handleShowIOSGuide = () => setShowIOSGuide(true);

  // iOS 全屏引导弹层
  if (showIOSGuide) {
    return (
      <div className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">添加到主屏幕</h3>
            <button onClick={handleDismiss} className="text-zinc-400 hover:text-white text-2xl leading-none" aria-label="关闭">×</button>
          </div>
          <p className="text-zinc-300 text-sm mb-5 leading-relaxed">
            装到主屏后即可全屏使用、接收推送通知,并获得更快启动速度。
          </p>
          <ol className="space-y-3 text-sm text-zinc-200">
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
              <span>
                点击底部的 <strong>分享按钮</strong>
                <span className="inline-block align-middle mx-1 text-blue-400" aria-hidden>
                  <svg width="18" height="22" viewBox="0 0 18 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9 1L5 5h3v9h2V5h3L9 1zM3 8v11h12V8h-3v2h1v7H5v-7h1V8H3z"/></svg>
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
              <span>向下滑动,选择 <strong>「添加到主屏幕」</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
              <span>点右上角 <strong>「添加」</strong> 完成</span>
            </li>
          </ol>
          <button
            onClick={handleDismiss}
            className="w-full mt-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    );
  }

  // 横幅(底部贴着内容,不阻塞)
  return (
    <div
      className="relative z-40 mx-3 my-2 flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600/10 border border-blue-500/30"
      role="region"
      aria-label="安装到主屏幕"
      style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
    >
      <div className="flex-none w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white text-lg" aria-hidden>
        📱
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">安装 DAO Message</div>
        <div className="text-xs text-zinc-400 truncate">添加到主屏获得推送通知和全屏体验</div>
      </div>
      {deferredPrompt ? (
        <button
          onClick={handleAndroidInstall}
          className="flex-none px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          安装
        </button>
      ) : (
        <button
          onClick={handleShowIOSGuide}
          className="flex-none px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          查看方法
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="flex-none w-7 h-7 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 text-lg leading-none transition-colors"
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  );
}
