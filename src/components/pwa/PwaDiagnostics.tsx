/**
 * PwaDiagnostics — PWA 健康检查 · 1.0.48
 *
 * 改动:
 *   - 复用 lib/platform.ts 而不是本地重复实现 isStandalone / isIOS
 *   - 接入 SDK 1.0.39 client.push.diagnose() 拿推送链路 6 项检查
 *   - iOS 专项: 不达标项给具体修复路径(iOS 设置 → 通知 / 装到主屏 / 升级 iOS)
 *   - 加快捷修复按钮: 请求通知权限 / 开启推送 / 锁定存储
 */

import { useEffect, useState, useCallback } from 'react';
import { Smartphone, ShieldCheck, HardDrive, Bell, Info, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { client } from '../../lib/imClient';
import { isIOS, isStandalone, iOSSupportsWebPush, iOSVersion } from '../../lib/platform';
import { PushNotificationError, type PushDiagnostics as SDKPushDiagnostics } from '@daomessage_sdk/sdk';

type Status = 'ok' | 'warn' | 'bad' | 'unknown';

interface Check {
  key: string;
  label: string;
  status: Status;
  detail: string;
  howTo?: string;
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
  const [refreshing, setRefreshing] = useState(false);
  const [fixingPush, setFixingPush] = useState(false);
  const [fixToast, setFixToast] = useState<string>('');

  const runChecks = useCallback(async () => {
    setRefreshing(true);
    try {
      const results: Check[] = [];

      // 1) Standalone(是否作为 PWA 启动)
      const standalone = isStandalone();
      results.push({
        key: 'standalone',
        label: '安装模式',
        status: standalone ? 'ok' : 'warn',
        detail: standalone
          ? '已作为 PWA 启动, 全屏沉浸'
          : (isIOS() ? '当前是 Safari 网页模式' : '当前是普通浏览器模式'),
        howTo: !standalone
          ? (isIOS()
              ? '点 Safari 底部分享按钮 → 「添加到主屏幕」, 再从主屏图标打开'
              : '打开浏览器菜单 → 「安装应用」或「添加到主屏幕」')
          : undefined,
      });

      // 2) iOS 版本(仅 iOS 用户显示)
      if (isIOS()) {
        const supportsPush = iOSSupportsWebPush();
        const v = iOSVersion();
        results.push({
          key: 'ios_version',
          label: 'iOS 版本',
          status: supportsPush ? 'ok' : 'warn',
          detail: supportsPush
            ? `iOS${v ? ` ${v.major}.${v.minor}` : ''} 支持 Web 推送`
            : `iOS${v ? ` ${v.major}.${v.minor}` : ''} 不支持 Web 推送`,
          howTo: !supportsPush
            ? '升级到 iOS 16.4 或更新版本以接收后台推送'
            : undefined,
        });
      }

      // 3) Notification 权限
      if ('Notification' in window) {
        const perm = Notification.permission;
        results.push({
          key: 'notification',
          label: '通知权限',
          status: perm === 'granted' ? 'ok' : (perm === 'denied' ? 'bad' : 'warn'),
          detail: perm === 'granted' ? '已授权, 可接收推送' :
                  perm === 'denied'  ? '已拒绝, 需在系统/浏览器设置中重新开启' :
                                       '尚未请求, 可点下方「请求通知权限」',
          howTo: perm === 'denied'
            ? (isIOS()
                ? 'iOS 设置 → 通知 → 找到 DAO Message → 打开「允许通知」'
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

      // 4) Service Worker
      const swReg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      results.push({
        key: 'sw',
        label: 'Service Worker',
        status: swReg && swReg.active ? 'ok' : 'warn',
        detail: swReg && swReg.active
          ? `已注册并激活 (${swReg.active.state})`
          : swReg
            ? `已注册但未激活 (${swReg.active?.state ?? swReg.installing?.state ?? 'unknown'})`
            : '未注册, 离线访问不可用',
        howTo: !swReg ? '刷新页面让 SW 重新注册' : undefined,
      });

      // 5) PushSubscription(本地是否订阅过)
      if (swReg) {
        try {
          const sub = await swReg.pushManager.getSubscription();
          results.push({
            key: 'subscription',
            label: '推送订阅',
            status: sub ? 'ok' : 'warn',
            detail: sub ? '本地已有 PushSubscription' : '本地未订阅 — 点下方「开启推送」生成',
          });
        } catch (e) {
          results.push({
            key: 'subscription',
            label: '推送订阅',
            status: 'unknown',
            detail: `读取失败: ${(e as Error)?.message || String(e)}`,
          });
        }
      }

      // 6) 服务端 VAPID 公钥可达
      try {
        const sdkDiag: SDKPushDiagnostics = await client.push.diagnose(swReg ?? undefined);
        const vapid = sdkDiag.checks.serverVapid;
        if (vapid) {
          results.push({
            key: 'vapid',
            label: '服务端推送',
            status: vapid.ok ? 'ok' : 'bad',
            detail: vapid.detail,
            howTo: vapid.ok ? undefined : '检查网络后刷新',
          });
        }
      } catch (e) {
        results.push({
          key: 'vapid',
          label: '服务端推送',
          status: 'unknown',
          detail: `诊断失败: ${(e as Error)?.message || String(e)}`,
        });
      }

      // 7) 存储 — Persistent + 配额
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
          ? '可点击下方「锁定存储」避免 Safari ITP 7 天自动清空'
          : undefined,
      });

      // 8) WebCrypto / Ed25519
      results.push({
        key: 'crypto',
        label: 'WebCrypto',
        status: typeof crypto?.subtle !== 'undefined' ? 'ok' : 'bad',
        detail: typeof crypto?.subtle !== 'undefined' ? 'AES-GCM / HKDF 可用' : '浏览器不支持 WebCrypto API',
      });

      // 9) 平台识别(信息项)
      const platform = isIOS() ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'Desktop';
      results.push({
        key: 'platform',
        label: '运行平台',
        status: 'ok',
        detail: `${platform} · ${navigator.userAgent.split(' ').slice(-2).join(' ')}`,
      });

      setChecks(results);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void runChecks(); }, [runChecks]);

  const hasIssue = checks.some(c => c.status === 'warn' || c.status === 'bad');
  const overallBadge = hasIssue ? statusBadge('warn') : statusBadge('ok');

  const handleLockStorage = async () => {
    if (!navigator.storage?.persist) return;
    try {
      const granted = await navigator.storage.persist();
      setFixToast(granted ? '存储已锁定, 不会被浏览器自动清理' : '锁定被拒绝(浏览器策略)');
      void runChecks();
    } catch (e) {
      setFixToast(`锁定失败: ${(e as Error)?.message || String(e)}`);
    }
  };

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const p = await Notification.requestPermission();
      setFixToast(p === 'granted' ? '已授权,正在开启推送...' : p === 'denied' ? '权限被拒绝' : '已取消');
      if (p === 'granted') {
        await handleEnablePush();
      }
      void runChecks();
    } catch (e) {
      setFixToast(`权限请求失败: ${(e as Error)?.message || String(e)}`);
    }
  };

  const handleEnablePush = async () => {
    setFixingPush(true);
    try {
      const sw = await navigator.serviceWorker?.ready;
      if (!sw) throw new Error('Service Worker 未就绪');
      await client.push.enablePushNotifications(sw);
      setFixToast('推送已开启');
      void runChecks();
    } catch (e) {
      if (e instanceof PushNotificationError) {
        setFixToast(`${e.kind}: ${e.message}`);
      } else {
        setFixToast((e as Error)?.message || String(e));
      }
    } finally {
      setFixingPush(false);
    }
  };

  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  const showRequestBtn = permission === 'default';
  const showEnablePushBtn = permission === 'granted' &&
    checks.some(c => c.key === 'subscription' && c.status !== 'ok');

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
            <div className="p-4 flex flex-wrap gap-2 items-center">
              <button
                onClick={() => void runChecks()}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? '检查中...' : '重新检查'}
              </button>
              {showRequestBtn && (
                <button
                  onClick={handleRequestPermission}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs transition-colors"
                >
                  <Bell className="w-3 h-3" /> 请求通知权限
                </button>
              )}
              {showEnablePushBtn && (
                <button
                  onClick={handleEnablePush}
                  disabled={fixingPush}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs transition-colors"
                >
                  <Bell className={`w-3 h-3 ${fixingPush ? 'animate-pulse' : ''}`} />
                  {fixingPush ? '开启中...' : '开启推送'}
                </button>
              )}
              {!!navigator.storage?.persist && (
                <button
                  onClick={handleLockStorage}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                >
                  <HardDrive className="w-3 h-3" /> 锁定存储
                </button>
              )}
            </div>

            {fixToast && (
              <div className="p-3 mx-4 mb-3 bg-zinc-800/50 border border-zinc-700 rounded-lg flex items-start gap-2">
                {fixToast.startsWith('推送已开启') || fixToast.startsWith('存储已锁定') || fixToast.startsWith('已授权')
                  ? <CheckCircle2 className="flex-none w-4 h-4 text-green-400 mt-0.5" />
                  : <AlertTriangle className="flex-none w-4 h-4 text-yellow-400 mt-0.5" />}
                <span className="text-xs text-zinc-300">{fixToast}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
