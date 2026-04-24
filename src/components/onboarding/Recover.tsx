import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { validateMnemonicWords } from '@daomessage_sdk/sdk';
import { Loader2 } from 'lucide-react';

export function Recover() {
  const { setRoute, setSdkReady, setUserInfo } = useAppStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRecover = async () => {
    const m = input.trim();
    const words = m.split(/[\s]+/).filter(w => w.length > 0);
    if (words.length < 12) { setError('请输入 12 个单词'); return; }
    
    const formatted = words.join(' ');
    if (!validateMnemonicWords(formatted)) { setError('助记词无效，请检查拼写'); return; }
    
    setLoading(true);
    setError('');
    
    try {
      const { client, initIMClient } = await import('../../lib/imClient');
      
      // 先尝试 registerAccount，SDK 内部会处理 409 (已存在) 情况
      const savedNickname = localStorage.getItem('sc_nickname') || 'User';
      const { aliasId } = await client.auth.registerAccount(formatted, savedNickname);
      
      localStorage.setItem('sc_alias_id', aliasId);
      setUserInfo('', aliasId, savedNickname);
      
      initIMClient();
      
      if ('Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker?.ready.then(reg =>
          client.push.enablePushNotifications(reg).catch(console.warn)
        );
      }
      
      setSdkReady(true);
      setRoute('main');
    } catch (e: any) {
      console.error('[Recover] failed:', e);
      setError(e.message || '恢复失败，请检查助记词');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-6 pt-32">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold">恢复账户</h2>
          <p className="text-zinc-400 text-sm mt-2">请输入您的 12 词安全助记词，用空格间隔。</p>
        </div>
        
        <div className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="word1 word2 word3..."
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            data-gramm="false"
            className="w-full h-32 bg-zinc-900 border border-zinc-800 focus:border-blue-500 rounded-lg p-4 outline-none text-zinc-100 font-mono resize-none transition-colors disabled:opacity-50"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          
          <div className="flex gap-4">
            <button 
              onClick={() => setRoute('welcome')} 
              disabled={loading}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-lg text-sm text-zinc-300 transition-colors disabled:opacity-50"
            >
              返回
            </button>
            <button 
              onClick={handleRecover} 
              disabled={loading}
              className="flex-[2] bg-blue-500 hover:bg-blue-600 py-3 rounded-lg font-medium shadow-lg shadow-blue-900/20 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '恢复账户'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
