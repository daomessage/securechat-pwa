import { create } from 'zustand';

export type AppRoute = 
  | 'welcome' | 'generate_mnemonic' | 'confirm_backup'
  | 'vanity_shop'         // V1.4.0：注册流程靓号选号步骤
  | 'set_nickname' | 'recover' | 'main';
export type MainTab = 'messages' | 'channels' | 'contacts' | 'settings';

interface AppState {
  route: AppRoute;
  setRoute: (route: AppRoute) => void;

  // 注册流程中临时暂存助记词（只活在内存里）
  tempMnemonic: string;
  setTempMnemonic: (m: string) => void;

  sdkReady: boolean;
  setSdkReady: (ready: boolean) => void;

  // 仅存 UI 展示用的用户信息
  userId: string;
  aliasId: string;
  nickname: string;
  setUserInfo: (id: string, aliasId: string, name: string) => void;

  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;

  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;

  pendingRequestCount: number;
  setPendingRequestCount: (count: number) => void;

  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;

  // 未读消息计数
  unreadCounts: Record<string, number>;
  incrementUnread: (convId: string) => void;
  clearUnread: (convId: string) => void;

  // V1.4.1 方案 A：靓号在注册后通过 bind() 独立接口绑定，无需跨步骤传递订单 ID
  deferredPrompt: any | null;
  setDeferredPrompt: (prompt: any) => void;

  // ── 通话状态（全局浮层 CallScreen 使用）──
  callState: string | null;        // idle 时为 null，否则为 CallState 字面量
  callRemoteAlias: string;         // 对方 alias（主叫时从 ChatWindow 传入，被叫时从 onIncomingCall 传入）
  callType: 'audio' | 'video';     // 通话类型
  setCallState: (s: string | null) => void;
  beginCall: (remoteAlias: string, type: 'audio' | 'video') => void;
}

export const useAppStore = create<AppState>((set) => ({
  route: 'welcome',
  setRoute: (route) => set({ route }),
  tempMnemonic: '',
  setTempMnemonic: (tempMnemonic) => set({ tempMnemonic }),
  sdkReady: false,
  setSdkReady: (sdkReady) => set({ sdkReady }),
  userId: '', aliasId: '', nickname: '',
  setUserInfo: (userId, aliasId, nickname) => set({ userId, aliasId, nickname }),
  activeTab: 'messages',
  setActiveTab: (activeTab) => set({ activeTab }),
  activeChatId: null,
  setActiveChatId: (activeChatId) => set({ activeChatId }),
  pendingRequestCount: 0,
  setPendingRequestCount: (pendingRequestCount) => set({ pendingRequestCount }),
  activeChannelId: null,
  setActiveChannelId: (activeChannelId) => set({ activeChannelId }),
  unreadCounts: {},
  incrementUnread: (convId) => set((state) => ({
    unreadCounts: { ...state.unreadCounts, [convId]: (state.unreadCounts[convId] || 0) + 1 }
  })),
  clearUnread: (convId) => set((state) => {
    const next = { ...state.unreadCounts };
    delete next[convId];
    return { unreadCounts: next };
  }),
  deferredPrompt: null,
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),

  callState: null,
  callRemoteAlias: '',
  callType: 'video',
  setCallState: (callState) => set({ callState }),
  beginCall: (callRemoteAlias, callType) => set({ callRemoteAlias, callType }),
}));

/** 全局未读消息总量（在组件中使用 useAppStore(selectTotalUnread)） */
export const selectTotalUnread = (state: AppState): number =>
  Object.values(state.unreadCounts).reduce((sum, n) => sum + n, 0);
