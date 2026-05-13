import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { clientsClaim } from 'workbox-core'

// Fix generic TypeScript issues
declare let self: ServiceWorkerGlobalScope & typeof globalThis;

// 新 SW 安装后立即接管，不等旧页面关闭（解决 rebuild 后刷新仍用旧缓存的问题）
self.skipWaiting()
clientsClaim()

// 清理旧版本的 precache 缓存
cleanupOutdatedCaches()

// Workbox injects the precache manifest here during build
precacheAndRoute(self.__WB_MANIFEST || [])

// 离线 fallback：document 请求失败时返回 index.html
registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      {
        handlerDidError: async () => {
          try {
            return await caches.match('/index.html');
          } catch {
            return new Response('offline', { status: 503 });
          }
        }
      }
    ]
  })
)

// API 请求：优先使用网络，降级到缓存
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api' })
)

// 图片/资源：优先使用缓存，再请求更新
registerRoute(
  ({ request }) => ['image', 'style', 'script', 'font'].includes(request.destination),
  new CacheFirst({ cacheName: 'assets' })
)

// Push 通知事件处理
self.addEventListener('push', ((event: PushEvent) => {
  // 🔴 Zero-knowledge: only show generic notification, never leak E2EE contents
  // 服务端推送仅包含 { type: "new_msg" }，不包含 conv_id（F05.3 隐私加固）

  const title = 'DAO Message'
  const options: NotificationOptions & { vibrate?: number[] } = {
    body: '你有一条新消息',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'dao-message-notification',
    data: {},
    vibrate: [200, 100, 200],
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      console.log('[ServiceWorker] Push received:', payload)
      if (payload.title) options.body = payload.title
      if (payload.body) options.body = payload.body
    } catch (e) {
      console.warn('[ServiceWorker] Push payload not JSON:', e)
    }
  }

  // 1.0.32: 前台抑制 — 后端 WS 在线也发推送（保证 PWA 后台能收到），但前台时
  //   PWA 已经能通过 WS 帧实时显示消息，不需要系统通知打扰。
  //   策略：仍调 showNotification 满足 userVisibleOnly 的 budget 要求,
  //   但若有 visible 客户端就立即 close 掉,用户实际感知不到通知。
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const hasVisibleClient = clientList.some(c => c.visibilityState === 'visible')

    if (hasVisibleClient) {
      await self.registration.showNotification(title, { ...options, silent: true })
      const ns = await self.registration.getNotifications({ tag: 'dao-message-notification' })
      ns.forEach(n => n.close())
      return
    }

    await self.registration.showNotification(title, options)
  })())
}) as EventListener)

// 通知点击事件处理
self.addEventListener('notificationclick', ((event: NotificationEvent) => {
  event.notification.close()

  // 🔴 Zero-knowledge: push payload 不含 conv_id (隐私保护)
  // 已有窗口 → postMessage + navigate URL (而不是 focus, 避免 MIUI 拦截 BAL)
  // 没窗口 → openWindow (此时 PWA 死了, MIUI 可能拒绝, 这是 PWA 原生限制)

  const promiseChain = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(async (windowClients) => {
    // 1. 有已存在窗口 (PWA 还活着, 可能在后台) → 优先用 navigate
    //    navigate 不需要新启 Activity, 只是给已有 WebContents 换 URL,
    //    避免 MIUI 拦截 "Chrome 后台启动 WebAPK Activity"
    for (const client of windowClients) {
      if (client.url.includes(self.location.origin)) {
        try {
          // 先发消息 (如果窗口是 focused 的, App.tsx 立即处理跳转)
          client.postMessage({ type: 'OPEN_LATEST_UNREAD' })
          // 再 focus (focus 可能因 MIUI 失败, 但先尝试)
          if ('focus' in client) {
            try { return await (client as WindowClient).focus() } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        return client
      }
    }
    // 2. 没窗口 → openWindow 新启 PWA (?open=latest 让 App.tsx 跳最新对话)
    //    在 MIUI 等严格 ROM 上,Chrome 后台启动 WebAPK Activity 可能被系统拦截。
    //    这是 PWA 原生限制 — 用户必须手动从主屏图标启动 PWA 后,推送通知点击才能正常跳转。
    return self.clients.openWindow('/?open=latest')
  })

  event.waitUntil(promiseChain)
}) as EventListener)

// 来自主线程的消息处理（用于升级提示等）
self.addEventListener('message', ((event: ExtendableMessageEvent) => {
  // 支持 SKIP_WAITING 消息用于 PWA 更新提示
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
}) as EventListener)
