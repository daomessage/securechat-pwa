import { useState, useEffect } from 'react';
import { client } from '../../lib/imClient';
import { useAppStore } from '../../store/appStore';
import { useSdkAction } from '../../hooks/useSdkAction';
import { Search, Plus, Hash, Loader2, Sparkles, CheckCircle2, Tag } from 'lucide-react';

export interface ChannelInfo {
  id: string
  name: string
  description: string
  role?: string
  is_subscribed?: boolean
  for_sale?: boolean
  sale_price?: number
}

export function ChannelsTab() {
  const { setActiveChannelId } = useAppStore();
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [query, setQuery] = useState('');
  
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  // Quota Expansion
  const [showQuotaPayment, setShowQuotaPayment] = useState(false);
  const [quotaOrder, setQuotaOrder] = useState<any>(null);

  const { execute: loadChannels, isProcessing: loadingData } = useSdkAction(async () => {
    if (tab === 'mine') {
      const res = await client.channels.getMine();
      setChannels(res);
    } else {
      if (!query.trim()) {
        setChannels([]);
      } else {
        const res = await client.channels.search(query.trim());
        setChannels(res);
      }
    }
  });

  const { execute: createChannel, isProcessing: creating } = useSdkAction(async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await client.channels.create(newTitle.trim(), newDesc.trim(), true);
      setActiveChannelId(res.channel_id);
      setShowCreate(false);
    } catch (e: any) {
      if (e.message?.includes('QUOTA_EXCEEDED')) {
        setShowCreate(false);
        const order = await client.channels.buyQuota();
        setQuotaOrder(order);
        setShowQuotaPayment(true);
      } else {
        throw e;
      }
    }
  });

  // Polling for Quota Payment Status
  useEffect(() => {
    let timer: any;
    if (showQuotaPayment && quotaOrder) {
      timer = setInterval(async () => {
        try {
          // We can use vanity.orderStatus as it queries generic payment_orders
          const st = await client.vanity.orderStatus(quotaOrder.order_id);
          if (st.status === 'confirmed') {
            setShowQuotaPayment(false);
            setQuotaOrder(null);
            // After quota expanded, try creating the channel automatically
            setShowCreate(true); 
          }
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [showQuotaPayment, quotaOrder]);

  // 初次加载或切换 Tab 时
  useEffect(() => {
    setQuery('');
    setChannels([]);
    loadChannels();
  }, [tab]);

  // 防抖搜索
  useEffect(() => {
    if (tab !== 'discover') return;
    const timer = setTimeout(() => {
      loadChannels();
    }, 400);
    return () => clearTimeout(timer);
  }, [query, tab]);

  return (
    <div className="flex-1 w-full bg-zinc-950 flex flex-col relative h-full">
      {/* Header & Tabs */}
      <div className="px-4 py-3 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-10 border-b border-zinc-900/50">
        <h1 className="text-xl font-bold mb-4 text-zinc-100 placeholder-zinc-100 flex items-center gap-2">
          <Hash className="w-5 h-5 text-blue-500" />
          频道广场
        </h1>
        <div className="flex bg-zinc-900/80 p-1 rounded-xl">
          <button
            onClick={() => setTab('mine')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === 'mine' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            我的订阅
          </button>
          <button
            onClick={() => setTab('discover')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === 'discover' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            发现频道
          </button>
        </div>
      </div>

      {/* 搜索框 (仅在发现页显示) */}
      {tab === 'discover' && (
        <div className="px-4 mt-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
            <input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索频道关键字..."
              className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl py-2.5 pl-9 pr-4 text-sm text-zinc-100 outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-500"
            />
          </div>
        </div>
      )}

      {/* 频道列表区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loadingData ? (
          <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-sm">正在加载频道...</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-zinc-500 gap-4">
            {tab === 'mine' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                  <Hash className="w-6 h-6 text-zinc-700" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-300">暂无订阅</p>
                  <p className="text-xs text-zinc-600 mt-1">去发现页面寻找感兴趣的内容吧</p>
                </div>
                <button 
                  onClick={() => setTab('discover')}
                  className="mt-2 text-xs text-blue-400 bg-blue-500/10 px-4 py-2 rounded-lg hover:bg-blue-500/20 transition-colors"
                >
                  去发现
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-zinc-700" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-300">
                    {query.trim() ? '查无此频道' : '输入关键字探索'}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map(c => (
              <div 
                key={c.id} 
                onClick={() => setActiveChannelId(c.id)}
                className="group bg-zinc-900/40 hover:bg-zinc-800/60 active:scale-[0.98] border border-zinc-900 p-3 rounded-2xl cursor-pointer transition-all flex gap-3 items-center"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800 flex items-center justify-center rounded-xl text-zinc-400 group-hover:from-blue-900/20 group-hover:to-zinc-800 transition-colors">
                  <Hash className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{c.name}</h3>
                    {c.role === 'owner' && (
                      <span className="shrink-0 text-[10px] font-medium bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md">管理</span>
                    )}
                    {c.for_sale && (
                      <span className="shrink-0 text-[10px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-amber-500/20">
                        <Tag className="w-2.5 h-2.5" />{c.sale_price} USDT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{c.description || '暂无介绍'}</p>
                </div>
                {/* 如果是我的订阅，右侧显示一些状态或箭头 */}
                {tab === 'mine' && (
                  <div className="shrink-0 text-zinc-600 px-2 h-full flex flex-col items-center justify-center">
                     <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 悬浮创建按钮 FAB */}
      <button 
        onClick={() => setShowCreate(true)}
        className="absolute right-5 bottom-5 w-14 h-14 bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-900/20 text-white rounded-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* 创建频道 Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={() => !creating && setShowCreate(false)}>
          <div className="bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Hash className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-100">开通频道</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 pl-1">频道名称 <span className="text-red-400">*</span></label>
                <input 
                  placeholder="例如：每日技术资讯" 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:bg-zinc-800 transition-colors placeholder:text-zinc-600"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 pl-1">频道简介</label>
                <textarea 
                  placeholder="一句话介绍你的频道..." 
                  value={newDesc} 
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:bg-zinc-800 transition-colors placeholder:text-zinc-600 h-24 resize-none"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowCreate(false)} 
                  disabled={creating}
                  className="flex-1 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button 
                  onClick={createChannel} 
                  disabled={!newTitle.trim() || creating} 
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 flex justify-center items-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : '立即开通'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 配额不足 - 扩容支付 Modal */}
      {showQuotaPayment && quotaOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-zinc-950 border border-amber-800 shadow-2xl shadow-amber-900/20 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
              <Tag className="w-7 h-7 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-zinc-100 mb-2">扩充频道配额</h3>
            <p className="text-sm text-zinc-400 mb-6">您的免费频道额度已达上限。<br/>支付 <strong className="text-amber-400">{quotaOrder.price_usdt} USDT</strong> (TRC-20) <br/>以永久增加 1 个频道创建席位。</p>
            
            <div className="w-full bg-zinc-900 rounded-xl p-4 border border-zinc-800 mb-6">
              <p className="text-xs text-zinc-500 mb-1 text-left">向此地址付款</p>
              <div className="text-sm text-zinc-200 font-mono break-all text-left bg-black/30 p-2 rounded selectable">
                {quotaOrder.pay_to}
              </div>
            </div>

            <p className="text-xs text-zinc-500 mb-4 flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin"/> 等待链上确认中 (约 1-3 分钟)...
            </p>

            <button 
              onClick={() => {
                setShowQuotaPayment(false);
                setQuotaOrder(null);
                setTab('mine');
                loadChannels();
              }}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition-all"
            >
              稍后查看
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
