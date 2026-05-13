/**
 * KeyVerificationModal · 1.0.37 方案 Y 三状态版
 *
 * 三状态 UI(对应 SDK trustState):
 *   1. unverified         → 输入框 + 我的码 + 对方码核对
 *   2. my_side_verified   → "已完成你这边核对,等对方"(无输入框)
 *   3. verified           → 父组件感知后立刻关 modal(modal 自己不显示这态)
 *
 * 核心改动 (vs 1.0.36 单码模式):
 *  - A 看到的「我的码」 ≠ B 看到的「我的码」 (各自不同, 用户体感像"互发独立密码")
 *  - 但底层是 ECDH 派生 (SDK 自动算), 不是用户自创短口令
 *  - 真正防 MITM: 服务端替换公钥 → 双方算出的码不匹配 → 比对失败 → 用户察觉
 *
 * 流程 (spec §4.1 V2):
 *  1. A 看「我的码」(SDK directional code) + 「展开看完整指纹」(高级模式)
 *  2. A 通过 [分享给对方] / [复制] 把"我的码"发给 B
 *  3. A 收到 B 发来的"B 的码", 输入到「对方的码」框
 *  4. 点[确认核对]: SDK 本地算"对方应该发什么码" → 比对 A 输入的
 *  5. 一致 → SDK markMyVerified() → trustState=my_side_verified + 调服务端 verify-mark
 *  6. UI 切到 "已完成你这边核对" 状态(不立即关闭, 用户可继续等)
 *  7. B 同样流程
 *  8. 双方都完成 → 服务端 NATS friend_verified → trustState=verified → 父组件关 modal + 解锁聊天
 *
 * 失败处理 (D7=a):
 *  - 1/2 次: 普通提示
 *  - 第 3 次: 警告 + [继续尝试] / [稍后再说]
 */

import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Share2, Copy, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  computeDirectionalCode,
  normalizeDirectionalCode,
  computeSecurityCode,
  formatSecurityCode,
  computeSharedSecret,
  loadSession,
  loadIdentity,
  deriveIdentity,
  markMyVerified,
  fromBase64,
} from '@daomessage_sdk/sdk';

export interface KeyVerificationModalProps {
  /** 会话 ID */
  conversationId: string;
  /** 对方的 alias_id (用于显示和分享文案) */
  theirAliasId: string;
  /** 对方的 friendship_id (调 verify-mark 用) */
  friendshipId: number;
  /** 关闭回调 (用户点取消或核对成功) */
  onClose: () => void;
}

type ModalView = 'loading' | 'input' | 'waiting';

