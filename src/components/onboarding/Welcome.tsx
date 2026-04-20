import { useAppStore } from '../../store/appStore';
import { newMnemonic } from '@daomessage_sdk/sdk';

export function Welcome() {
  const { setRoute, setTempMnemonic } = useAppStore();

  const handleStart = () => {
    const m = newMnemonic();        // 🔒 SDK：生成 12 词
    setTempMnemonic(m);             // 👤 App：暂存到 Zustand
    setRoute('generate_mnemonic');  // 👤 App：跳转展示助记词
  };

  const handleRecover = () => setRoute('recover');

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          DAO Message
        </h1>
        <p className="text-zinc-400">零知识端到端加密通讯 — 由你掌控的去中心化即时通讯</p>
      </div>
      <div className="flex flex-col w-full max-w-sm gap-4 mt-8">
        <button className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors" onClick={handleStart}>
          创建新账户
        </button>
        <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-lg font-medium transition-colors" onClick={handleRecover}>
          恢复已有账户
        </button>
      </div>
      {/* 底部入口: 装到手机 / 部署自己的, 不打断核心 onboarding 流程 */}
      <div className="pt-6 text-center text-sm text-zinc-500">
        <a href="/install" className="hover:text-zinc-300 underline-offset-4 hover:underline transition-colors">
          安装到手机 · 部署你自己的 →
        </a>
      </div>
    </div>
  );
}
