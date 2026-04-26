import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { Welcome }          from './components/onboarding/Welcome';
import { GenerateMnemonic } from './components/onboarding/GenerateMnemonic';
import { ConfirmBackup }   from './components/onboarding/ConfirmBackup';
import { VanityShop }      from './components/onboarding/VanityShop';
import { SetNickname }      from './components/onboarding/SetNickname';
import { Recover }          from './components/onboarding/Recover';
import { MainLayout }       from './components/main/MainLayout';
import { ChatWindow }       from './components/chat/ChatWindow';
import { CallScreen }       from './components/chat/CallScreen';
import { initIMClient, client, getCallModule } from './lib/imClient';
import { clearIdentity, loadIdentity, deriveIdentity } from '@daomessage_sdk/sdk';

// ⚡ 版本戳：如果 Console 里能看到这行，说明浏览器已加载最新代码
console.log('🔥 [SecureChat] BUILD v1.0.20 (2026-04-26) loaded');

function App() {
  const { route, activeChatId, setRoute, setSdkReady, setUserInfo, setActiveChatId, setDeferredPrompt } = useAppStore();
  const [goawayVisible, setGoawayVisible] = useState(false);

  // ① 📦 拦截 Chrome PWA 安装事件
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [setDeferredPrompt]);

  // ① 👤 App：监听 ServiceWorker 消息（PWA 后台被通知点击唤醒）
  // 🔴 F05.3: push payload 零知识不含 conv_id. SW 收通知点击后发 OPEN_LATEST_UNREAD 消息,
  // App 侧从 unreadCounts 找最大未读的对话并跳转.
  // 同时保留 OPEN_CHAT 向后兼容旧 SW 缓存.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'OPEN_CHAT' && data.conversationId) {
        // 向后兼容: 旧 SW 还可能带 conv_id
        if (data.conversationId !== 'default') setActiveChatId(data.conversationId);
        setRoute('main');
        return;
      }

      if (data.type === 'OPEN_LATEST_UNREAD') {
        // 从 store 选 unreadCount 最大的对话
        const unread = useAppStore.getState().unreadCounts;
        let bestConv: string | null = null;
        let bestCount = 0;
        for (const [convId, count] of Object.entries(unread)) {
          if (count > bestCount) {
            bestCount = count;
            bestConv = convId;
          }
        }
        if (bestConv) {
          setActiveChatId(bestConv);
        }
        // 无未读(可能对端撤回 / 状态同步滞后)也至少把 app 带回主页
        setRoute('main');
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, [setActiveChatId, setRoute]);

  // 冷启动 URL 带 ?open=latest (SW 新开窗口场景) - 同样跳最新未读
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('open') === 'latest') {
      // 清 URL 避免刷新时重复跳转
      window.history.replaceState({}, document.title, window.location.pathname);
      // 延迟 500ms 等 SDK 加载本地 IDB 填充 unreadCounts
      setTimeout(() => {
        const unread = useAppStore.getState().unreadCounts;
        let bestConv: string | null = null;
        let bestCount = 0;
        for (const [convId, count] of Object.entries(unread)) {
          if (count > bestCount) { bestCount = count; bestConv = convId; }
        }
        if (bestConv) {
          setActiveChatId(bestConv);
          setRoute('main');
        }
      }, 500);
    }
  }, [setActiveChatId, setRoute]);

  // ② GOAWAY 监听：被其他设备踢下线时弹出全屏提示
  useEffect(() => {
    const sub = client.events.goaway.subscribe((ev) => {
      if (ev) setGoawayVisible(true);
    });
    return () => sub.unsubscribe();
  }, []);

  // ③ 冷启动检测（强制 active 标志位防止 React 18 并发抢占）
  useEffect(() => {
    let active = true; 
    
    client.auth.restoreSession().then(session => {
      if (!active) return; 

      if (session) {
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get('chat');

        const nickname = session.nickname || localStorage.getItem('sc_nickname') || 'Me';
        setUserInfo('', session.aliasId, nickname);
        
        // initCalls 必须在 initIMClient (WS connect) 之前完成，
        // 否则 WS 建立后来电信令到达时 CallModule 还是 null，导致第一次来电无法响应。
        // loadIdentity 是异步，所以把 initIMClient 移到其 then 链里串行执行。
        loadIdentity().then(ident => {
          if (ident && ident.mnemonic) {
            try {
              const fullIdent = deriveIdentity(ident.mnemonic);
              client.initCalls({
                myAliasId: session.aliasId,
                signingPrivKey: fullIdent.signingKey.privateKey,
                signingPubKey: fullIdent.signingKey.publicKey
              });
              // 注册来电事件回调：使全局 CallScreen 能接收事件
              const mod = getCallModule();
              if (mod) {
                mod.onStateChange = (state: string) => {
                  useAppStore.getState().setCallState(state === 'idle' ? null : state);
                  if (['hangup', 'ended', 'rejected'].includes(state)) {
                    setTimeout(() => useAppStore.getState().setCallState(null), 1500);
                  }
                };
                mod.onIncomingCall = (fromAlias: string, isVideo: boolean) => {
                  // 根据对端 SDP m=video 判断是音频还是视频来电, UI 响铃界面据此渲染
                  useAppStore.getState().beginCall(fromAlias, isVideo ? 'video' : 'audio');
                };
                mod.onError = (err: Error) => {
                  console.error('[CallModule] error:', err);
                };
              }
            } catch (e) {
              console.error('[App] initCalls failed:', e);
            }
          }
          // WS 在 CallModule 初始化完成后才建立连接，确保来电信令到达时回调已注册
          initIMClient();
        }).catch(e => {
          console.error('[App] loadIdentity failed:', e);
          // identity 加载失败也要建立 WS（消息功能不受通话影响）
          initIMClient();
        });

        if (chatId && chatId !== 'default') {
          setActiveChatId(chatId);
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // 推送通知：请求权限 + 注册 VAPID 订阅
        if ('Notification' in window && navigator.serviceWorker) {
          const tryEnablePush = async () => {
            try {
              // 首次用户：请求通知权限
              if (Notification.permission === 'default') {
                await Notification.requestPermission();
              }
              if (Notification.permission === 'granted') {
                const reg = await navigator.serviceWorker.ready;
                await client.push.enablePushNotifications(reg);
              }
            } catch (e) {
              console.warn('[Push] 推送注册跳过:', e);
            }
          };
          tryEnablePush();
        }

        setSdkReady(true);
        setRoute('main');
      } else {
        setRoute('welcome');
      }
    }).catch(() => {
      if (active) setRoute('welcome');
    });

    return () => { active = false; };
  }, [setUserInfo, setRoute, setActiveChatId, setSdkReady]);

  // GOAWAY 全屏弹窗
  if (goawayVisible) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
        <div className="bg-zinc-900 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl border border-zinc-700/50">
          <div className="text-5xl mb-4">📱</div>
          <h2 className="text-xl font-bold text-zinc-50 mb-3">已在其他设备登录</h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            您的账号已在另一台设备上登录。为保障安全，当前设备已断开连接。
          </p>
          <button
            onClick={async () => {
              await clearIdentity();
              localStorage.removeItem('sc_nickname');
              setSdkReady(false);
              setActiveChatId(null);
              setGoawayVisible(false);
              setRoute('welcome');
            }}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    );
  }

  switch (route) {
    case 'welcome':           return <Welcome />;
    case 'generate_mnemonic': return <GenerateMnemonic />;
    case 'confirm_backup':    return <ConfirmBackup />;
    case 'vanity_shop':       return <VanityShop />;   {/* V1.4.0 */}
    case 'set_nickname':      return <SetNickname />;
    case 'recover':           return <Recover />;
    case 'main':
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 relative">
          {activeChatId ? <ChatWindow /> : <MainLayout />}
          {/* 全局浮层：只在通话时显示，浮在所有路由之上 */}
          <CallScreen />
        </div>
      );
    default: return <Welcome />;
  }
}
export default App;
