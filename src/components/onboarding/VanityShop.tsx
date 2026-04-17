/**
 * VanityShop.tsx — 靓号市场（注册完成后首次引导）
 *
 * V1.4.1 方案 A 流程：Welcome → GenerateMnemonic → SetNickname → [注册] → [VanityShop] → main
 *
 * 功能：
 *  - 搜索 + 精选靓号列表（公开接口，无需 JWT）
 *  - 选号 → POST /api/v1/vanity/purchase（需 JWT）→ 显示 TRON 收款弹窗
 *  - 倒计时（15min）+ 监听 WS payment_confirmed 事件
 *  - confirmed → client.vanity.bind(orderId) → 更新 aliasId → setRoute('main')
 *  - 跳过 → setRoute('main')
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { client } from '../../lib/imClient';
import type { VanityItem, PurchaseOrder } from '@daomessage_sdk/sdk';
import {
  Search, Sparkles, Star, ChevronRight, X, Check,
  Loader2, ArrowRight, Tag, Clock, ShieldCheck
} from 'lucide-react';

// ─── 工具：格式化倒计时 ────────────────────────────────────────
function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '已过期';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── 子组件：靓号卡片 ──────────────────────────────────────────
function VanityCard({
  item,
  onBuy,
  disabled,
}: {
  item: VanityItem;
  onBuy: (item: VanityItem) => void;
  disabled: boolean;
}) {
  return (
    <div className="group flex items-center justify-between bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl px-4 py-3 transition-all cursor-pointer"
      onClick={() => !disabled && onBuy(item)}>
      {/* 左侧：靓号预览 */}
      <div className="flex items-center gap-3">
        {item.is_featured && (
          <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400/50" />
          </div>
        )}
        {!item.is_featured && (
          <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4 text-blue-400" />
          </div>
        )}
        <div>
          <p className="font-bold text-zinc-100 tracking-wider text-base font-mono">
            {item.alias_id}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {item.is_featured ? '精选靓号' : '靓号'}
          </p>
        </div>
      </div>
      {/* 右侧：价格 + 购买按钮 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-blue-400">{item.price_usdt} USDT</p>
        </div>
        <div className="w-7 h-7 bg-blue-600/20 group-hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
          <ChevronRight className="w-4 h-4 text-blue-400 group-hover:text-white transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ─── 子组件：支付弹窗（V1.5.0 NOWPayments 版）─────────────────
function PaymentModal({
  order,
  onConfirmed,
  onClose,
}: {
  order: PurchaseOrder;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const [countdown, setCountdown] = useState(formatCountdown(order.expired_at));
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // 倒计时更新
  useEffect(() => {
    const t = setInterval(() => setCountdown(formatCountdown(order.expired_at)), 1000);
    return () => clearInterval(t);
  }, [order.expired_at]);

  // 开始轮询订单状态（兜底，IPN 会走 WS payment_confirmed）
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
          setPollError('订单已过期，请重新选号。');
          setPolling(false);
        }
      } catch {
        // 网络临时异常，继续轮询
      }
    }, 3000);
  }, [order.order_id, onConfirmed]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleOpenPayment = () => {
    window.open(order.payment_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-100">安全支付</h3>
              <p className="text-[10px] text-zinc-500">由 NOWPayments 提供支付服务</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 靓号预览 */}
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 mb-4 text-center">
          <p className="text-xs text-blue-400 mb-1">你将获得的靓号</p>
          <p className="text-2xl font-bold font-mono tracking-widest text-white">{order.alias_id}</p>
          <p className="text-sm text-zinc-400 mt-1">{order.price_usdt} USDT</p>
        </div>

        {/* 说明文字 */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-3 mb-4 space-y-2">
          <p className="text-xs text-zinc-400 leading-relaxed">
            💳 点击下方按钮，在 NOWPayments 完成 USDT 支付。
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            支付完成后，靓号将自动绑定到你的账户，无需手动操作。
          </p>
        </div>

        {/* 倒计时 */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>订单将在 <span className={`font-mono font-bold ${countdown === '已过期' ? 'text-red-400' : 'text-amber-400'}`}>{countdown}</span> 后过期</span>
        </div>

        {pollError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">{pollError}</p>
        )}

        {/* 主操作：前往支付 */}
        <button
          onClick={handleOpenPayment}
          disabled={countdown === '已过期'}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 mb-2"
        >
          <ArrowRight className="w-4 h-4" />
          前往 NOWPayments 支付
        </button>

        {/* 次操作：我已付款（触发轮询兜底） */}
        {!polling ? (
          <button
            onClick={startPolling}
            disabled={countdown === '已过期'}
            className="w-full py-2.5 text-sm text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-3.5 h-3.5" />
            已完成支付，等待确认
          </button>
        ) : (
          <button disabled className="w-full py-2.5 text-sm text-blue-300 bg-blue-600/20 rounded-2xl flex items-center justify-center gap-2 cursor-wait">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            正在确认支付状态...
          </button>
        )}

        <p className="text-center text-[10px] text-zinc-600 mt-3">
          支付成功后将自动跳转，无需手动点击
        </p>
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────
export function VanityShop() {
  const { setRoute, setUserInfo, userId, nickname } = useAppStore();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<VanityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState('');

  // 初始加载精选列表
  useEffect(() => {
    client.vanity.search().then(setItems).catch(console.warn).finally(() => setLoading(false));
  }, []);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await client.vanity.search(query.trim() || undefined);
        setItems(res);
      } catch {
        // 搜索失败忽略
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleBuy = async (item: VanityItem) => {
    setBuyingId(item.alias_id);
    setError('');
    try {
      const purchaseOrder = await client.vanity.purchase(item.alias_id);
      // 立即打开 NOWPayments 支付页
      if (purchaseOrder.payment_url) {
        window.open(purchaseOrder.payment_url, '_blank', 'noopener,noreferrer');
      }
      setOrder(purchaseOrder);
    } catch (e: any) {
      if (e.message?.includes('409')) {
        setError(`「${item.alias_id}」已被其他人抢占，请换一个吧。`);
      } else {
        setError('网络错误，请稍后重试。');
      }
    } finally {
      setBuyingId(null);
    }
  };

  // 支付确认回调：绑定靓号到账户再进入主界面
  const handleConfirmed = async () => {
    if (!order) return;
    try {
      const { alias_id } = await client.vanity.bind(order.order_id);
      setUserInfo(userId, alias_id, nickname);
      localStorage.setItem('sc_alias_id', alias_id);
    } catch (e) {
      console.warn('[VanityShop] bind failed, proceeding anyway:', e);
    }
    setRoute('main');
  };

  const handleSkip = () => {
    setRoute('main'); // V1.4.1 方案 A：跳过直接进入主界面
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* 顶栏 */}
      <div className="sticky top-0 bg-zinc-950/90 backdrop-blur-md z-10 border-b border-zinc-900/50 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            靓号市场
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">注册成功！选购专属靓号（可跳过）</p>
        </div>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-xl transition-colors"
        >
          跳过 <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 说明条幅 */}
      <div className="mx-4 mt-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl px-4 py-3">
        <p className="text-xs text-amber-300/80 leading-relaxed">
          🏅 靓号是你在 SecureChat 的专属 ID，好记且独一无二。
          当前仅支持新账号首次登录时选号，支付后即刻绑定到你的账户。
        </p>
      </div>

      {/* 搜索框 */}
      <div className="px-4 mt-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索靓号关键字，如 888..."
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-blue-500/60 rounded-2xl py-3 pl-9 pr-4 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* 列表区 */}
      <div className="flex-1 px-4 mt-4 pb-8 space-y-2.5">
        {/* 区块标题 */}
        <div className="flex items-center gap-2 pb-1">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/50" />
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {query.trim() ? '搜索结果' : '精选靓号'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-sm">正在加载靓号列表...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
            <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center">
              <Search className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-500">
              {query.trim() ? `未找到包含「${query}」的靓号` : '暂无可用靓号，稍后重试'}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.alias_id} className="relative">
              <VanityCard
                item={item}
                onBuy={handleBuy}
                disabled={buyingId !== null}
              />
              {buyingId === item.alias_id && (
                <div className="absolute inset-0 bg-zinc-950/60 rounded-2xl flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 支付弹窗 */}
      {order && (
        <PaymentModal
          order={order}
          onConfirmed={handleConfirmed}
          onClose={() => setOrder(null)}
        />
      )}
    </div>
  );
}
