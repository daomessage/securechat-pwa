import { useState, useEffect } from 'react';
import { client } from '../../lib/imClient';
import { useAppStore } from '../../store/appStore';
import { loadIdentity, clearIdentity } from '@daomessage_sdk/sdk';
import { LogOut, Copy, Fingerprint, Activity, Download, Bell, Store, Loader2, Info, GitBranch } from 'lucide-react';
import { useSdkAction } from '../../hooks/useSdkAction';

export function SettingsTab() {
  const { setRoute, setUserInfo, setSdkReady, aliasId, nickname } = useAppStore();
  const [localAlias, setLocalAlias] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [showIdentity, setShowIdentity] = useState(false);
  const [mnemonicText, setMnemonicText] = useState('');
  const [pushStatus, setPushStatus] = useState<string>('Notification' in window ? Notification.permission : 'unsupported');

  const { execute: registerPush, isProcessing: isRegisteringPush } = useSdkAction(
    async () => {
      const sw = await navigator.serviceWorker?.ready;
      if (sw) await client.push.enablePushNotifications(sw);
    },
    { onSuccess: () => alert('离线推送开启成功！') }
  );

  useEffect(() => {
    setLocalAlias(localStorage.getItem('sc_alias_id') || aliasId);
    client.http.get('/api/v1/storage/estimate').then(setStats).catch(()=>{});
  }, [aliasId]);

  const handleLogout = async () => {
    if (!confirm('清理本地身份将无法恢复。如果您没有保存助记词，所有资产与聊天关系将丢失。确认退出？')) return;
    client.disconnect();
    await clearIdentity();
    await client.messages.clearAllConversations();
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_uuid');
    localStorage.removeItem('sc_alias_id');
    localStorage.removeItem('sc_nickname');
    
    setUserInfo('', '', '');
    setSdkReady(false);
    setRoute('welcome');
  };

  const handleShowIdentity = async () => {
    if (!confirm('警告：泄露助记词将导致账户及资金被盗！请确保四周无人注视屏幕。')) return;
    const ident = await loadIdentity();
    if (ident && ident.mnemonic) {
      setMnemonicText(ident.mnemonic);
      setShowIdentity(true);
    }
  };

  const handleExport = async () => {
    try {
      const blobURL = await client.messages.exportAll();
      const a = document.createElement('a');
      a.href = blobURL;
      a.download = `securechat_backup_${new Date().toISOString().split('T')[0]}.ndjson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobURL);
    } catch (e) { alert('导出失败'); }
  };

  const requestPush = async () => {
    if (!('Notification' in window)) return;
    try {
      const p = await Notification.requestPermission();
      setPushStatus(p);
      if (p === 'granted') {
        registerPush();
      } else {
        alert('已拒绝通知权限。如需开启，请在浏览器设置中解除限制。');
      }
    } catch (e) {
      console.error(e);
      alert('权限请求失败');
    }
  };

  return (
    <div className="flex-1 w-full bg-zinc-950 p-4 space-y-6">
      <h1 className="text-xl font-bold mb-4">设置中心</h1>

      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{nickname || '未设置昵称'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-400 font-mono tracking-wider">{localAlias}</span>
            <button className="text-zinc-500 hover:text-white transition-colors"
              onClick={() => { navigator.clipboard.writeText(localAlias); alert('已复制') }}>
              <Copy className="w-3 h-3 pointer-events-none" />
            </button>
          </div>
        </div>
        <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center font-bold text-lg">
          {(nickname || 'Me').slice(0,2).toUpperCase()}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-500 pl-1">安全与底层</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3"><Fingerprint className="w-5 h-5 text-green-500 pointer-events-none" /> <span className="text-sm">端到端加密算法</span></div>
            <span className="text-xs text-zinc-500 font-mono">X25519-AES-GCM</span>
          </div>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors" onClick={handleShowIdentity}>
            <div className="flex items-center gap-3"><Store className="w-5 h-5 text-purple-400 pointer-events-none" /> <span className="text-sm">查看助记词</span></div>
            <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">高度机密</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-500 pl-1">数据与设备</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50" onClick={requestPush}>
            <div className="flex items-center gap-3">
              {isRegisteringPush ? (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              ) : (
                <Bell className={`w-5 h-5 ${pushStatus === 'granted' ? 'text-blue-500' : 'text-zinc-500'}`} /> 
              )}
              <span className="text-sm">离线推送 (Web Push)</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${pushStatus === 'granted' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-400'}`}>
              {pushStatus === 'granted' ? '已开启' : (pushStatus === 'denied' ? '已拒绝' : '点击开启')}
            </span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3"><Activity className="w-5 h-5 text-orange-400 pointer-events-none" /> <span className="text-sm">服务端会话体积</span></div>
            <span className="text-xs text-zinc-400">{stats ? `${(stats.total_bytes / 1024).toFixed(2)} KB` : '获取中...'}</span>
          </div>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50" onClick={handleExport}>
            <div className="flex items-center gap-3"><Download className="w-5 h-5 text-cyan-400 pointer-events-none" /> <span className="text-sm">导出聊天数据 (NDJSON)</span></div>
          </div>
        </div>
      </div>

      {/* 版本信息 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-500 pl-1">版本信息</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-400 pointer-events-none" />
              <span className="text-sm">PWA 版本</span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">{__PWA_VERSION__}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Fingerprint className="w-5 h-5 text-blue-400 pointer-events-none" />
              <span className="text-sm">SDK 版本</span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">@daomessage_sdk/sdk @ {__SDK_VERSION__}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-blue-400 pointer-events-none" />
              <span className="text-sm">Git Commit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-mono">{__GIT_BRANCH__}@{__GIT_COMMIT__}</span>
              <button
                className="text-zinc-500 hover:text-white transition-colors"
                onClick={() => { navigator.clipboard.writeText(`${__GIT_BRANCH__}@${__GIT_COMMIT__}`); alert('已复制'); }}
              >
                <Copy className="w-3 h-3 pointer-events-none" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-400 pointer-events-none" />
              <span className="text-sm">构建时间</span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">{__BUILD_TIME__.slice(0, 19).replace('T', ' ')}</span>
          </div>
        </div>
      </div>

      <button className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-medium transition-colors mt-8" onClick={handleLogout}>
        <LogOut className="w-5 h-5 pointer-events-none" /> 彻底销毁本地记录并退出
      </button>

      {/* Mnemonic Modal */}
      {showIdentity && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowIdentity(false)}>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-bold text-red-500 mb-4 whitespace-nowrap">您的 12 词安全助记词</h3>
            <div className="grid grid-cols-3 gap-2">
              {mnemonicText.split(' ').map((w,i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 text-center py-2 text-sm text-zinc-300 rounded">{w}</div>
              ))}
            </div>
            <button onClick={() => setShowIdentity(false)} className="w-full bg-zinc-800 py-3 mt-6 rounded-lg font-medium text-sm">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
