import { SecureChatClient } from '@daomessage_sdk/sdk';
import type { NetworkState as NS, StoredMessage, TypingEvent } from '@daomessage_sdk/sdk';
import { useAppStore } from '../store/appStore';
export type NetworkState = NS;

// 🔒 SDK：无参实例化，CORE_API_BASE 默认为生产域名
export const client = new SecureChatClient();

// 环境变量覆盖：start3.sh 本地开发时自动注入 VITE_API_BASE
// 生产构建不设此变量，自动使用 SDK 内置的生产地址
if (import.meta.env.VITE_API_BASE) {
  (client as any).http.setApiBase(import.meta.env.VITE_API_BASE);
}

export function initIMClient() {
  // connect() 是 async（P2-FIX-#11：先获取 ticket 再建连），fire-and-forget + catch 防 unhandled rejection
  client.connect().catch(err => console.warn('[WS] connect error:', err));
}

// ── 事件总线 ──
export const localMessageHandlers     = new Set<(msg: StoredMessage) => void>();
export const localStatusHandlers      = new Set<(status: { id: string; status: string }) => void>();
export const networkListeners         = new Set<(state: NetworkState) => void>();
export const localChannelPostHandlers = new Set<(data: any) => void>();
export const localTypingHandlers      = new Set<(data: TypingEvent) => void>();

// 分发
client.on('message',      (msg)    => {
  localMessageHandlers.forEach(h => h(msg));
  // 未读计数：非自己发的消息 && 当前不在该会话聊天界面
  if (!msg.isMe && msg.conversationId) {
    const { activeChatId, incrementUnread } = useAppStore.getState();
    if (activeChatId !== msg.conversationId) {
      incrementUnread(msg.conversationId);
    }
  }
});
client.on('status_change',(status) => localStatusHandlers.forEach(h => h(status)));
client.on('network_state',(state)  => networkListeners.forEach(h => h(state)));
client.on('channel_post', (data)   => localChannelPostHandlers.forEach(h => h(data)));
client.on('typing',       (data)   => localTypingHandlers.forEach(h => h(data)));

export function onNetworkStateChange(fn: (state: NetworkState) => void) {
  networkListeners.add(fn);
  return () => { networkListeners.delete(fn); };
}

/**
 * 类型安全的通话模块访问器（绕过 SDK 编译包类型樣板回落问题）
 * SecureChatClient.calls 属性在 initCalls() 后动态注入。
 */
export type CallModuleAny = {
  call(toAliasId: string, opts?: { audio?: boolean; video?: boolean }): Promise<void>;
  answer(): Promise<void>;
  reject(): void;
  hangup(): void;
  getLocalStream(): MediaStream | null;
  getRemoteStream(): MediaStream | null;
  onStateChange?: ((state: string) => void) | undefined;
  onRemoteStream?: ((stream: MediaStream) => void) | undefined;
  onLocalStream?: ((stream: MediaStream) => void) | undefined;
  onIncomingCall?: ((fromAlias: string, isVideo: boolean) => void) | undefined;
  onError?: ((err: Error) => void) | undefined;
};

export function getCallModule(): CallModuleAny | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).calls as CallModuleAny | null;
}
