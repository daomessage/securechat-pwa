import { useState, useEffect } from 'react';
import { client } from '../../lib/imClient';
import { useAppStore } from '../../store/appStore';
import type { FriendProfile as ContactProfile } from '@daomessage_sdk/sdk';
import { UserPlus, Search, Loader2, Clock, QrCode, ScanLine } from 'lucide-react';
import { useSdkAction } from '../../hooks/useSdkAction';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';

function PendingRequestItem({ f, reload }: { f: ContactProfile; reload: () => void }) {
  const { execute, isProcessing, error } = useSdkAction(
    () => client.contacts.acceptFriendRequest(f.friendship_id),
    { onSuccess: reload }
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center text-sm font-bold">
            {(f.nickname || '?').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-sm">{f.nickname}</div>
            <div className="text-xs text-zinc-500">{f.alias_id}</div>
          </div>
        </div>
        
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); execute(); }}
          disabled={isProcessing}
          className="p-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:bg-zinc-700 rounded-full transition-colors relative cursor-pointer"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin pointer-events-none" />
          ) : (
            <div className="w-4 h-4 font-bold flex items-center justify-center pointer-events-none leading-none">✓</div>
          )}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

export function ContactsTab() {
  const { setActiveChatId, setActiveTab, setPendingRequestCount, aliasId } = useAppStore();
  const [friends, setFriends] = useState<ContactProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [addId, setAddId] = useState('');
  const [searchRes, setSearchRes] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // 二维码相关状态
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  const loadData = async () => {
    try {
      const list = await client.contacts.syncFriends();
      setFriends(list);
      const pendingReceived = list.filter(f => f.status === 'pending' && f.direction === 'received');
      setPendingRequestCount(pendingReceived.length);
    } catch (e) {
      console.error('load friends error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleSearch = async (overrideId?: string) => {
    const targetId = overrideId || addId.trim();
    if (!targetId) return;
    setAddId(targetId);
    setSearchLoading(true);
    setSearchRes(null);
    setAddError('');
    try {
      const u = await client.contacts.lookupUser(targetId);
      setSearchRes(u);
    } catch (e: any) {
      console.error(e);
      setSearchRes('NOT_FOUND');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async () => {
    setAddError('');
    if (searchRes === 'NOT_FOUND' || !searchRes) return;
    try {
      await client.contacts.sendFriendRequest(searchRes.uuid || addId.trim());
      setSearchRes(null);
      setAddId('');
      loadData();
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('409') || msg.toLowerCase().includes('already exists')) {
        setAddError('已发送过好友请求，请等待对方确认或查看下方列表');
        loadData(); // 刷新获取最新状态
      } else {
        setAddError(`添加失败: ${msg}`);
      }
    }
  };

  const pendingReceived = friends.filter(f => f.status === 'pending' && f.direction === 'received');
  const pendingSent = friends.filter(f => f.status === 'pending' && f.direction === 'sent');
  const accepted = friends.filter(f => f.status === 'accepted');

  return (
    <div className="flex-1 w-full flex flex-col p-4 gap-6 overflow-y-auto bg-zinc-950">
      <h2 className="text-xl font-bold sticky top-0 bg-zinc-950/80 backdrop-blur py-2 z-10">
        联系人
      </h2>

      {/* 搜索/添加区域 */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-4">
        <h3 className="text-sm font-semibold text-zinc-500 flex items-center gap-2">
          <UserPlus className="w-4 h-4 pointer-events-none" /> 新的朋友
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="搜索 Alias ID"
              value={addId}
              onChange={e => { setAddId(e.target.value); setAddError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button 
            disabled={searchLoading || !addId.trim()}
            onClick={() => handleSearch()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {searchLoading ? <Loader2 className="w-4 h-4 animate-spin pointer-events-none" /> : '查找'}
          </button>
        </div>

        {/* 二维码功能区 */}
        <div className="flex gap-4 pt-1">
          <button onClick={() => setShowQrModal(true)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center gap-2 text-sm text-zinc-300 transition-colors">
            <QrCode className="w-4 h-4" /> 我的二维码
          </button>
          <button onClick={() => setShowScanModal(true)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center gap-2 text-sm text-zinc-300 transition-colors">
            <ScanLine className="w-4 h-4" /> 扫一扫
          </button>
        </div>
        
        {searchRes && searchRes !== 'NOT_FOUND' && (
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-bold">
                {(searchRes.nickname || '?').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-sm">{searchRes.nickname}</div>
                <div className="text-xs text-zinc-500">{searchRes.alias_id}</div>
              </div>
            </div>
            <button 
              onClick={handleSendRequest}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold rounded-full transition-colors flex items-center gap-1"
            >
              <UserPlus className="w-3 h-3 pointer-events-none" /> 添加好友
            </button>
          </div>
        )}
        {addError && <p className="text-red-400 text-xs">{addError}</p>}
        {searchRes === 'NOT_FOUND' && <p className="text-zinc-500 text-xs">未找到该用户</p>}
      </div>

      {/* 收到的请求 */}
      {pendingReceived.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-400">📨 收到的好友请求</h3>
          <div className="space-y-2">
            {pendingReceived.map(f => (
              <PendingRequestItem key={f.friendship_id} f={f} reload={loadData} />
            ))}
          </div>
        </div>
      )}

      {/* 发出的等待中请求 */}
      {pendingSent.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-400">⏳ 等待对方确认</h3>
          <div className="space-y-2">
            {pendingSent.map(f => (
              <div key={f.friendship_id} className="bg-zinc-900/60 border border-zinc-800/50 p-3 rounded-lg flex items-center justify-between opacity-70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 text-zinc-500 rounded-full flex items-center justify-center text-sm font-bold">
                    {(f.nickname || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-zinc-300">{f.nickname}</div>
                    <div className="text-xs text-zinc-600">{f.alias_id}</div>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 pointer-events-none" /> 等待中
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 我的好友 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-400">👥 我的好友 ({accepted.length})</h3>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-700" /></div>
        ) : (
          <div className="space-y-2">
            {accepted.map(f => (
              <div 
                key={f.friendship_id} 
                className="bg-zinc-900/50 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors"
                onClick={() => {
                  setActiveChatId(f.conversation_id);
                  setActiveTab('messages');
                }}
              >
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 text-sm font-medium">
                  {(f.nickname || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-sm">{f.nickname}</div>
                  <div className="text-xs text-zinc-500">{f.alias_id}</div>
                </div>
              </div>
            ))}
            {accepted.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">还没有好友，发个请求试试吧</p>}
          </div>
        )}
      </div>

      {/* 我的二维码 Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center">
            <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-400" /> 我的交友名片
            </h3>
            <div className="bg-white p-4 rounded-xl shadow-xl">
              <QRCodeSVG value={`securechat://add?aliasId=${aliasId}`} size={220} />
            </div>
            <p className="mt-6 text-zinc-400 text-sm text-center">
              扫一扫上面的二维码图案，加我为好友<br/>
              <span className="text-xs opacity-50 mt-2 block break-all">{aliasId}</span>
            </p>
            <button 
              onClick={() => setShowQrModal(false)} 
              className="mt-6 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 扫一扫 Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
            <ScanLine className="w-5 h-5" /> 扫一扫添加好友
          </h3>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-black relative">
            <Scanner
              onScan={(results: any) => {
                console.error('🟣 [Scanner] onScan 触发', {
                  type: typeof results,
                  isArray: Array.isArray(results),
                  length: results?.length,
                  raw: results,
                });
                // 兼容不同库版本的回调形态:
                // - 老版本: results 是 string (直接 QR 内容)
                // - 新版本: results 是 [{ rawValue: '...', ... }]
                let txt: string | undefined;
                if (typeof results === 'string') {
                  txt = results;
                } else if (Array.isArray(results) && results.length > 0) {
                  txt = results[0]?.rawValue ?? results[0]?.text;
                } else if (results && typeof results === 'object' && 'rawValue' in results) {
                  txt = results.rawValue;
                }
                console.error('🟣 [Scanner] 解出 rawValue:', txt);
                if (!txt) return;
                const match = txt.match(/aliasId=([^&]+)/) || txt.match(/^([a-zA-Z0-9_-]+)$/) || [null, txt];
                const code = match[1] || txt;
                console.error('🟣 [Scanner] 解析出 alias code:', code);
                if (code) {
                  setShowScanModal(false);
                  handleSearch(code);
                }
              }}
              onError={(e) => console.error('🟣 [Scanner] err:', e)}
            />
          </div>
          <p className="mt-6 text-zinc-500 text-sm text-center">将二维码放入框内，即可自动扫描</p>
          <button 
            onClick={() => setShowScanModal(false)} 
            className="mt-12 w-full max-w-sm py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-medium rounded-xl transition-colors"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
}

