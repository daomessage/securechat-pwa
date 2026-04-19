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
  // connect() 是 async，fire-and-forget + catch 防 unhandled rejection
  client.connect().catch(err => console.warn('[WS] connect error:', err));
}

// ── 事件总线（兼容层，保持 0.2.x Set 订阅接口）──
export const localMessageHandlers     = new Set<(msg: StoredMessage) => void>();
export const localStatusHandlers      = new Set<(status: { id: string; status: string }) => void>();
export const networkListeners         = new Set<(state: NetworkState) => void>();
export const localChannelPostHandlers = new Set<(data: any) => void>();
export const localTypingHandlers      = new Set<(data: TypingEvent) => void>();

// ── 把 0.4.0 Observable 流 bridge 成 Set 订阅 ──

// message：每条到达消息
client.events.message.subscribe((msg) => {
  if (!msg) return;
  localMessageHandlers.forEach(h => h(msg));
  // 未读计数
  if (!msg.isMe && msg.conversationId) {
    const { activeChatId, incrementUnread } = useAppStore.getState();
    if (activeChatId !== msg.conversationId) {
      incrementUnread(msg.conversationId);
    }
  }
});

// messageStatus：发送回执
client.events.messageStatus.subscribe((s) => {
  if (!s) return;
  localStatusHandlers.forEach(h => h(s));
});

// network
client.events.network.subscribe((state) => {
  networkListeners.forEach(h => h(state));
});

// channelPost
client.events.channelPost.subscribe((data) => {
  if (!data) return;
  localChannelPostHandlers.forEach(h => h(data));
});

// typing
client.events.typing.subscribe((ev) => {
  if (!ev) return;
  localTypingHandlers.forEach(h => h(ev));
});

export function onNetworkStateChange(fn: (state: NetworkState) => void) {
  networkListeners.add(fn);
  return () => { networkListeners.delete(fn); };
}

/**
 * 类型安全的通话模块访问器
 */
type Subscription = { unsubscribe(): void };
type ObservableLike<T> = {
  subscribe(cb: (v: T) => void): Subscription;
  readonly value: T;
};

export type CallModuleAny = {
  call(toAliasId: string, opts?: { audio?: boolean; video?: boolean }): Promise<void>;
  answer(): Promise<void>;
  reject(): void;
  hangup(): void;
  getLocalStream(): MediaStream | null;
  getRemoteStream(): MediaStream | null;
  // 响应式订阅(首选) — CallScreen 用这两个避免 onLocalStream 赋值的 React ref 竞态
  observeLocalStream(): ObservableLike<MediaStream | null>;
  observeRemoteStream(): ObservableLike<MediaStream | null>;
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
