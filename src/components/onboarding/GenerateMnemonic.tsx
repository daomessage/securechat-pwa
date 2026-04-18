import { useAppStore } from '../../store/appStore';
import { useState } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';

export function GenerateMnemonic() {
  const { tempMnemonic, setRoute } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState(false);

  const words = tempMnemonic.split(' ');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tempMnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // 60 秒后尝试清空剪贴板（若剪贴板里仍是我们的助记词）
    // Web API 有权限限制：document 失焦后可能读不到剪贴板，只能写
    setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === tempMnemonic) {
          await navigator.clipboard.writeText('');
        }
      } catch {
        // 失焦或权限拒绝：无法清空，仅日志
        console.info('[SecureChat] clipboard auto-clear skipped (permission)');
      }
    }, 60_000);
  };

  const currentStep = () => {
    if (checked) {
      setRoute('set_nickname'); // V1.4.1 方案 A：助记词 → 昵称 → 注册 → 靓号引导
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-6 pt-20">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">备份您的安全身份</h2>
          <p className="text-zinc-400 text-sm">这些单词是您恢复账户的唯一凭证，请使用纸笔抄写并妥善保管，切勿泄露给他人。</p>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          {words.map((w, idx) => (
            <div key={idx} className="bg-zinc-950 rounded py-2 px-3 flex gap-2 border border-zinc-800/50">
              <span className="text-zinc-600 text-xs select-none mt-1">{idx + 1}</span>
              <span className="text-zinc-100 font-mono tracking-wide">{w}</span>
            </div>
          ))}
        </div>

        <button 
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
        >
          <Copy className="w-4 h-4" />
          {copied ? '已复制到剪贴板' : '复制全部助记词'}
        </button>

        <div className="flex items-center gap-3 py-4 cursor-pointer" onClick={() => setChecked(!checked)}>
          <div className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-zinc-700 bg-zinc-900'}`}>
            {checked && <ShieldCheck className="w-4 h-4 text-white" />}
          </div>
          <span className="text-zinc-300 text-sm">我已安全在本地备份助记词</span>
        </div>

        <button 
          disabled={!checked}
          onClick={currentStep}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20"
        >
          下一步设置昵称
        </button>
      </div>
    </div>
  );
}
