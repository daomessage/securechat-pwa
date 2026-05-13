import { useState, useEffect } from 'react';
import { client } from '../../lib/imClient';
import { useAppStore } from '../../store/appStore';
import { loadIdentity, clearIdentity, PushNotificationError } from '@daomessage_sdk/sdk';
import { LogOut, Copy, Fingerprint, Activity, Download, Bell, Store, Loader2, Info, GitBranch, FileText, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSdkAction } from '../../hooks/useSdkAction';
import { isIOS, isStandalone, iOSSupportsWebPush, iOSVersion } from '../../lib/platform';
import { PwaDiagnostics } from '../pwa/PwaDiagnostics';

export function SettingsTab() {
  const { setRoute, setUserInfo, setSdkReady, aliasId, nickname } = useAppStore();
  const [localAlias, setLocalAlias] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [showIdentity, setShowIdentity] = useState(false);
  const [mnemonicText, setMnemonicText] = useState('');
  const [pushStatus, setPushStatus] = useState<string>('Notification' in window ? Notification.permission : 'unsupported');
  const [showChangelog, setShowChangelog] = useState(false);
  // 1.0.48: 推送错误 toast(替代之前的 alert),区分错误类型给具体修复建议
  const [pushToast, setPushToast] = useState<{
    kind: 'success' | 'error' | 'warn';
    title: string;
    detail: string;
    howTo?: string;
  } | null>(null);

  const { execute: registerPush, isProcessing: isRegisteringPush } = useSdkAction(
    async () => {
      const sw = await navigator.serviceWorker?.ready;
      if (!sw) throw new Error('Service Worker 未就绪,请刷新页面后重试');
      await client.push.enablePushNotifications(sw);
    },
    {
      onSuccess: () => {
        setPushStatus('granted');
        setPushToast({
          kind: 'success',
          title: '推送已开启',
          detail: '后台也能收到新消息通知。',
        });
      },
      onError: (e: unknown) => {
        // 1.0.48: 按 PushNotificationError.kind 给具体提示
        if (e instanceof PushNotificationError) {
          const map: Record<typeof e.kind, { title: string; detail: string; howTo?: string }> = {
            no_push_manager: {
              title: '浏览器不支持推送',
              detail: 'Service Worker 或 Push API 不可用',
              howTo: '请用 iOS Safari / Android Chrome / 桌面 Chrome,并确保 https 访问',
            },
            no_vapid_key: {
              title: '服务端配置缺失',
              detail: e.message,
              howTo: '联系运营方检查 VAPID_PUBLIC_KEY 配置',
            },
            permission_denied: {
              title: '通知权限被拒',
              detail: '系统/浏览器已拒绝通知权限',
              howTo: isIOS()
                ? 'iOS 设置 → 通知 → 找到 DAO Message → 打开「允许通知」'
                : '浏览器地址栏左侧 🔒 图标 → 通知 → 允许',
            },
            subscribe_failed: {
              title: '订阅失败',
              detail: e.message,
              howTo: isIOS()
                ? '必须先把 DAO Message 添加到主屏,再从主屏图标启动,才能开推送'
                : '检查浏览器是否被隐私模式 / 第三方扩展拦截',
            },
            register_failed: {
              title: '上报服务端失败',
              detail: e.message,
              howTo: '检查网络后重试',
            },
            unknown: {
              title: '推送开启失败',
              detail: e.message,
            },
          };
          const info = map[e.kind];
          setPushToast({ kind: 'error', ...info });
        } else {
          setPushToast({
            kind: 'error',
            title: '推送开启失败',
            detail: (e as Error)?.message || String(e),
          });
        }
      },
    }
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
    if (!('Notification' in window)) {
      setPushToast({
        kind: 'error',
        title: '浏览器不支持',
        detail: '当前浏览器不支持 Web 通知 API',
      });
      return;
    }
    // 1.0.48: iOS pre-check — 提前拦下"装到主屏前"+"iOS<16.4"两种 dead-end
    if (isIOS()) {
      if (!isStandalone()) {
        setPushToast({
          kind: 'warn',
          title: '需要先安装到主屏',
          detail: 'iOS 限制 — 浏览器模式无法收推送',
          howTo: '点 Safari 分享 → 添加到主屏 → 从主屏图标启动后再开推送',
        });
        return;
      }
      if (!iOSSupportsWebPush()) {
        const v = iOSVersion();
        setPushToast({
          kind: 'warn',
          title: '你的 iOS 不支持 Web 推送',
          detail: `当前 iOS${v ? ` ${v.major}.${v.minor}` : ''} — Apple 在 iOS 16.4 才加入 Web Push`,
          howTo: '请升级到 iOS 16.4 或更新版本',
        });
        return;
      }
    }
    try {
      const p = await Notification.requestPermission();
      setPushStatus(p);
      if (p === 'granted') {
        registerPush();
      } else if (p === 'denied') {
        setPushToast({
          kind: 'error',
          title: '通知权限被拒',
          detail: '你已拒绝通知权限',
          howTo: isIOS()
            ? 'iOS 设置 → 通知 → DAO Message → 打开「允许通知」'
            : '浏览器地址栏左侧 🔒 → 通知 → 允许',
        });
      }
    } catch (e) {
      setPushToast({
        kind: 'error',
        title: '权限请求失败',
        detail: (e as Error)?.message || String(e),
      });
    }
  };

  return (
    <div className="flex-1 w-full bg-zinc-950 p-4 space-y-6">
      <h1 className="text-xl font-bold mb-4">设置中心</h1>

      {/* 1.0.48: 推送操作结果 toast */}
      {pushToast && (
        <div className={`relative rounded-2xl p-4 border ${
          pushToast.kind === 'success' ? 'bg-green-500/10 border-green-500/30' :
          pushToast.kind === 'warn'    ? 'bg-amber-500/10 border-amber-500/30' :
                                          'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-start gap-3 pr-7">
            {pushToast.kind === 'success'
              ? <CheckCircle2 className="flex-none w-5 h-5 text-green-400 mt-0.5" />
              : <AlertTriangle className={`flex-none w-5 h-5 mt-0.5 ${pushToast.kind === 'warn' ? 'text-amber-400' : 'text-red-400'}`} />
            }
            <div className="flex-1 text-sm">
              <div className={`font-semibold ${
                pushToast.kind === 'success' ? 'text-green-300' :
                pushToast.kind === 'warn'    ? 'text-amber-300' :
                                                'text-red-300'
              }`}>{pushToast.title}</div>
              <div className="text-zinc-300 text-xs mt-1 leading-relaxed">{pushToast.detail}</div>
              {pushToast.howTo && (
                <div className="mt-2 pl-2 border-l-2 border-zinc-700 text-xs text-zinc-400 leading-relaxed">
                  {pushToast.howTo}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setPushToast(null)}
            className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-white rounded transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* 1.0.48: PWA 推送/存储/SW 诊断面板 — iOS 用户的痛点排查工具 */}
      <PwaDiagnostics />

      {/* 版本信息 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-500 pl-1">版本信息</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
            onClick={() => setShowChangelog(true)}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-400 pointer-events-none" />
              <span className="text-sm">更新日志</span>
            </div>
            <span className="text-xs text-blue-400">查看 →</span>
          </div>
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

      {/* Changelog Modal */}
      {showChangelog && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowChangelog(false)}
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-zinc-100">更新日志</h3>
                <span className="text-xs text-zinc-500 ml-2">SDK {__SDK_VERSION__}</span>
              </div>
              <button
                onClick={() => setShowChangelog(false)}
                className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 channel-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{__CHANGELOG__}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
