/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean
    onSuccess?: (registration: ServiceWorkerRegistration) => void
    onError?: (error: Error) => void
  }): () => void
}
