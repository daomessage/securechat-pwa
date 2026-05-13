/**
 * 关掉 SW 当前持有的所有系统通知。
 *
 * 背景: 后端 (relay-server 1.0.32+) 在 WS 在线时也会发 Push 兜底,
 * 因为 PWA 后台时浏览器会冻结主线程 JS, 不发 Push 用户就收不到通知。
 *
 * 副作用: PWA 在前台时会同时收到 WS 帧 + Push 通知, 用户看到"双份"。
 *
 * 解法 (PWA 特有): 此函数关掉 SW 当前的系统通知。Service Worker 是浏览器
 * 独有概念, Android/iOS native 端不需要这玩意 — 所以这个工具属于 App 层,
 * 不放在跨平台的 SDK 里。
 *
 * 注: PWA 当前主要的前台抑制策略是 sw.ts 的 push 事件处理器, 它通过
 * matchAll 检查 visible 客户端并立即 close。这里是双保险。
 */
export async function dismissPushNotifications(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const notifications = await reg.getNotifications({ tag: 'dao-message-notification' });
    for (const n of notifications) n.close();
  } catch {
    /* SW 不可用直接忽略 */
  }
}
