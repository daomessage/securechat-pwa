import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

// 注入 PWA 和 SDK 版本号到 __PWA_VERSION__ / __SDK_VERSION__ 供设置页显示
const __PWA_VERSION__ = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')).version
const __SDK_VERSION__ = JSON.parse(
  readFileSync(resolve(__dirname, 'node_modules/@daomessage_sdk/sdk/package.json'), 'utf8')
).version
const __BUILD_TIME__ = new Date().toISOString()

// git 信息(线上排障必须)—— 构建时捕获,failure-tolerant 因为 Cloudflare Pages build 环境也要能跑
function safeGitCmd(cmd: string, fallback: string): string {
  try {
    return execSync(cmd, { cwd: __dirname, encoding: 'utf8' }).trim() || fallback
  } catch {
    return fallback
  }
}
const __GIT_COMMIT__ = safeGitCmd('git rev-parse --short=8 HEAD', 'unknown')
const __GIT_BRANCH__ = safeGitCmd('git rev-parse --abbrev-ref HEAD', 'unknown')
const __GIT_DIRTY__ = safeGitCmd('git status --porcelain 2>/dev/null | head -c 1', '') ? '-dirty' : ''

// https://vite.dev/config/
export default defineConfig(({ mode }): UserConfig => ({
  define: {
    __PWA_VERSION__: JSON.stringify(__PWA_VERSION__),
    __SDK_VERSION__: JSON.stringify(__SDK_VERSION__),
    __BUILD_TIME__: JSON.stringify(__BUILD_TIME__),
    __GIT_COMMIT__: JSON.stringify(__GIT_COMMIT__ + __GIT_DIRTY__),
    __GIT_BRANCH__: JSON.stringify(__GIT_BRANCH__),
  },
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
