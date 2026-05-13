/**
 * platform.ts — 浏览器/操作系统/PWA 状态检测的单一真相源
 *
 * 之前 InstallGate / InstallBanner / IOSPushHint / MessagesTab 各自实现了一遍
 * isStandalone / isIOS / isIPad / isIOSSafari, 违反 CLAUDE.md 「不重复实现」铁律。
 * 现在统一从这里 import。
 *
 * 所有函数都对 SSR / 不支持的浏览器返回保守的 false (永远不会抛 ReferenceError)。
 *
 * Debug 旁路:
 *   ?ios_test=1         → isIOS / isIOSSafari 强制 true
 *   ?ios_version=15.4   → iOSVersion() 强制返回此版本 (测旧 iOS 无 push 路径)
 *   ?force_standalone=1 → isStandalone 强制 true
 */

// ─── User Agent 检测 ────────────────────────────────────────

/** 用 URL ?ios_test=1 强制 iOS 路径(便于桌面浏览器测 iOS UI)*/
function isIOSDebugForced(): boolean {
  if (typeof location === 'undefined') return false;
  try {
    return new URLSearchParams(location.search).get('ios_test') === '1';
  } catch {
    return false;
  }
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIOSDebugForced()) return true;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)) return true;
  // iPadOS 13+ 把 UA 伪装成 Mac, 用 maxTouchPoints > 1 区分
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

export function isIPad(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIOSDebugForced()) {
    try { return new URLSearchParams(location.search).get('ipad') === '1'; }
    catch { return false; }
  }
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** iOS Safari (排除 iOS Chrome / Firefox / Edge, 它们不支持 add-to-home + Web Push) */
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIOSDebugForced()) return true;
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  // CriOS=Chrome iOS, FxiOS=Firefox iOS, EdgiOS=Edge iOS — 这些都套了 WebKit 但 add-to-home 走的是宿主浏览器
  if (/CriOS|FxiOS|EdgiOS/.test(ua)) return false;
  // iPadOS Safari 偶尔 UA 不带 "Safari" (Reader/Distill 模式), 用 isIPad 兜底
  return /Safari/.test(ua) || isIPad();
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mobile|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function isChromiumDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg|Brave/.test(ua) && !/Mobile|Android/.test(ua);
}

// ─── iOS 版本号(只在 isIOS=true 时有意义)─────────────────────

/**
 * 解析 iOS / iPadOS 主次版本号。
 * iOS UA 例: "...iPhone OS 16_4 like Mac OS X..." → { major: 16, minor: 4 }
 * iPadOS 13+ 伪装 Mac 时无版本号信息 (Apple 不暴露) → 返回 null
 *
 * Debug: ?ios_version=15.4 强制返回 { major: 15, minor: 4 }, 用于测 < 16.4 无 push 分支。
 */
export function iOSVersion(): { major: number; minor: number } | null {
  if (typeof navigator === 'undefined') return null;
  // Debug 强制版本
  try {
    const forced = new URLSearchParams(location.search).get('ios_version');
    if (forced) {
      const [maj, min = '0'] = forced.split('.');
      return { major: parseInt(maj, 10) || 0, minor: parseInt(min, 10) || 0 };
    }
  } catch { /* ignore */ }

  const ua = navigator.userAgent;
  const m = ua.match(/OS (\d+)_(\d+)/);
  if (m) return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10) };
  return null;
}

/** iOS 16.4+ 才有 Web Push (Apple 2023-03 加的). 旧版只能装主屏但收不到后台通知. */
export function iOSSupportsWebPush(): boolean {
  if (!isIOS()) return true; // 非 iOS 不在此函数判断范围,直接放行
  const v = iOSVersion();
  if (!v) {
    // iPadOS 伪装 Mac 拿不到版本号. iPadOS 13+ 都比较新, 保守认为支持.
    // 实际探测: Notification API 在 standalone 下可用即支持.
    return typeof Notification !== 'undefined';
  }
  if (v.major > 16) return true;
  if (v.major === 16 && v.minor >= 4) return true;
  return false;
}

// ─── PWA standalone 检测 ────────────────────────────────────

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(location.search).get('force_standalone') === '1') return true;
  } catch { /* ignore */ }
  const mm = window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari 用 navigator.standalone 而非 display-mode
  const iosStandalone = 'standalone' in window.navigator &&
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}

// ─── PWA installability 检测 (Chromium beforeinstallprompt) ──────

/**
 * 当前浏览器是否原生支持 add-to-home (Chromium 系列 + iOS Safari)。
 * 桌面 Firefox / iOS Chrome 等返回 false (用户必须手动书签等价物)。
 */
export function browserSupportsPWAInstall(): boolean {
  if (isIOSSafari()) return true;
  if (isChromiumDesktop()) return true;
  if (isAndroid() && /Chrome|Edg/.test(navigator.userAgent)) return true;
  return false;
}
