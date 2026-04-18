import { useState, useEffect } from 'react';
import { listSessions } from '@daomessage_sdk/sdk';
import type { SessionRecord, StoredMessage } from '@daomessage_sdk/sdk';
import { client, localMessageHandlers } from '../../lib/imClient';
import { useAppStore } from '../../store/appStore';
import { ShieldCheck, ShieldAlert, Smartphone, X, Trash2 } from 'lucide-react';

type SessionWithPreview = SessionRecord & { lastMessage?: StoredMessage };

export function MessagesTab() {
  const { setActiveChatId, unreadCounts, clearUnread } = useAppStore();
  const [sessions, setSessions] = useState<SessionWithPreview[]>([]);
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionWithPreview | null>(null);

  // PWA standalone 检测
  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    if (!isPWA) setShowPwaBanner(true);
  }, []);

  const loadSessionsWithPreviews = async () => {
    const rawSessions = await listSessions();

    try {
      const serverData = await client.http.get<{conversations: {conv_id: string}[]}>('/api/v1/conversations/active');
      const localIds = new Set(rawSessions.map(s => s.conversationId));
      serverData.conversations?.forEach(sc => {
        if (!localIds.has(sc.conv_id)) console.log('待同步会话:', sc.conv_id);
      });
    } catch {}

    const withPreviews = await Promise.all(rawSessions.map(async s => {
      const history = await client.messages.getHistory(s.conversationId);
      return { ...s, lastMessage: history[history.length - 1] };
    }));

    withPreviews.sort((a, b) =>
      (b.lastMessage?.time || b.createdAt || 0) - (a.lastMessage?.time || a.createdAt || 0)
    );
    setSessions(withPreviews);
  };

  useEffect(() => {
    loadSessionsWithPreviews();
    const handler = () => setTimeout(loadSessionsWithPreviews, 200);
    localMessageHandlers.add(handler);
    return () => { localMessageHandlers.delete(handler); };
  }, []);

  const renderPreview = (text?: string) => {
    if (!text) return '';
    if (text === '消息已撤回') return '消息已撤回';
    if (text.startsWith('[img]')) return '[图片]';
    try { if (JSON.parse(text).type === 'image') return '[图片]'; } catch {}
    return text;
  };

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleDeleteChat = async () => {
    if (!deleteTarget) return;
    await client.messages.clearHistory(deleteTarget.conversationId);
    clearUnread(deleteTarget.conversationId);
    setDeleteTarget(null);
    loadSessionsWithPreviews();
  };

  return (
    <div className="flex-1 w-full bg-zinc-950">
      <div className="p-4 border-b border-zinc-900 sticky top-0 bg-zinc-950 z-10">
        <h1 className="text-xl font-bold">SecureChat</h1>
      </div>

      {/* PWA 安装提示横幅 */}
      {showPwaBanner && (
        <div className="mx-3 mt-3 bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-blue-400 shrink-0 pointer-events-none" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-blue-300 font-medium leading-snug">
              当前为浏览器模式。添加到主屏幕可获得推送通知和全屏体验。
            </span>
          </div>
          <button
            onClick={() => setShowPwaBanner(false)}
            className="p-1 text-zinc-500 hover:text-white shrink-0 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5 pointer-events-none" />
          </button>
        </div>
      )}
      
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-zinc-500 text-sm">
          暂无聊天记录，去通讯录加个好友吧
        </div>
      ) : (
        <div className="flex flex-col">
          {sessions.map(s => {
            const unread = unreadCounts[s.conversationId] || 0;
            return (
            <div 
              key={s.conversationId} 
              onClick={() => {
                clearUnread(s.conversationId);
                setActiveChatId(s.conversationId);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setDeleteTarget(s);
              }}
              className="flex items-center gap-3 p-4 border-b border-zinc-900/50 hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex-shrink-0 flex items-center justify-center relative">
                <span className="text-zinc-400 font-medium">
                  {s.theirAliasId.slice(0, 2).toUpperCase()}
                </span>
                {s.trustState === 'verified' ? (
                  <ShieldCheck className="absolute -bottom-1 -right-1 w-4 h-4 text-green-500 bg-zinc-950 rounded-full" />
                ) : (
                  <ShieldAlert className="absolute -bottom-1 -right-1 w-4 h-4 text-yellow-500 bg-zinc-950 rounded-full" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium truncate ${unread > 0 ? 'text-white' : ''}`}>{s.theirAliasId}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      {formatTime(s.lastMessage?.time || s.createdAt)}
                    </span>
                    {unread > 0 && (
                      <span className="bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none flex items-center justify-center min-w-[20px] font-semibold">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`text-sm truncate ${unread > 0 ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>
                  {s.lastMessage ? renderPreview(s.lastMessage.text) : '暂无消息'}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* 清空聊天确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={() => setDeleteTarget(null)}>
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-700/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400 pointer-events-none" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-50">清空聊天记录</h3>
                <p className="text-xs text-zinc-400">与 {deleteTarget.theirAliasId} 的所有消息</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              此操作将永久删除本地所有聊天记录，且无法恢复。对方的记录不受影响。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteChat}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors"
              >
                清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
