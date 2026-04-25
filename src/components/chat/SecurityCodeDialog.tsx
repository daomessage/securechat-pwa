/**
 * SecurityCodeDialog · 端到端安全码核验弹窗
 * 对齐 Android SecurityCodeDialog.kt / iOS SecurityVerifyView.swift
 *
 * 职责:
 *  - 显示双方会话的 40 字符 hex 指纹
 *  - 让用户通过其他安全渠道核对前 8 位
 *  - 输入对方安全码前 8 位 → 本地校验 → markSessionVerified
 *
 * 零知识: securityCode 从客户端 SDK 派生, 服务端永远无法看到
 */

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { markSessionVerified } from '@daomessage_sdk/sdk';

export interface SecurityCodeDialogProps {
  /** 当前会话 ID (用于 markSessionVerified) */
  conversationId: string;
  /** 40 字符 hex 安全码 (computeSecurityCode 的输出) */
  securityCode: string;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 核验成功后的回调 (App 层应更新 trustVerified 状态) */
  onVerified: () => void;
}

type VerifyError = '' | 'length' | 'mismatch';

export function SecurityCodeDialog({
  conversationId,
  securityCode,
  onClose,
  onVerified,
}: SecurityCodeDialogProps) {
  const [inputCode, setInputCode] = useState('');
  const [verifyError, setVerifyError] = useState<VerifyError>('');

  const handleMarkVerified = async () => {
    const target = securityCode.slice(0, 8).toLowerCase();
    const clean = inputCode.trim().toLowerCase();

    if (clean.length < 8) {
      setVerifyError('length');
      return;
    }
    if (clean.slice(0, 8) !== target) {
      setVerifyError('mismatch');
      return;
    }

    await markSessionVerified(conversationId);
    setVerifyError('');
    onVerified();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in cursor-default"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 space-y-2">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-green-500" />
            核对安全指纹
          </h3>
          <p className="text-zinc-400 text-xs">
            通过其他安全渠道确认前 8 个字符。如完全一致,代表无人窃听你们的端到端通信。
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-center text-xl tracking-[0.2em] break-all leading-tight">
          <span className="text-white font-bold">{securityCode.slice(0, 8)}</span>
          <span className="text-zinc-600">{securityCode.slice(8, 20)}...</span>
        </div>

        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="在此输入对方安全码前 8 位核验"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 outline-none focus:border-blue-500 text-sm tracking-wider font-mono text-center"
          />
          {verifyError === 'length' && (
            <p className="text-yellow-500 text-[10px] text-center">请输入完整的 8 位凭证</p>
          )}
          {verifyError === 'mismatch' && (
            <p className="text-red-500 text-[10px] text-center font-bold bg-red-500/10 py-1 rounded">
              ⚠️ 不匹配!这或许存在伪造,已阻止确认。
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleMarkVerified}
            className="flex-1 py-2.5 rounded-lg text-sm bg-blue-500 hover:bg-blue-600 font-medium transition-colors"
          >
            确认可信
          </button>
        </div>
      </div>
    </div>
  );
}
