import { useEffect, useState, type ReactNode } from 'react';
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
import { Splash }            from './components/Splash';
import { InstallGate }       from './components/pwa/InstallGate';
import { initIMClient, client, getCallModule } from './lib/imClient';
import { listSessions } from '@daomessage_sdk/sdk';
import { clearIdentity, loadIdentity, deriveIdentity } from '@daomessage_sdk/sdk';

// ⚡ 版本戳：如果 Console 里能看到这行，说明浏览器已加载最新代码
console.log('🔥 [SecureChat] BUILD v1.0.48 (2026-05-13) — SDK 1.0.39 PushNotificationError + diagnose() + Settings 推送错误 toast + PwaDiagnostics 增强');

function App() {
  const { route, activeChatId, setRoute, setSdkReady, setUserInfo, setActiveChatId, setDeferredPrompt } = useAppStore();
  const [goawayVisible, setGoawayVisible] = useState(false);
  const [goawayReason, setGoawayReason] = useState<string>('');

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
        let attempts = 0;
        const maxAttempts = 20;
        const tryJump = async () => {
          attempts += 1;
          try {
            const sessions = await listSessions();
            let bestConv: string | null = null;
            let bestTime = 0;
            for (const s of sessions) {
              const history = await client.messages.getHistory(s.conversationId);
              const last = history[history.length - 1];
              const t = last?.time || s.createdAt || 0;
              if (t > bestTime) {
                bestTime = t;
                bestConv = s.conversationId;
              }
            }
            if (bestConv) {
              setActiveChatId(bestConv);
              setRoute('main');
              return;
            }
          } catch (e) {
            console.warn('[App] OPEN_LATEST_UNREAD try', attempts, 'failed:', e);
          }
          if (attempts < maxAttempts) {
            setTimeout(tryJump, 400);
          } else {
            setRoute('main');
          }
        };
        tryJump();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, [setActiveChatId, setRoute]);

  // 冷启动 URL 带 ?open=latest (SW 新开窗口场景) - 跳到最近有消息的对话
  // 不依赖 unreadCounts (它需要 SDK 实时 message 事件触发, 时序敏感)
  // 改用 SDK 拉所有 sessions, 取每个 conv 最后一条消息时间, 选最新的那个
  // 这样冷启动只要 sessions/messages IndexedDB 加载完就能跳, 比等 inbox 拉完早很多
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('open') !== 'latest') return;
    window.history.replaceState({}, document.title, window.location.pathname);

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;  // 30 × 400ms = 12 秒上限 (冷启动 IDB 加载可能慢)

    const tryJump = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const sessions = await listSessions();
        if (cancelled) return;
        let bestConv: string | null = null;
        let bestTime = 0;
        for (const s of sessions) {
          const history = await client.messages.getHistory(s.conversationId);
          const last = history[history.length - 1];
          const t = last?.time || s.createdAt || 0;
          if (t > bestTime) {
            bestTime = t;
            bestConv = s.conversationId;
          }
        }
        if (cancelled) return;
        if (bestConv) {
          setActiveChatId(bestConv);
          setRoute('main');
          return;
        }
      } catch (e) {
        console.warn('[App] open=latest try', attempts, 'failed:', e);
      }
      if (attempts < maxAttempts) {
        setTimeout(tryJump, 400);
      } else {
        setRoute('main');
      }
    };
    setTimeout(tryJump, 200);

    return () => { cancelled = true; };
  }, [setActiveChatId, setRoute]);

  // ② GOAWAY 监听:根据 reason 区分行为
  //   new_device_login → 真·下线,弹窗 + logout + 跳 welcome
  //   jwt_revoked      → JWT 被服务端撤销:自动 restoreSession 拿新 JTI 自愈,超 3 次才弹窗
  //   server_shutdown / network_reset → 静默自动重连,不打扰用户
  //   其他/未知       → 弹"连接断开"提示,允许重连,不 logout
  useEffect(() => {
    let jwtRevokedHealCount = 0;
    let newDeviceHealAttempted = false;
    const sub = client.events.goaway.subscribe(async (ev) => {
      if (!ev) return;
      const reason = ev.reason || 'unknown';
      console.warn('[App] GOAWAY reason=', reason);
      if (reason === 'server_shutdown' || reason === 'network_reset') {
        // 良性断开:SDK 自己重连
        try {
          await client.disconnect();
          await new Promise(r => setTimeout(r, 500));
          await client.connect();
        } catch (e) {
          console.warn('[App] auto-reconnect failed:', e);
        }
        return;
      }
      // P1-E(2026-04-26): new_device_login 收到时先复活一次再 logout。
      // 服务端 P0-A 已对 same-JTI 不发此 reason,但万一服务端版本未更新仍可能误报,
      // 客户端先 reconnect 一次:能复活就说明确实是误判;再次被踢才走清身份+logout。
      if (reason === 'new_device_login' && !newDeviceHealAttempted) {
        newDeviceHealAttempted = true;
        console.warn('[App] new_device_login 先尝试复活一次...');
        try {
          await client.disconnect();
          await new Promise(r => setTimeout(r, 500));
          await client.connect();
          console.info('[App] new_device_login 复活成功 — 判定为误踢');
          // 给一段冷却时间,30s 内不再触发复活,避免循环
          setTimeout(() => { newDeviceHealAttempted = false; }, 30_000);
        } catch (e) {
          console.warn('[App] new_device_login 复活失败,真·下线:', e);
          setGoawayReason(reason);
          setGoawayVisible(true);
        }
        return;
      }
      if (reason === 'jwt_revoked') {
        if (jwtRevokedHealCount >= 3) {
          console.warn('[App] jwt_revoked 自愈已超 3 次,放弃 → 弹窗');
          setGoawayReason(reason);
          setGoawayVisible(true);
          return;
        }
        jwtRevokedHealCount++;
        console.warn(`[App] jwt_revoked 自愈尝试 #${jwtRevokedHealCount}`);
        try {
          await client.disconnect();
          // 必须强制重新认证(restoreSession 现在是幂等的,不会刷新 JWT)
          const session = await client.auth.reauthenticate();
          if (session) {
            await client.connect();
            console.info(`[App] jwt_revoked 自愈成功 #${jwtRevokedHealCount}`);
          } else {
            setGoawayReason(reason);
            setGoawayVisible(true);
          }
        } catch (e) {
          console.warn('[App] jwt_revoked 自愈失败:', e);
          setGoawayReason(reason);
          setGoawayVisible(true);
        }
        return;
      }
      setGoawayReason(reason);
      setGoawayVisible(true);
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
                  // 终止态(hangup/rejected/ended) 后停留 2.5s 让用户看清"00:35 · 通话已结束"
                  // 之前 1.5s 用户体感"立即消失",2.5s 才有"通话自然结束"的感觉
                  if (['hangup', 'ended', 'rejected'].includes(state)) {
                    setTimeout(() => useAppStore.getState().setCallState(null), 2500);
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
    const isHardKick = goawayReason === 'new_device_login' || goawayReason === 'jwt_revoked';
    const title = isHardKick
      ? (goawayReason === 'jwt_revoked' ? '登录凭证已失效' : '已在其他设备登录')
      : '连接已断开';
    const desc = goawayReason === 'new_device_login'
      ? '您的账号已在另一台设备上登录。为保障安全,当前设备已断开连接。'
      : goawayReason === 'jwt_revoked'
        ? '登录凭证已失效,请重新登录。'
        : `服务端断开了连接(原因:${goawayReason})。点击重连。`;
    const btnLabel = isHardKick ? '确认' : '重连';
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
        <div className="bg-zinc-900 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl border border-zinc-700/50">
          <div className="text-5xl mb-4">{isHardKick ? '📱' : '🔌'}</div>
          <h2 className="text-xl font-bold text-zinc-50 mb-3">{title}</h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{desc}</p>
          <button
            onClick={async () => {
              setGoawayVisible(false);
              if (isHardKick) {
                // 真·下线:清本地身份并跳 welcome
                await clearIdentity();
                localStorage.removeItem('sc_nickname');
                setSdkReady(false);
                setActiveChatId(null);
                setRoute('welcome');
              } else {
                // 软下线:尝试重连,保留身份
                try {
                  await client.disconnect();
                  await new Promise(r => setTimeout(r, 500));
                  await client.connect();
                } catch (e) {
                  console.warn('[App] manual reconnect failed:', e);
                }
              }
            }}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            {btnLabel}
          </button>
        </div>
      </div>
    );
  }

  // 1.0.41: 非 standalone 浏览器访问 → 全屏拦截引导安装到主屏。
  // InstallGate 内部判断 standalone / dismissed / debug flag, 不满足条件不渲染。
  let routeContent: ReactNode;
  switch (route) {
    case 'loading':           routeContent = <Splash />; break;
    case 'welcome':           routeContent = <Welcome />; break;
    case 'generate_mnemonic': routeContent = <GenerateMnemonic />; break;
    case 'confirm_backup':    routeContent = <ConfirmBackup />; break;
    case 'vanity_shop':       routeContent = <VanityShop />; break;
    case 'set_nickname':      routeContent = <SetNickname />; break;
    case 'recover':           routeContent = <Recover />; break;
    case 'main':
      routeContent = (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 relative">
          {activeChatId ? <ChatWindow /> : <MainLayout />}
          {/* 全局浮层：只在通话时显示，浮在所有路由之上 */}
          <CallScreen />
        </div>
      );
      break;
    default: routeContent = <Splash />;
  }
  return (
    <>
      {routeContent}
      <InstallGate />
    </>
  );
}
export default App;
