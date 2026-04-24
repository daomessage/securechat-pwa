import { useAppStore } from '../../store/appStore';
import { newMnemonic } from '@daomessage_sdk/sdk';
import { Button } from '../ui/Button';

export function Welcome() {
  const { setRoute, setTempMnemonic } = useAppStore();

  const handleStart = () => {
    const m = newMnemonic();
    setTempMnemonic(m);
    setRoute('generate_mnemonic');
  };

  const handleRecover = () => setRoute('recover');

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
          DAO Message
        </h1>
        <p className="text-zinc-400 text-sm">零知识端到端加密通讯 · 由你掌控的去中心化即时通讯</p>
      </div>

      <div className="flex flex-col w-full max-w-sm gap-3 mt-8">
        <Button variant="primary"   fullWidth onClick={handleStart}>创建新账户</Button>
        <Button variant="secondary" fullWidth onClick={handleRecover}>恢复已有账户</Button>
      </div>

      {/* 底部入口链接 — 安装到手机 / 部署你自己的 */}
      <div className="pt-6 text-center text-xs text-zinc-500">
        <a href="/install" className="hover:text-zinc-300 underline-offset-4 hover:underline transition-colors">
          安装到手机 · 部署你自己的 →
        </a>
      </div>
    </div>
  );
}
