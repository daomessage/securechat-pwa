import { useState, useEffect, useRef, useCallback } from 'react';
import { client, localMessageHandlers, localStatusHandlers, localTypingHandlers, getCallModule } from '../../lib/imClient';
import { loadSession, loadIdentity, computeSecurityCode, fromBase64 } from '@daomessage_sdk/sdk';
import type { SessionRecord, StoredMessage, TypingEvent } from '@daomessage_sdk/sdk';
import { useAppStore } from '../../store/appStore';
import { ShieldAlert, ShieldCheck, ChevronLeft, Loader2, Check, CheckCheck, Clock, Info, Phone, Video } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Virtuoso } from 'react-virtuoso';

import { ImageBubble, FileBubble, VoiceBubble } from './bubbles/MessageBubbles';
import { ChatInputBar } from './ChatInputBar';
import { SecurityCodeDialog } from './SecurityCodeDialog';

const PAGE_SIZE = 20;

export function ChatWindow() {
  const { activeChatId, setActiveChatId } = useAppStore();
  const [sessionInfo, setSessionInfo] = useState<SessionRecord | null>(null);
  const [trustVerified, setTrustVerified] = useState(false);
  const [securityCode, setSecurityCode] = useState('');
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [friendTyping, setFriendTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const virtuosoRef = useRef<any>(null);

  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [replyTo, setReplyTo] = useState<StoredMessage | null>(null);
  const [detailMsg, setDetailMsg] = useState<StoredMessage | null>(null);

  useEffect(() => {
    if (!activeChatId) return;

    let active = true;

    loadSession(activeChatId).then(async (s) => {
      if (!active) return;
      setSessionInfo(s || null);
      setTrustVerified(s?.trustState === 'verified');

      if (s) {
        const ident = await loadIdentity();
        if (ident) {
          const myPubBytes = fromBase64(ident.ecdhPublicKey);
          const theirPubBytes = fromBase64(s.theirEcdhPublicKey);
          const code = computeSecurityCode(myPubBytes, theirPubBytes);
          setSecurityCode(code);
        }
      }
    });

    client.messages.getHistory(activeChatId, { limit: PAGE_SIZE }).then(stored => {
      if (!active) return;
      setMessages(stored.map(m => ({ ...m })));
      setHasMore(stored.length >= PAGE_SIZE);
      // Wait for Virtuoso to render
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' });
      }, 100);
    });

    useAppStore.getState().clearUnread(activeChatId);

    const handleIncoming = (msg: StoredMessage) => {
      if (msg.conversationId !== activeChatId) return;
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === msg.id);
        const chatMsg = { ...msg };
        if (idx >= 0) { const next = [...prev]; next[idx] = chatMsg; return next; }
        return [...prev, chatMsg];
      });
      // 已读回执守卫:仅当 (1) 对方消息 (2) 页面真的可见(没切到后台/锁屏)
      // 否则切后台时新消息也会立刻变"已读",和 Android 一样的 bug
      if (
        !msg.isMe &&
        msg.seq &&
        sessionInfo?.theirAliasId &&
        document.visibilityState === 'visible'
      ) {
        client.messages.markAsRead(activeChatId, msg.seq, sessionInfo.theirAliasId);
      }
    };

    const handleStatus = (status: { id: string; status: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === status.id ? { ...m, status: status.status as any } : m
      ));
    };

    const handleTyping = ({ conversationId }: TypingEvent) => {
      if (conversationId !== activeChatId) return;
      setFriendTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => setFriendTyping(false), 3000);
    };

    localMessageHandlers.add(handleIncoming);
    localStatusHandlers.add(handleStatus);
    localTypingHandlers.add(handleTyping);
    return () => {
      active = false;
      localMessageHandlers.delete(handleIncoming);
      localStatusHandlers.delete(handleStatus);
      localTypingHandlers.delete(handleTyping);
    };
  }, [activeChatId, sessionInfo?.theirAliasId]);

  const loadMore = useCallback(async () => {
    if (!activeChatId || loadingMore || !hasMore) return;
    const oldest = messages[0];
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const older = await client.messages.getHistory(activeChatId, {
        limit: PAGE_SIZE,
        before: oldest.time,
      });
      if (older.length < PAGE_SIZE) {
        setHasMore(false);
      }
      if (older.length > 0) {
        setMessages(prev => [...older.map(m => ({ ...m })), ...prev]);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [activeChatId, loadingMore, hasMore, messages]);

  const formatTime = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const inferType = (m: StoredMessage) => {
    if (m.msgType) return m.msgType;
    if (m.text?.startsWith('[img]')) return 'image';
    if (m.text?.startsWith('[file]')) return 'file';
    if (m.text?.startsWith('[voice]')) return 'voice';
    try {
      const parsed = JSON.parse(m.text);
      if (parsed.type === 'image') return 'image';
      if (parsed.type === 'file') return 'file';
      if (parsed.type === 'voice') return 'voice';
    } catch {}
    return 'text';
  };

  const getPreviewText = (m: StoredMessage, maxLen = 50): string => {
    if (m.msgType === 'retracted') return '消息已撤回';
    const t = inferType(m);
    if (t === 'image') return '📷 图片';
    if (t === 'voice') {
      try { const p = JSON.parse(m.text); return `🎤 语音 ${Math.round((p.durationMs || 0) / 1000)}s`; } catch {}
      return '🎤 语音消息';
    }
    if (t === 'file') {
      try { const p = JSON.parse(m.text); return `📎 ${p.name || '文件'}`; } catch {}
      return '📎 文件';
    }
    return m.text?.slice(0, maxLen) || '[消息]';
  };

  const scrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 text-white relative">
      {/* h-[100dvh] = dynamic viewport height, 手机浏览器地址栏收缩/键盘弹出时自动调整,避免输入框被推出屏幕外
          原来用 h-screen (100vh) 在 iOS Safari / Android Chrome 上会包含地址栏占用的高度,导致底部输入栏看不见。
          pb-safe 由子组件 ChatInputBar 自己负责 safe-area 填充 */}
      {/* 顶部 Header · design tokens: 高 56 (py 3 + 32 图标) / border.default zinc-800 */}
      <div className="flex items-center p-3 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md z-10 sticky top-0 shrink-0">
        <button onClick={() => setActiveChatId(null)} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors flex items-center">
          <ChevronLeft className="w-6 h-6 pointer-events-none" />
        </button>
        <div className="flex flex-col ml-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base truncate">{sessionInfo?.theirAliasId || '聊天'}</span>
            {trustVerified ? (
              <ShieldCheck className="w-4 h-4 text-green-500 fill-green-500/10 pointer-events-none" />
            ) : (
              <button onClick={() => setShowSecurityModal(true)} className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border border-yellow-500/30">
                <ShieldAlert className="w-3 h-3 pointer-events-none" /> 未核验安全会话
              </button>
            )}
          </div>
          <span className="text-[10px] text-zinc-500 h-3">
            {friendTyping ? '正在输入...' : '点击上方可核查端到端加密指纹'}
          </span>
        </div>

        {/* 通话按钮 */}
        <div className="flex items-center gap-1">
          <button
            id="btn-voice-call"
            title="语音通话"
            onClick={async () => {
              console.error('🔥 [App] 语音通话按钮点击! theirAliasId:', sessionInfo?.theirAliasId);
              const mod = getCallModule();
              console.error('🔥 [App] CallModule 实例:', mod ? '已初始化' : 'NULL');
              if (!sessionInfo?.theirAliasId) {
                console.error('🔥 [App] theirAliasId 为空，终止');
                return;
              }
              if (!mod) {
                console.warn('[Call] CallModule 未初始化，请重新进入页面');
                alert('通话模块正在初始化，请稍候再试');
                return;
              }
              const store = useAppStore.getState();
              store.beginCall(sessionInfo.theirAliasId, 'audio');
              store.setCallState('calling');
              console.error('🔥 [App] 开始调用 mod.call()，目标:', sessionInfo.theirAliasId);
              try {
                await (mod as any).call(sessionInfo.theirAliasId, { audio: true, video: false });
                console.error('🔥 [App] mod.call() 已完成（无异常）');
              } catch (e: any) {
                console.error('🔥 [App] 语音呼叫失败', e);
                store.setCallState(null);
                alert(`呼叫失败: ${e?.message || '未知错误（可能是麦克风权限被拒）'}`);
              }
            }}
            className="p-2 text-zinc-400 hover:text-white active:scale-90 transition-all rounded-lg hover:bg-zinc-800"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            id="btn-video-call"
            title="视频通话"
            onClick={async () => {
              console.error('🟠 [App] 视频通话按钮点击! theirAliasId:', sessionInfo?.theirAliasId);
              const mod = getCallModule();
              console.error('🟠 [App] CallModule 实例:', mod ? '已初始化' : 'NULL');
              if (!sessionInfo?.theirAliasId) {
                console.error('🟠 [App] theirAliasId 为空,终止');
                return;
              }
              if (!mod) {
                console.error('🟠 [App] CallModule 未初始化');
                alert('通话模块正在初始化,请稍候再试');
                return;
              }
              const store = useAppStore.getState();
              store.beginCall(sessionInfo.theirAliasId, 'video');
              store.setCallState('calling');
              console.error('🟠 [App] 开始调用 mod.call() video,目标:', sessionInfo.theirAliasId);
              try {
                await (mod as any).call(sessionInfo.theirAliasId, { audio: true, video: true });
                console.error('🟠 [App] mod.call() 已完成(无异常返回)');
              } catch (e: any) {
                console.error('🟠 [App] 视频呼叫失败 捕获异常:', e);
                store.setCallState(null); // 重置 CallScreen
                const msg = String(e?.message || '');
                // 区分 gUM 错误类型,给用户更明确的提示
                let hint = '请重试';
                if (/Permission|denied|NotAllowedError/i.test(msg)) {
                  hint = '请在浏览器地址栏左侧的权限图标里允许摄像头和麦克风';
                } else if (/NotFoundError|DevicesNotFound|找不到|未找到/i.test(msg)) {
                  hint = '没有检测到摄像头设备,请确认设备已连接';
                } else if (/NotReadableError|TrackStartError|被占用/i.test(msg)) {
                  hint = '摄像头被其他应用占用,请关闭其他视频软件后重试';
                } else if (/timeout/i.test(msg)) {
                  hint = '摄像头响应超时,请检查浏览器是否被禁用了媒体权限';
                }
                alert(`视频呼叫失败:${hint}\n\n详细错误:${msg || '未知'}`);
              }
            }}
            className="p-2 text-zinc-400 hover:text-white active:scale-90 transition-all rounded-lg hover:bg-zinc-800"
          >
            <Video className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative" onClick={() => contextMenu && setContextMenu(null)}>
        <Virtuoso
          ref={virtuosoRef}
          className="h-full w-full px-4"
          data={messages}
          startReached={() => {
            if (hasMore && !loadingMore) loadMore();
          }}
          firstItemIndex={0}
          initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
          alignToBottom={false}
          followOutput={(isAtBottom) => isAtBottom ? 'smooth' : false}
          components={{
            Header: () => (
              hasMore ? (
                <div className="flex justify-center py-4">
                  {loadingMore && <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />}
                </div>
              ) : <div className="h-4" />
            ),
            Footer: () => <div className="h-4" />
          }}
          itemContent={(_index, m) => {
            const type = inferType(m);
            if (m.msgType === 'retracted') {
              return (
                <div key={m.id} className="flex justify-center py-2">
                  <span className="text-xs text-zinc-500 italic bg-zinc-900/50 px-3 py-1 rounded-full">
                    {m.isMe ? '你撤回了一条消息' : '对方撤回了一条消息'}
                  </span>
                </div>
              );
            }
            return (
              <div key={m.id} className={cn("flex w-full py-2", m.isMe ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    // design tokens: max-w 75%, px space.4 (16), py space.3 (12), radius.2xl (16)
                    // 尖角指向自己 · 自己消息右下 sm / 对方消息左下 sm
                    "max-w-[75%] rounded-2xl px-4 py-3 flex flex-col relative group",
                    m.isMe ? "bg-blue-600 rounded-br-sm text-white" : "bg-zinc-800 rounded-bl-sm text-zinc-100 border border-zinc-700/50"
                  )}
                  onContextMenu={(e) => {
                    if (m.status !== 'failed') {
                      e.preventDefault();
                      setContextMenu({ msgId: m.id, x: e.clientX, y: e.clientY });
                    }
                  }}
                >
                  {m.replyToId && (() => {
                    const quoted = messages.find(q => q.id === m.replyToId);
                    if (!quoted) return null;
                    const preview = getPreviewText(quoted, 60);
                    return (
                      <div className={cn(
                        "text-[11px] mb-1.5 border-l-2 pl-2 py-0.5 rounded-sm truncate",
                        m.isMe ? "border-blue-300/50 text-blue-100/70" : "border-zinc-500/50 text-zinc-400"
                      )}>
                        <span className="font-medium">{quoted.isMe ? '你' : (quoted.fromAliasId?.slice(0, 6) || '对方')}</span>
                        <span className="ml-1">{preview}</span>
                      </div>
                    );
                  })()}
                  {type === 'image' ? (
                    <ImageBubble
                      conversationId={activeChatId!}
                      mediaKey={m.mediaUrl || (() => { try { return JSON.parse(m.text).key } catch { return '' } })()}
                      thumbnail={m.caption || (() => { try { return JSON.parse(m.text).thumbnail } catch { return undefined } })()}
                    />
                  ) : type === 'file' ? (
                    <FileBubble text={m.text} conversationId={activeChatId!} isMe={m.isMe} />
                  ) : type === 'voice' ? (
                    <VoiceBubble text={m.text} conversationId={activeChatId!} isMe={m.isMe} />
                  ) : type === 'text' ? (
                    <span className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.text}</span>
                  ) : (
                    <span className="text-sm italic text-zinc-400">⚠️ 不支持的消息类型</span>
                  )}
                  
                  <div className={cn(
                    "flex items-center gap-1 mt-1 text-[10px]", 
                    m.isMe ? "text-blue-200 self-end justify-end w-full" : "text-zinc-500 self-start w-full justify-between"
                  )}>
                    <span>{formatTime(m.time)}</span>
                    {m.isMe && (
                      <span className="flex items-center ml-1 gap-0.5">
                        {/* 状态图标设计:
                            - sending:Clock(发送中)
                            - sent / delivered:✓ 单勾灰 — 不区分"服务端收到"和"对方设备收到"
                              (这两个差别用户分不清,跟 iMessage/Telegram 一样合并显示)
                            - read:✓✓ 双勾亮蓝 + 「已读」文字 — 与上面拉开视觉差距
                              (避免"双勾 = 已读"的直觉错位 — 之前 delivered 也用双勾导致用户
                               以为已读,实则只是已送达)
                            - failed:红字 */}
                        {m.status === 'sending' && <Clock className="w-3 h-3" />}
                        {(m.status === 'sent' || m.status === 'delivered') && (
                          <Check className="w-3 h-3 opacity-60" />
                        )}
                        {m.status === 'read' && (
                          <>
                            <CheckCheck className="w-3 h-3 text-sky-400" />
                            <span className="text-[10px] text-sky-400 leading-none">已读</span>
                          </>
                        )}
                        {m.status === 'failed' && <span className="text-red-400">发送失败</span>}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
        />

        {/* 右键/长按操作菜单 */}
        {contextMenu && (() => {
          const targetMsg = messages.find(m => m.id === contextMenu.msgId);
          const isOwn = targetMsg?.isMe ?? false;
          return (
          <div
            className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl py-1 min-w-[120px] animate-in fade-in zoom-in-95 duration-150"
            style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 140) }}
            onClick={() => setContextMenu(null)}
          >
            {isOwn && (
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors rounded-t-xl"
                onClick={async () => {
                  if (sessionInfo?.theirAliasId && activeChatId) {
                    await client.messages.retract(contextMenu.msgId, sessionInfo.theirAliasId, activeChatId);
                  }
                  setContextMenu(null);
                }}
              >
                撤回
              </button>
            )}
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
              onClick={() => {
                if (targetMsg) setReplyTo(targetMsg);
                setContextMenu(null);
              }}
            >
              回复
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-700 transition-colors rounded-b-xl"
              onClick={() => {
                if (targetMsg) setDetailMsg(targetMsg);
                setContextMenu(null);
              }}
            >
              详情
            </button>
          </div>
          );
        })()}
      </div>

      <ChatInputBar 
        activeChatId={activeChatId}
        sessionInfo={sessionInfo}
        trustVerified={trustVerified}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onShowSecurityModal={() => setShowSecurityModal(true)}
        onMessageSent={scrollToBottom}
      />

      {/* 消息详情弹窗 */}
      {detailMsg && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in cursor-default" onClick={() => setDetailMsg(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-blue-400 pointer-events-none" />
              <h3 className="font-semibold text-zinc-100">消息详情</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">消息 ID</span>
                <span className="text-zinc-300 font-mono text-xs truncate max-w-[200px]">{detailMsg.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">发送时间</span>
                <span className="text-zinc-300">{new Date(detailMsg.time).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">发送方</span>
                <span className="text-zinc-300">{detailMsg.isMe ? '我' : (detailMsg.fromAliasId || '未知')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">状态</span>
                <span className="text-zinc-300">
                  {detailMsg.status}
                </span>
              </div>
            </div>
            <button
              onClick={() => setDetailMsg(null)}
              className="w-full mt-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* P2-1: 安全码核验 modal 已抽独立组件 SecurityCodeDialog */}
      {showSecurityModal && activeChatId && (
        <SecurityCodeDialog
          conversationId={activeChatId}
          securityCode={securityCode}
          onClose={() => setShowSecurityModal(false)}
          onVerified={() => setTrustVerified(true)}
        />
      )}
    </div>
  );
}
