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
      // 检查是否有自定义标题或消息体（如果后端未来支持）
      if (payload.title) options.body = payload.title
      if (payload.body) options.body = payload.body
    } catch (e) {
      console.warn('[ServiceWorker] Push payload not JSON:', e)
    }
  }

  const promiseChain = self.registration.showNotification(title, options)
  event.waitUntil(promiseChain)
}) as EventListener)

// 通知点击事件处理
self.addEventListener('notificationclick', ((event: NotificationEvent) => {
  event.notification.close()

  // 🔴 Zero-knowledge: push payload 不含 conv_id (隐私保护)
  // 方案: SW 唤醒 app 后, 发 OPEN_LATEST_UNREAD 消息, 让 app 自己从本地 IDB
  //      找最新未读对话并跳转. App.tsx 监听 navigator.serviceWorker 的 message.

  const promiseChain = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(async (windowClients) => {
    // 1. 有已存在窗口 → 发消息 + focus
    for (const client of windowClients) {
      if (client.url.includes(self.location.origin)) {
        try {
          client.postMessage({ type: 'OPEN_LATEST_UNREAD' })
        } catch { /* ignore, focus 仍然有效 */ }
        return client.focus()
      }
    }
    // 2. 没窗口 → 打开新窗口, URL 带参数 ?open=latest
    //    App.tsx 冷启动读 URL 参数, 同样跳最新未读
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
