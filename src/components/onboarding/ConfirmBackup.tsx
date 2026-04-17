import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * 备份确认页 — 要求用户从助记词中选出指定位置的词来证明已备份
 * 安全关口：不允许跳过或直接前进
 */
export function ConfirmBackup() {
  const { tempMnemonic, setRoute } = useAppStore();
  const words = tempMnemonic.split(' ');
  
  // 随机选3个位置让用户验证（每次进入页面固定，基于词首字母简单哈希）
  const pickIndexes = (() => {
    const seed = words.reduce((s, w) => s + w.charCodeAt(0), 0);
    const idxs: number[] = [];
    let s = seed;
    while (idxs.length < 3) {
      s = (s * 7 + 13) % 12;
      if (!idxs.includes(s)) idxs.push(s);
    }
    return idxs.sort((a, b) => a - b);
  })();

  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [showError, setShowError] = useState(false);

  const allCorrect = pickIndexes.every((idx, i) => 
    answers[i].trim().toLowerCase() === words[idx].toLowerCase()
  );

  const handleVerify = () => {
    if (allCorrect) {
      setRoute('set_nickname');
    } else {
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-6 pt-16">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
            <ShieldCheck className="w-8 h-8 text-blue-500 pointer-events-none" />
          </div>
          <h2 className="text-2xl font-bold">确认您已备份</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            请输入助记词中指定位置的单词，以证明您已妥善保存。
            <br />
            <span className="text-yellow-500/80 text-xs">如果丢失助记词，将永远无法恢复账户。</span>
          </p>
        </div>

        <div className="space-y-4">
          {pickIndexes.map((wordIdx, i) => (
            <div key={wordIdx} className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium pl-1">
                第 <span className="text-white font-bold">{wordIdx + 1}</span> 个单词
              </label>
              <input
                type="text"
                value={answers[i]}
                onChange={e => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                  setShowError(false);
                }}
                placeholder={`请输入第 ${wordIdx + 1} 个单词`}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm font-mono tracking-wide outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-600"
              />
            </div>
          ))}
        </div>

        {showError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0 pointer-events-none" />
            <span>验证失败，请检查拼写。如需重新查看，请返回上一步。</span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setRoute('generate_mnemonic')}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-medium transition-colors text-sm"
          >
            返回查看
          </button>
          <button
            onClick={handleVerify}
            disabled={answers.some(a => !a.trim())}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 text-sm"
          >
            确认无误 <ArrowRight className="w-4 h-4 pointer-events-none" />
          </button>
        </div>
      </div>
    </div>
  );
}
