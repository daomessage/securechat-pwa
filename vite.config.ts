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
  // Vite 8+ 默认用 rolldown 打包,minify 用 oxc 引擎。
  // 剥离 console/debugger 通过 `build.minifyOptions.compress.drop{Console,Debugger}` 配置。
  // 旧 Vite(esbuild) 分支保留兼容。
  esbuild: mode === 'production'
    ? ({ drop: ['console', 'debugger'] } as unknown as UserConfig['esbuild'])
    : undefined,
  build: {
    // 生产环境禁用 sourcemap,避免源码外泄
    sourcemap: false,
    // Vite 8 默认 minify=oxc(rolldown 内置);这里保持默认
    minify: mode === 'production' ? true : false,
    // 通过 rolldown 的 output.minify 传入完整 MinifyOptions,剥离 console/debugger
    rolldownOptions: mode === 'production'
      ? {
          output: {
            minify: {
              compress: {
                dropConsole: true,
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
