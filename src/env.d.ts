/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean
    onSuccess?: (registration: ServiceWorkerRegistration) => void
    onError?: (error: Error) => void
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
  }): (reloadPage?: boolean) => Promise<void>
}
