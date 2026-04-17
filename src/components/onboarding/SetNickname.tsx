import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Loader2 } from 'lucide-react';

export function SetNickname() {
  const { tempMnemonic, setRoute, setSdkReady, setUserInfo } = useAppStore();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (!nickname.trim()) { setError('必须填写昵称'); return; }
    setLoading(true);
    setError('');
    
    try {
      const { client, initIMClient } = await import('../../lib/imClient');
      const { clearIdentity } = await import('@daomessage_sdk/sdk');

      // 🧹 注册新账号前：先清除浏览器中可能存在的上一个账号的本地数据
      // 场景：用户在同一浏览器注销后重新注册，旧的 IndexedDB sessions/messages 仍残留
      // 不清除会导致新账号登录后直接看到旧账号的联系人和消息列表
      try {
        await client.clearAllHistory(); // 清除 IndexedDB messages + sessions
        await clearIdentity();          // 清除 IndexedDB identity
      } catch (_) { /* 首次注册时无旧数据，忽略错误 */ }
      // 清除 localStorage 旧账号信息
      localStorage.removeItem('sc_alias_id');
      localStorage.removeItem('sc_nickname');
      localStorage.removeItem('sc_token');
      localStorage.removeItem('sc_uuid');

      // V1.4.1 方案 A：注册时不再传 vanityOrderId，靓号在注册后通过 bind() 接口绑定
      const { aliasId } = await client.auth.registerAccount(tempMnemonic, nickname.trim());
      
      localStorage.setItem('sc_alias_id', aliasId);
      localStorage.setItem('sc_nickname', nickname.trim());
      setUserInfo('', aliasId, nickname.trim());
      
      initIMClient();
      
      if ('Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker?.ready.then(reg =>
          client.push.enablePushNotifications(reg).catch(console.warn)
        );
      }
      
      setSdkReady(true);
      setRoute('vanity_shop'); // V1.4.1 方案 A：注册后进入靓号引导页
    } catch (e: any) {
      setError(`注册失败: ${e.message || '未知错误'}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-6 pt-32">
      <div className="max-w-xs w-full space-y-8">
        <h2 className="text-2xl font-bold text-center">最后一步</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="输入您的昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={loading}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-blue-500 rounded-lg py-3 px-4 outline-none text-zinc-100 transition-colors"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full flex justify-center items-center py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '完成注册并进入'}
          </button>
        </div>
      </div>
    </div>
  );
}
