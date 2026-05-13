import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { client, localChannelPostHandlers } from '../../lib/imClient';
import { useSdkAction } from '../../hooks/useSdkAction';
import { ChevronLeft, Loader2, BellOff, BellRing, FileText, X, Eye, Pencil, PenLine, Tag, ShoppingCart, Clock, Copy, Check, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChannelInfo {
  id: string
  alias_id?: string
  name: string
  description: string
  role?: string
  is_subscribed?: boolean
  for_sale?: boolean
  sale_price?: number
}

export interface ChannelTradeOrder {
  order_id: string
  price_usdt: number
  pay_to: string
  expired_at: string
}

export interface ChannelPost {
  id: string
  channel_id?: string
  author_alias_id: string
  type: string
  content: string
  created_at: string
}

/** Markdown 渲染组件（暗色主题排版，CSS 在 index.css） */
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="channel-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/** 根据 post.type 决定渲染文本or Markdown */
function PostContent({ post }: { post: ChannelPost }) {
  if (post.type === 'markdown') {
    return <MarkdownRenderer content={post.content} />;
  }
  return <span className="text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-100">{post.content}</span>;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  全屏 Markdown 文章撰写器
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ArticleComposer({ 
  onPublish, 
  onClose, 
  publishing 
}: { 
  onPublish: (content: string) => void
  onClose: () => void
  publishing: boolean 
}) {
  const [content, setContent] = useState('');
  const [view, setView] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col animate-in fade-in">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white transition-colors active:scale-95 rounded-lg hover:bg-zinc-800">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold text-zinc-300 mr-3">撰写文章</h3>
          {/* 编辑/预览切换（移动端用，桌面端双栏同时显示） */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800/50 md:hidden">
            <button
              onClick={() => setView('edit')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                view === 'edit' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500'
              }`}
            >
              <Pencil className="w-3 h-3" />编辑
            </button>
            <button
              onClick={() => setView('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                view === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500'
              }`}
            >
              <Eye className="w-3 h-3" />预览
            </button>
          </div>
        </div>
        <button
          onClick={() => content.trim() && onPublish(content.trim())}
          disabled={!content.trim() || publishing}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-30 transition-all active:scale-95 flex items-center gap-1.5 shadow-sm shadow-indigo-900/30"
        >
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : '发布'}
        </button>
      </div>

      {/* 主体：桌面双栏 / 移动单栏切换 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 编辑区 */}
        <div className={`flex-1 flex flex-col border-r border-zinc-800/50 ${view === 'preview' ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 py-2 border-b border-zinc-800/30 bg-zinc-900/30">
            <span className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">Markdown 编辑</span>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={'# 文章标题\n\n在此撰写您的频道文章…\n\n支持完整 Markdown 语法：\n- **粗体**、*斜体*、~~删除线~~\n- 标题、列表、引用、代码块\n- 表格、任务列表、链接'}
            className="flex-1 bg-transparent px-5 py-4 text-[15px] text-zinc-100 placeholder:text-zinc-600 outline-none resize-none font-mono leading-relaxed"
            autoFocus
          />
        </div>

        {/* 预览区 */}
        <div className={`flex-1 flex flex-col ${view === 'edit' ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 py-2 border-b border-zinc-800/30 bg-zinc-900/30">
            <span className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">实时预览</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {content.trim() ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-zinc-600 text-sm italic">开始输入后这里会显示预览…</p>
            )}
          </div>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between shrink-0">
        <span className="text-[10px] text-zinc-600">
          {content.length} 字符 · {content.split('\n').length} 行
        </span>
        <span className="text-[10px] text-zinc-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          免打扰广播 · Markdown
        </span>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  倒计时工具
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '已过期';
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  挂牌出售 Modal（Owner 专用）
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ListForSaleModal({
  channelName,
  onSubmit,
  onClose,
  submitting,
}: {
  channelName: string;
  onSubmit: (price: number) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [price, setPrice] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => !submitting && onClose()}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Tag className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100">挂牌出售</h3>
            <p className="text-[10px] text-zinc-500 truncate max-w-[200px]">{channelName}</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-3 mb-4 space-y-2">
          <p className="text-xs text-zinc-400 leading-relaxed">
            📢 挂牌后频道将在搜索结果中展示售价标签，其他用户可直接购买。
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            ⚠️ 交易完成后，频道所有权将自动转移给买家（你将降为普通订阅者）。
          </p>
        </div>

        <div className="space-y-1.5 mb-5">
          <label className="text-xs font-medium text-zinc-400 pl-1">售价 (USDT) <span className="text-red-400">*</span></label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="例如：100"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm text-zinc-100 outline-none focus:border-amber-500 focus:bg-zinc-800 transition-colors placeholder:text-zinc-600"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={submitting} className="flex-1 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50">取消</button>
          <button
            onClick={() => { const v = parseInt(price); if (v > 0) onSubmit(v); }}
            disabled={!price || parseInt(price) <= 0 || submitting}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 flex justify-center items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认挂牌'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  频道购买支付弹窗（买家专用）
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ChannelPaymentModal({
  order,
  channelName,
  onConfirmed,
  onClose,
}: {
  order: ChannelTradeOrder;
  channelName: string;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const [countdown, setCountdown] = useState(formatCountdown(order.expired_at));
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const t = setInterval(() => setCountdown(formatCountdown(order.expired_at)), 1000);
    return () => clearInterval(t);
  }, [order.expired_at]);

  const startPolling = useCallback(() => {
    setPolling(true);
    setPollError('');
    pollRef.current = setInterval(async () => {
      try {
        const result = await client.vanity.orderStatus(order.order_id);
        if (result.status === 'confirmed') {
          clearInterval(pollRef.current);
          onConfirmed();
        } else if (result.status === 'expired') {
          clearInterval(pollRef.current);
          setPollError('订单已过期，请重新购买。');
          setPolling(false);
        }
      } catch {
        // 网络临时异常，继续轮询
      }
    }, 3000);
  }, [order.order_id, onConfirmed]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(order.pay_to);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-600/20 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-100">购买频道</h3>
              <p className="text-[10px] text-zinc-500">USDT-TRC20 链上支付</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 频道信息预览 */}
        <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-2xl p-4 mb-4 text-center">
          <p className="text-xs text-emerald-400 mb-1">你将获得的频道</p>
          <p className="text-lg font-bold text-white truncate">{channelName}</p>
          <p className="text-sm text-zinc-400 mt-1">{order.price_usdt} USDT</p>
        </div>

        {/* 收款地址 */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-3 mb-4">
          <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider font-medium">TRON (TRC-20) 收款地址</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-zinc-300 font-mono break-all leading-relaxed select-all">{order.pay_to}</code>
            <button onClick={copyAddress} className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">请向此地址转入恰好 <span className="text-amber-400 font-semibold">{order.price_usdt} USDT</span></p>
        </div>

        {/* 倒计时 */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>订单将在 <span className={`font-mono font-bold ${countdown === '已过期' ? 'text-red-400' : 'text-amber-400'}`}>{countdown}</span> 后过期</span>
        </div>

        {pollError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">{pollError}</p>
        )}

        {/* 确认支付按钮 */}
        {!polling ? (
          <button
            onClick={startPolling}
            disabled={countdown === '已过期'}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            我已付款，等待确认
          </button>
        ) : (
          <button disabled className="w-full py-3.5 text-sm text-emerald-300 bg-emerald-600/20 rounded-2xl flex items-center justify-center gap-2 cursor-wait">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在确认链上支付...
          </button>
        )}

        <p className="text-center text-[10px] text-zinc-600 mt-3">
          支付确认后频道所有权将自动转移到你的账户
        </p>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  频道详情主组件
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function ChannelDetail() {
  const { activeChannelId, setActiveChannelId } = useAppStore();
  const [info, setInfo] = useState<ChannelInfo | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  
  const [showComposer, setShowComposer] = useState(false);
  const [showListForSale, setShowListForSale] = useState(false);
  const [tradeOrder, setTradeOrder] = useState<ChannelTradeOrder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载数据
  const { execute: loadData, isProcessing: loading, error: loadError } = useSdkAction(async () => {
    if (!activeChannelId) return;
    const detail = await client.channels.getDetail(activeChannelId);
    setInfo(detail);
    const p = await client.channels.getPosts(activeChannelId);
    setPosts([...p].reverse());
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  });



  // 发送 Markdown 文章
  const { execute: sendArticle, isProcessing: sendingArticle } = useSdkAction(async (content: string) => {
    if (!content || !activeChannelId) return;
    await client.channels.postMessage(activeChannelId, content, 'markdown');
    setShowComposer(false);
    const p = await client.channels.getPosts(activeChannelId);
    setPosts([...p].reverse());
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  });

  // 处理订阅/退订
  const { execute: toggleSub, isProcessing: subbing } = useSdkAction(async () => {
    if (!info || !activeChannelId) return;
    if (info.is_subscribed) {
      await client.channels.unsubscribe(activeChannelId);
      setInfo({ ...info, is_subscribed: false });
    } else {
      await client.channels.subscribe(activeChannelId);
      setInfo({ ...info, is_subscribed: true });
    }
  });

  // Owner 挂牌出售
  const { execute: listForSale, isProcessing: listing } = useSdkAction(async (price: number) => {
    if (!activeChannelId) return;
    await client.channels.listForSale(activeChannelId, price);
    setShowListForSale(false);
    // 刷新详情
    const detail = await client.channels.getDetail(activeChannelId);
    setInfo(detail);
  });

  // 买家购买
  const { execute: buyChannel, isProcessing: buying } = useSdkAction(async () => {
    if (!activeChannelId) return;
    const order = await client.channels.buyChannel(activeChannelId);
    setTradeOrder(order);
  });

  useEffect(() => {
    loadData();
    const handleIncomingPost = (e: any) => {
      if (e.conv_id === activeChannelId) {
        if (e.post && e.post.id) {
          setPosts(prev => {
            if (prev.find(p => p.id === e.post.id)) return prev;
            return [...prev, e.post];
          });
          setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } else {
          loadData();
        }
      }
    };
    localChannelPostHandlers.add(handleIncomingPost);
    return () => { localChannelPostHandlers.delete(handleIncomingPost); };
  }, [activeChannelId]);

  if (loading && !info) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600 mb-4" />
        <p className="text-zinc-500 text-sm">加载频道中...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 items-center justify-center p-6 text-center">
        <p className="text-red-400 mb-4">{loadError}</p>
        <button onClick={() => setActiveChannelId(null)} className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700">
          返回
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 全屏 Markdown 撰文器 */}
      {showComposer && (
        <ArticleComposer
          onPublish={(content) => sendArticle(content)}
          onClose={() => setShowComposer(false)}
          publishing={sendingArticle}
        />
      )}

      <div className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden">
        {/* 头部导航栏 */}
        <div className="flex items-center p-3 border-b border-zinc-900 sticky top-0 bg-zinc-950 z-10 shrink-0 shadow-sm shadow-black/50">
          <button onClick={() => setActiveChannelId(null)} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors active:scale-95">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0 ml-1">
            <h2 className="font-bold truncate text-base tracking-wide flex items-center gap-2">
              {info?.name || '频道资料'}
              {info?.role === 'owner' && <span className="text-[10px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest border border-blue-800/50">Owner</span>}
            </h2>
            <p className="text-[10px] text-zinc-500 truncate mt-0.5">{info?.description || '暂无简介'}</p>
            {info?.for_sale && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md mt-1 border border-amber-500/20">
                <Tag className="w-2.5 h-2.5" />出售中 · {info.sale_price} USDT
              </span>
            )}
          </div>
          {!info?.role || info.role !== 'owner' ? (
            <button 
              onClick={toggleSub}
              disabled={subbing}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 ${
                info?.is_subscribed 
                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700/50' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20'
              } disabled:opacity-50`}
            >
              {info?.is_subscribed ? <><BellOff className="w-3.5 h-3.5" />已订阅</> : <><BellRing className="w-3.5 h-3.5" />订阅</>}
            </button>
          ) : null}
        </div>

        {/* 消息列表区 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/50 scroll-smooth">
          {posts.map(p => (
            <div key={p.id} className="bg-zinc-900/80 border border-zinc-800/80 p-4 rounded-2xl flex flex-col shadow-sm backdrop-blur-sm">
              {/* Markdown 文章角标 */}
              {p.type === 'markdown' && (
                <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-zinc-800/50">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">文章</span>
                </div>
              )}
              <PostContent post={p} />
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800/50">
                <span className="text-[11px] text-zinc-400 bg-zinc-950/50 px-2 py-1 rounded-md font-mono border border-zinc-800/30">
                  来自: {p.author_alias_id}
                </span>
                <span className="text-[11px] text-zinc-500 font-medium">
                  {new Date(p.created_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))}
          {posts.length === 0 && !loading && (
            <div className="text-center py-20 flex flex-col items-center justify-center opacity-60">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                <span className="text-2xl">📭</span>
              </div>
              <p className="text-zinc-400 font-medium tracking-wide">暂无频道广播</p>
              <p className="text-zinc-600 text-xs mt-1">这里是被时间遗忘的角落</p>
            </div>
          )}
          <div ref={scrollRef} className="h-4" />
        </div>

        {/* 底部操作区 */}
        <div className="shrink-0 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 pb-safe z-20 p-3">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">
            {/* Owner：发布广播 + 挂牌出售 */}
            {info?.role === 'owner' && (
              <>
                <button
                  onClick={() => setShowComposer(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] shadow-sm shadow-indigo-900/30"
                >
                  <PenLine className="w-4 h-4" />
                  发布广播
                </button>
                {!info.for_sale && (
                  <button
                    onClick={() => setShowListForSale(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-amber-400 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] border border-zinc-800"
                  >
                    <Tag className="w-4 h-4" />
                    挂牌出售此频道
                  </button>
                )}
              </>
            )}

            {/* 买家：购买按钮 */}
            {info?.for_sale && info?.role !== 'owner' && (
              <button
                onClick={() => buyChannel()}
                disabled={buying}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] shadow-sm shadow-emerald-900/30 disabled:opacity-50"
              >
                {buying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    购买此频道 · {info.sale_price} USDT
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 挂牌出售 Modal */}
      {showListForSale && info && (
        <ListForSaleModal
          channelName={info.name}
          onSubmit={(price) => listForSale(price)}
          onClose={() => setShowListForSale(false)}
          submitting={listing}
        />
      )}

      {/* 购买支付弹窗 */}
      {tradeOrder && info && (
        <ChannelPaymentModal
          order={tradeOrder}
          channelName={info.name}
          onConfirmed={() => {
            setTradeOrder(null);
            loadData();
          }}
          onClose={() => setTradeOrder(null)}
        />
      )}
    </>
  );
}

