import { useEffect, useState } from 'react';
import { Smartphone, ShieldCheck, HardDrive, Bell, Info } from 'lucide-react';

type Status = 'ok' | 'warn' | 'bad' | 'unknown';

interface Check {
  key: string;
  label: string;
  status: Status;
  detail: string;
  howTo?: string;
}

function isStandalone(): boolean {
  const mm = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = 'standalone' in window.navigator && (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

async function getStorageEstimate(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    return { used: est.usage ?? 0, quota: est.quota ?? 0 };
  } catch {
    return null;
  }
}

async function isPersistent(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null;
  try { return await navigator.storage.persisted(); } catch { return null; }
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusColor(s: Status): string {
  switch (s) {
    case 'ok':   return 'text-green-500';
    case 'warn': return 'text-yellow-500';
    case 'bad':  return 'text-red-500';
    default:     return 'text-zinc-500';
  }
}

function statusBadge(s: Status): { text: string; cls: string } {
  switch (s) {
    case 'ok':   return { text: '正常',   cls: 'bg-green-500/10 text-green-400' };
    case 'warn': return { text: '待优化', cls: 'bg-yellow-500/10 text-yellow-400' };
    case 'bad':  return { text: '未就绪', cls: 'bg-red-500/10 text-red-400' };
    default:     return { text: '未知',   cls: 'bg-zinc-800 text-zinc-400' };
  }
}

export function PwaDiagnostics() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const results: Check[] = [];

      // 1) Standalone(是否作为 PWA 启动)
      const standalone = isStandalone();
      results.push({
        key: 'standalone',
        label: '安装模式',
        status: standalone ? 'ok' : 'warn',
        detail: standalone ? '已作为 PWA 启动,全屏沉浸' : (isIOS() ? '当前是 Safari 网页模式' : '当前是普通浏览器模式'),
        howTo: !standalone
          ? (isIOS()
              ? '点 Safari 底部的分享按钮 → 「添加到主屏幕」,再从主屏图标打开。'
              : '打开浏览器菜单 → 「安装应用」或「添加到主屏幕」。'
            )
          : undefined,
      });

      // 2) Notification 权限
      if ('Notification' in window) {
        const perm = Notification.permission;
        results.push({
          key: 'notification',
          label: '通知权限',
          status: perm === 'granted' ? 'ok' : (perm === 'denied' ? 'bad' : 'warn'),
          detail: perm === 'granted' ? '已授权,可接收推送' :
                  perm === 'denied'  ? '已拒绝,需要在系统/浏览器设置中重新开启' :
                                       '尚未请求,首次开启推送时会弹窗',
          howTo: perm === 'denied'
            ? (isIOS()
                ? 'iOS: 设置 → 通知 → DAO Message → 打开允许通知'
                : '浏览器地址栏左侧 🔒 → 通知 → 允许')
            : undefined,
        });
      } else {
        results.push({
          key: 'notification',
          label: '通知权限',
          status: 'bad',
          detail: '当前浏览器不支持 Web 通知',
        });
      }

      // 3) Service Worker
      const swReg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      results.push({
        key: 'sw',
        label: 'Service Worker',
        status: swReg ? 'ok' : 'warn',
        detail: swReg ? `已注册 (${swReg.active?.state ?? 'pending'})` : '未注册,离线访问不可用',
      });

      // 4) 存储 — Persistent + 配额
      const persistent = await isPersistent();
      const est = await getStorageEstimate();
      const pct = est && est.quota > 0 ? (est.used / est.quota) * 100 : 0;
      results.push({
        key: 'storage',
        label: '本地存储',
        status: !est ? 'unknown' : (pct > 80 ? 'warn' : 'ok'),
        detail: est
          ? `${formatMB(est.used)} / ${formatMB(est.quota)} (${pct.toFixed(1)}%)${persistent === true ? ' · 已锁定' : persistent === false ? ' · 未锁定(可能被清理)' : ''}`
          : '无法读取存储信息',
        howTo: persistent === false && standalone
          ? '可点击下方「锁定存储」避免 Safari ITP 7 天自动清空身份数据'
          : undefined,
      });

      // 5) WebCrypto / Ed25519
      results.push({
        key: 'crypto',
        label: 'WebCrypto',
        status: typeof crypto?.subtle !== 'undefined' ? 'ok' : 'bad',
        detail: typeof crypto?.subtle !== 'undefined' ? 'AES-GCM / HKDF 可用' : '浏览器不支持 WebCrypto API',
      });

      // 6) 平台识别(用于 UI 展示)
      const platform = isIOS() ? 'iOS' : isAndroid() ? 'Android' : 'Desktop';
      results.push({
        key: 'platform',
        label: '运行平台',
        status: 'ok',
        detail: `${platform} · ${navigator.userAgent.split(' ').pop()}`,
      });

      setChecks(results);
    })();
  }, []);

  const hasIssue = checks.some(c => c.status === 'warn' || c.status === 'bad');
  const overallBadge = hasIssue ? statusBadge('warn') : statusBadge('ok');

  const handleLockStorage = async () => {
    if (!navigator.storage?.persist) return;
    try {
      const granted = await navigator.storage.persist();
      alert(granted ? '存储已锁定,不会被浏览器自动清理。' : '锁定被浏览器拒绝。在 PWA standalone 模式下通常会自动授予。');
    } catch (e) {
      console.warn('[PWA] persist failed:', e);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-500 pl-1 flex items-center gap-2">
        <Smartphone className="w-4 h-4" />
        PWA 诊断
      </h3>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className={`w-5 h-5 ${hasIssue ? 'text-yellow-500' : 'text-green-500'}`} />
            <span className="text-sm">健康检查</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${overallBadge.cls}`}>
            {overallBadge.text} · {expanded ? '收起' : '展开'}
          </span>
        </button>

        {expanded && (
          <div className="divide-y divide-zinc-800 border-t border-zinc-800">
            {checks.map(c => (
              <div key={c.key} className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-200">{c.label}</span>
                  <span className={`text-xs px-2 py-1 rounded ${statusBadge(c.status).cls}`}>
                    {statusBadge(c.status).text}
                  </span>
                </div>
                <div className={`text-xs ${statusColor(c.status)}`}>{c.detail}</div>
                {c.howTo && (
                  <div className="text-xs text-zinc-500 mt-2 pl-2 border-l-2 border-zinc-700 flex items-start gap-2">
                    <Info className="w-3 h-3 mt-0.5 flex-none" />
                    <span>{c.howTo}</span>
                  </div>
                )}
              </div>
            ))}

            {/* 快捷操作 */}
            <div className="p-4 flex flex-wrap gap-2">
              {!!navigator.storage?.persist && (
                <button
                  onClick={handleLockStorage}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                >
                  <HardDrive className="w-3 h-3" /> 锁定存储
                </button>
              )}
              {'Notification' in window && Notification.permission === 'default' && (
                <button
                  onClick={() => Notification.requestPermission()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                >
                  <Bell className="w-3 h-3" /> 请求通知权限
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
