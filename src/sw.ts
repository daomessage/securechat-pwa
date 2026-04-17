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

  // 🔴 Zero-knowledge: 推送不包含 conversationId，仅唤醒应用
  // WS 重连 + SDK sync 将自动获取所有新消息

  const promiseChain = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    // 优先聚焦现有窗口
    for (const client of windowClients) {
      if (client.url.includes(self.location.origin)) {
        return client.focus()
      }
    }
    // 没有现存窗口，新开一个
    return self.clients.openWindow('/')
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
