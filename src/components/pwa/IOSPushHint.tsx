/**
 * IOSPushHint — iOS PWA 通知授权引导横幅 · 1.0.46
 *
 * 背景: iOS Safari 要求 Notification.requestPermission() 必须在 user gesture
 * 同步上下文调用才能弹权限框。App.tsx 里在 restoreSession() 异步回调里调,
 * iOS 上必然静默失败 (Safari 直接拒绝弹框) → 用户不知道通知没开。
 *
 * 设置页已有"离线推送"按钮 (在 SettingsTab.tsx requestPush), 点击就是同步上下文,
 * 能正常弹权限框。但用户不知道要去那里点。
 *
 * 此横幅: iOS standalone PWA + 通知权限 default + iOS 支持 Web Push 时显示,
 *         点 → 切到 settings tab。
 * 不显示:
 *   - 非 iOS / 非 standalone (InstallGate 已处理装机)
 *   - iOS < 16.4 (没有 Web Push 能力,提示用户也没用)
 *   - 已授权 / 已拒绝
 *   - 7 天内 dismissed
 *
 * 用户点 × → 7 天内不再打扰。
 */

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { isIOS, isStandalone, iOSSupportsWebPush } from '../../lib/platform';

const DISMISS_KEY = 'ios_push_hint_dismissed_at';
const DISMISS_MS = 7 * 24 * 3600 * 1000; // 7 天
const SHOW_DELAY_MS = 4000; // 4 秒后才显示, 避免冷启动就打扰

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = parseInt(raw, 10);
    return !isNaN(at) && (Date.now() - at < DISMISS_MS);
  } catch {
    return false;
  }
}

export function IOSPushHint() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // DEBUG: ?push_hint_force=1 强制显示
    const force = (() => {
      try { return new URLSearchParams(location.search).get('push_hint_force') === '1' }
      catch { return false }
    })();

    if (!force) {
      if (!isIOS()) return;
      if (!isStandalone()) return;            // 浏览器模式不显示, InstallGate 会处理装机
      if (!iOSSupportsWebPush()) return;      // iOS < 16.4 没 Web Push, 提示也没用
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'default') return; // 已授权 / 已拒绝都不显示
      if (wasRecentlyDismissed()) return;
    }

    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  };

  const handleGoSettings = () => {
    setActiveTab('settings');
    setVisible(false);
  };

  return (
    <div
      className="relative z-40 mx-3 my-2 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
      role="region"
      aria-label="开启消息通知"
      style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
    >
      <div className="flex-none w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-300" aria-hidden>
        <Bell className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">开启消息通知</div>
        <div className="text-xs text-zinc-400 truncate">在设置中开启「离线推送」, 后台也能收到新消息</div>
      </div>
      <button
        onClick={handleGoSettings}
        className="flex-none px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-medium transition-colors"
      >
        去开启
      </button>
      <button
        onClick={handleDismiss}
        className="flex-none w-7 h-7 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 text-lg leading-none transition-colors"
        aria-label="关闭"
      >
        <X className="w-4 h-4 mx-auto" />
      </button>
    </div>
  );
}