export function KeyVerificationModal({
  conversationId,
  theirAliasId,
  friendshipId,
  onClose,
}: KeyVerificationModalProps) {
  // 当前 UI 视图: loading=正在读 session / input=输入对方码 / waiting=已完成等对方
  const [view, setView] = useState<ModalView>('loading');

  // 我对外发的码 (用户看到 + 复制分享)
  const [myCode, setMyCode] = useState<string>('');
  // 我应该收到对方什么码 (本地比对用, 不显示给用户)
  const [expectedTheirCode, setExpectedTheirCode] = useState<string>('');
  // 高级模式: 完整 60 位 hex 公钥指纹 (双方一致)
  const [fingerprint60Hex, setFingerprint60Hex] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [inputCode, setInputCode] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);
  const [error, setError] = useState<'' | 'length' | 'mismatch' | 'mismatch_3' | string>('');
  const [submitting, setSubmitting] = useState(false);

  // 启动时:
  //  1. 读 session 看当前 trustState — 如果已经 my_side_verified, 直接进 waiting 视图
  //  2. 计算双向码(无论什么 trustState 都需要,因为 waiting 视图也要展示我的码方便分享)
  useEffect(() => {
    (async () => {
      try {
        const session = await loadSession(conversationId);
        if (!session) {
          console.error('[KeyVerify] no session for', conversationId);
          return;
        }
        const ident = await loadIdentity();
        if (!ident?.mnemonic) {
          console.error('[KeyVerify] no identity');
          return;
        }
        const fullIdent = deriveIdentity(ident.mnemonic);
        const myPub = fullIdent.ecdhKey.publicKey;
        const myPriv = fullIdent.ecdhKey.privateKey;
        const theirPub = fromBase64(session.theirEcdhPublicKey);

        // ECDH 共享密钥
        const shared = computeSharedSecret(myPriv, theirPub);

        // 我对外发的码 = directionalCode(我公钥, 对方公钥)
        const mine = computeDirectionalCode(shared, myPub, theirPub);
        // 我应该收到对方什么码 = directionalCode(对方公钥, 我公钥)
        const expected = computeDirectionalCode(shared, theirPub, myPub);

        setMyCode(mine);
        setExpectedTheirCode(expected);

        // 高级模式: 双方公钥共同 hash (60 hex), 双方一致, 用于极客对照
        setFingerprint60Hex(computeSecurityCode(myPub, theirPub));

        // 决定初始视图
        if (session.trustState === 'my_side_verified') {
          setView('waiting');
        } else {
          // 'unverified' 或 undefined / 'verified' (verified 不会显示 modal, 父组件会关)
          setView('input');
        }
      } catch (e) {
        console.error('[KeyVerify] compute code failed:', e);
      }
    })();
  }, [conversationId]);

  const inputNormalized = useMemo(() => normalizeDirectionalCode(inputCode), [inputCode]);
  const expectedNormalized = useMemo(() => normalizeDirectionalCode(expectedTheirCode), [expectedTheirCode]);
  const myCodeLen = normalizeDirectionalCode(myCode).length; // 应该是 16

  const handleShare = async () => {
    const text = `我在 DAO Message 给你发的核对码 (与 @${theirAliasId} 的会话):\n\n${myCode}\n\n请在 DAO Message 的核对窗口里输入此码核对。如果不一致, 可能存在中间人攻击, 请立即停止使用此会话。`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'DAO Message 核对码', text });
        return;
      } catch {
        // user cancelled or not allowed, fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('已复制到剪贴板, 请粘贴到微信/邮件/短信发给对方');
    } catch {
      alert('复制失败, 请手动选中码长按复制');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      alert('已复制核对码');
    } catch {
      alert('复制失败');
    }
  };

  const handleVerify = async () => {
    if (submitting) return;
    setError('');

    // 长度检查 (归一化后必须 16 字符 base32)
    if (inputNormalized.length !== myCodeLen) {
      setError('length');
      return;
    }

    // 比对: 用户输入的应该等于 SDK 算出的"对方应该发我的码"
    if (inputNormalized !== expectedNormalized) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= 3) {
        setError('mismatch_3');
      } else {
        setError('mismatch');
      }
      return;
    }

    // 一致 → 调 SDK markMyVerified
    setSubmitting(true);
    try {
      await markMyVerified(
        'https://relay.daomessage.com',
        await getToken(),
        friendshipId,
        conversationId
      );
      // trustState=my_side_verified, 切到等待视图(不关 modal)
      // 当对方也完成核对后, 父组件 onTrustStateChange 监听到 verified 会主动关 modal
      setView('waiting');
    } catch (e: any) {
      console.error('[KeyVerify] markMyVerified failed:', e);
      setError(`核对上报失败: ${e?.message || '网络错误'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10001] bg-black/70 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in cursor-default"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {view === 'loading' && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
            <div className="text-sm text-zinc-500">正在读取核对状态...</div>
          </div>
        )}

        {view === 'waiting' && (
          <>
            <div className="mb-5">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                已完成你这边的核对
              </h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                你已经成功确认了 <strong className="text-zinc-200">@{theirAliasId}</strong> 的核对码。
                现在等对方也完成核对,双方都完成后会自动解锁聊天。
              </p>
            </div>

            {/* waiting 状态的我的码: 给用户参考(对方可能还没收到我的码) */}
            <div className="mb-4">
              <div className="text-xs text-zinc-500 mb-2">我的核对码 (如果对方还没收到, 可重新发送):</div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-base text-zinc-100 leading-relaxed text-center select-all tracking-wider">
                {myCode || '正在计算...'}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={handleShare}
                  disabled={!myCode}
                  className="py-2 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-medium flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> 重新分享
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!myCode}
                  className="py-2 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-medium flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> 复制
                </button>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2 text-blue-300 text-sm font-medium mb-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                等待对方核对中
              </div>
              <div className="text-xs text-zinc-400 leading-relaxed">
                当 <strong className="text-zinc-200">@{theirAliasId}</strong> 完成核对后, 此页面会自动关闭并解锁聊天。
                你可以先关闭此窗口, 收到对方核对完成的通知后会自动解锁。
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
            >
              关闭
            </button>
          </>
        )}

        {view === 'input' && (
          <>
            <div className="mb-5">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                核对安全码
              </h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                为了确保平台无法窃听, 双方需通过<strong className="text-amber-300">外部渠道(微信/邮件/短信)</strong>互相发送各自的核对码。
                <strong className="text-zinc-300"> 双方的码不一样, 这是正常的</strong>(由密钥派生)。
              </p>
            </div>

            {/* 我的码 (发给对方) */}
            <div className="mb-4">
              <div className="text-xs text-zinc-500 mb-2">我的核对码 (发给对方核对):</div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-base text-zinc-100 leading-relaxed text-center select-all tracking-wider">
                {myCode || '正在计算...'}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={handleShare}
                  disabled={!myCode}
                  className="py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> 分享给对方
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!myCode}
                  className="py-2 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-medium flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> 复制
                </button>
              </div>
            </div>

            {/* 对方的码输入 */}
            <div className="mb-4">
              <div className="text-xs text-zinc-500 mb-2">对方的核对码 (从对方那里收到):</div>
              <input
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value);
                  if (error === 'length' || error === 'mismatch') setError('');
                }}
                placeholder="粘贴对方发来的核对码 (允许带横线/空格)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 outline-none focus:border-blue-500 text-sm tracking-wider font-mono"
              />
              <div className="text-[10px] text-zinc-600 mt-1">
                已输入 {inputNormalized.length} / {myCodeLen} 字符
              </div>
            </div>

            {/* 高级模式: 完整 60 位 hex 公钥指纹 */}
            <div className="mb-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAdvanced ? '隐藏完整指纹' : '展开看完整指纹 (高级)'}
              </button>
              {showAdvanced && fingerprint60Hex && (
                <div className="mt-2 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                  <div className="text-[10px] text-zinc-500 mb-1">SHA-256 公钥指纹 (双方一致, 60 hex):</div>
                  <div className="font-mono text-[10px] text-zinc-400 leading-relaxed break-all">
                    {formatSecurityCode(fingerprint60Hex)}
                  </div>
                </div>
              )}
            </div>

            {/* 错误提示 */}
            {error === 'length' && (
              <div className="text-yellow-400 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5 mb-3">
                请输入完整的 {myCodeLen} 位核对码
              </div>
            )}
            {error === 'mismatch' && (
              <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 mb-3">
                码不一致, 请仔细对照横线和字符 ({attempts}/3)
              </div>
            )}
            {error === 'mismatch_3' && (
              <div className="text-red-400 text-xs bg-red-500/10 border-2 border-red-500/50 rounded-lg p-3 mb-3 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  已 3 次不一致 — 严重警告
                </div>
                <div className="text-zinc-300 leading-relaxed">
                  这通常意味着:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-zinc-400">
                    <li>你或对方复制错位 — 用另一渠道再发一次</li>
                    <li>服务端可能在中间攻击 — 强烈建议删除会话重新加好友</li>
                  </ul>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setAttempts(0);
                      setError('');
                      setInputCode('');
                    }}
                    className="flex-1 py-1.5 rounded text-xs bg-zinc-800 hover:bg-zinc-700"
                  >
                    继续尝试
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-1.5 rounded text-xs bg-zinc-800 hover:bg-zinc-700"
                  >
                    稍后再说
                  </button>
                </div>
              </div>
            )}
            {error && error !== 'length' && error !== 'mismatch' && error !== 'mismatch_3' && (
              <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 mb-3">
                {error}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-3 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-medium"
              >
                稍后核对
              </button>
              <button
                onClick={handleVerify}
                disabled={submitting || !myCode || inputNormalized.length === 0}
                className="flex-1 py-3 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
              >
                {submitting ? '提交中...' : '确认核对'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 工具: 从 imClient 拿 token ────────────────────────────
async function getToken(): Promise<string> {
  const { client } = await import('../../lib/imClient');
  return (client as any).http?.getToken?.() ?? '';
}
