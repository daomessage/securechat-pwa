import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { useVisualViewport } from './hooks/useVisualViewport';
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
console.log('✅ [DAO Message PWA] v1.0.0 loaded');

function App() {
  const { route, activeChatId, setRoute, setSdkReady, setUserInfo, setActiveChatId, setDeferredPrompt } = useAppStore();
  const [goawayVisible, setGoawayVisible] = useState(false);

  // 全局键盘/视口监听 — 写 CSS 变量 --vv-height,iOS 键盘弹起时 ChatWindow 自动避让
  useVisualViewport();

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
  // 🔴 F05.3：SW 已不再发送 OPEN_CHAT 消息（零知识，push payload 不含 conv_id）
  // 保留此监听器仅用于向后兼容旧版 SW 缓存
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OPEN_CHAT' && event.data.conversationId) {
        if (event.data.conversationId !== 'default') setActiveChatId(event.data.conversationId);
        setRoute('main');
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, [setActiveChatId, setRoute]);

  // ② GOAWAY 监听：被其他设备踢下线时弹出全屏提示
  useEffect(() => {
    return client.on('goaway', (_reason) => {
      setGoawayVisible(true);
    });
  }, []);

  // ③ 冷启动检测（强制 active 标志位防止 React 18 并发抢占）
  useEffect(() => {
    let active = true; 
    
    client.restoreSession().then(session => {
      if (!active) return; 

      if (session) {
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get('chat_id') || params.get('chat');

        const nickname = session.nickname || localStorage.getItem('sc_nickname') || 'Me';
        setUserInfo('', session.aliasId, nickname);
        
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
                mod.onIncomingCall = (fromAlias: string) => {
                  useAppStore.getState().beginCall(fromAlias, 'video');
                };
                mod.onError = (err: Error) => {
                  console.error('[CallModule] error:', err);
                };
              }
            } catch (e) {
              console.error('[App] initCalls failed:', e);
            }
          }
        });
        initIMClient(); // SDK建立WebSocket

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
