import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }): UserConfig => ({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        id: '/',
        name: 'DAO Message',
        short_name: 'DAO Message',
        description: '零知识端对端加密通讯，基于 DAO MESSAGE 协议。',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: 'screenshot-mobile.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'SecureChat — 安全加密私信'
          },
          {
            src: 'screenshot-desktop.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'SecureChat Desktop — E2EE Messenger'
          }
        ]
      }
    })
  ],
  // 生产构建:只 drop debugger,保留 console.*
  // 之前全 drop console 导致 1.0.3/1.0.7 线上排障时 console.error 全部消失,
  // 用户报 "没反应" 时没办法看 SDK 执行到哪一步。
  // console.log 量不大,留着;console.error/warn 是排障生命线,必须保留。
  esbuild: mode === 'production'
    ? ({ drop: ['debugger'] } as unknown as UserConfig['esbuild'])
    : undefined,
  build: {
    // 生产环境禁用 sourcemap,避免源码外泄
    sourcemap: false,
    minify: mode === 'production' ? true : false,
    rolldownOptions: mode === 'production'
      ? {
          output: {
            minify: {
              compress: {
                dropConsole: false,
                dropDebugger: true,
              },
            },
          },
        }
      : undefined,
  },
  preview: {
    allowedHosts: ['chat.daomessage.com', 'daomessage.com', 'www.daomessage.com', 'chat.webtool.space'],
  },
}))
