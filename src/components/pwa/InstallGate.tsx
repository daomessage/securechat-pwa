/**
 * InstallGate — 全屏 PWA 安装引导拦截页 · 1.0.46
 *
 * 设计目标:
 *   PWA 没装到主屏的体验是不完整的 (没推送 / 没全屏 / 没持久存储)。
 *   非 standalone 模式访问 → 全屏拦截, 引导用户先安装。
 *
 * 1.0.46 改动:
 *   - 平台检测全部走 lib/platform.ts, 不再各组件重写
 *   - iOS 区分 16.4+(有 Web Push) / < 16.4(无 push)两种文案
 *   - iPhone 分享按钮在底部, iPad 在右上角 — 文案分流
 *   - 加「为什么必须装主屏?」可折叠说明 (Apple 限制说明 + 各平台优势)
 *   - 删 InstallBanner (重复路径), 这里是唯一引导入口
 *
 * 触发条件:
 *   - 非 standalone (display-mode 既不是 standalone 也不是 navigator.standalone)
 *   - 不是 7 天内 dismissed
 *   - 不带 ?nogate=1 debug flag
 *
 * 平台分支:
 *   - iOS Safari → 三步图文教程 + iOS 版本提示
 *   - Android Chrome / 桌面 Chromium + beforeinstallprompt 就绪 → 大按钮一键装
 *   - Chromium 桌面 beforeinstallprompt 未就绪 → 显示手动安装路径
 *   - 其他不支持 → 提示换浏览器, 给"继续在浏览器使用"按钮
 */

import { useEffect, useState } from 'react';
import { Share, Plus, Check, Smartphone, ChevronDown, ChevronUp, ShieldCheck, Bell, Zap, HardDrive, AlertTriangle, Download, Info } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import {
  isStandalone, isIOS, isIPad, isIOSSafari, isMobile, isChromiumDesktop,
  iOSSupportsWebPush, iOSVersion,
} from '../../lib/platform';
import { downloadWebClipMobileConfig } from '../../lib/mobileconfigGenerator';

const DISMISS_KEY = 'install_gate_dismissed_at';
const DISMISS_MS = 7 * 24 * 3600 * 1000; // 7 天

function wasDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = parseInt(raw, 10);
    return !isNaN(at) && (Date.now() - at < DISMISS_MS);
  } catch {
    return false;
  }
}

function debugBypass(): boolean {
  try {
    return new URLSearchParams(location.search).get('nogate') === '1';
  } catch {
    return false;
  }
}

export function InstallGate() {
  const deferredPrompt = useAppStore((s) => s.deferredPrompt);
  const setDeferredPrompt = useAppStore((s) => s.setDeferredPrompt);

  const [shouldRender, setShouldRender] = useState(() => {
    if (debugBypass()) return false;
    if (isStandalone()) return false;
    if (wasDismissed()) return false;
    return true;
  });
  const [installing, setInstalling] = useState(false);
  const [waitingForPrompt, setWaitingForPrompt] = useState(true);
  const [showWhy, setShowWhy] = useState(false);

  // 等 5 秒看 beforeinstallprompt 有没有就绪 (Android / 桌面 Chromium)
  useEffect(() => {
    if (!shouldRender) return;
    if (isIOS()) {
      setWaitingForPrompt(false);
      return;
    }
    if (deferredPrompt) {
      setWaitingForPrompt(false);
      return;
    }
    const t = setTimeout(() => setWaitingForPrompt(false), 5000);
    return () => clearTimeout(t);
  }, [shouldRender, deferredPrompt]);

  if (!shouldRender) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShouldRender(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setShouldRender(false);
      }
    } catch (e) {
      console.warn('[InstallGate] install prompt failed:', e);
    } finally {
      setInstalling(false);
    }
  };

  // ─── 渲染 ─────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[10000] bg-zinc-950 text-white flex flex-col overflow-y-auto"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
        {/* Logo + Title */}
        <img src="/favicon.svg" alt="DAO Message" width={64} height={64} className="opacity-90 mb-5" />
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent mb-3 text-center">
          安装 DAO Message
        </h1>
        <p className="text-zinc-400 text-sm text-center mb-6 leading-relaxed">
          为获得推送通知、全屏体验和持久存储,<br/>
          请将 DAO Message 添加到主屏 / 桌面。
        </p>

        {/* 「为什么必须装主屏?」可折叠说明 */}
        <button
          onClick={() => setShowWhy(v => !v)}
          className="mb-6 text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
        >
          {showWhy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          为什么必须装到主屏?
        </button>
        {showWhy && <WhyInstall />}

        {/* 平台分支 */}
        {isIOSSafari() && <IOSSteps isIPad={isIPad()} />}
        {!isIOSSafari() && (deferredPrompt ? (
          <AndroidInstallButton onClick={handleAndroidInstall} installing={installing} isMobile={isMobile()} />
        ) : waitingForPrompt ? (
          <WaitingPrompt />
        ) : (
          <UnsupportedBrowser />
        ))}

        {/* 跳过链接 */}
        <button
          onClick={handleDismiss}
          className="mt-8 px-4 py-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors"
        >
          继续在浏览器中使用
        </button>
        <div className="mt-2 text-[10px] text-zinc-600">7 天内不再提示</div>
      </div>
    </div>
  );
}

// ─── 子组件 ─────────────────────────────────────────

/** 「为什么必须装主屏?」折叠面板 */
function WhyInstall() {
  return (
    <div className="w-full mb-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-3">
      <Bullet
        icon={<Bell className="w-4 h-4 text-amber-300" />}
        title="推送通知"
        desc="只有 PWA 模式才能收到后台通知。浏览器标签关了, 通知就停了。"
      />
      <Bullet
        icon={<Zap className="w-4 h-4 text-yellow-300" />}
        title="全屏体验"
        desc="去掉地址栏 + 标签栏, 像原生 App 一样使用。"
      />
      <Bullet
        icon={<HardDrive className="w-4 h-4 text-green-300" />}
        title="持久存储"
        desc="浏览器在存储紧张时会清理网站数据。PWA 拥有更高优先级, 你的会话和密钥不会丢。"
      />
      <Bullet
        icon={<ShieldCheck className="w-4 h-4 text-blue-300" />}
        title="iOS 限制"
        desc="Apple 强制要求 PWA 必须装到主屏才能开启通知权限。这是 iOS 系统级限制, 我们绕不开。"
      />
    </div>
  );
}

function Bullet({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-none mt-0.5">{icon}</div>
      <div className="text-xs text-zinc-300 leading-relaxed">
        <strong className="text-zinc-100">{title}</strong>
        <span className="text-zinc-400"> — {desc}</span>
      </div>
    </div>
  );
}

function IOSSteps({ isIPad }: { isIPad: boolean }) {
  const supportsPush = iOSSupportsWebPush();
  const v = iOSVersion();
  // tab: 'manual' (Safari 分享按钮) | 'config' (.mobileconfig 描述文件)
  const [tab, setTab] = useState<'manual' | 'config'>('manual');

  return (
    <div className="w-full space-y-3">
      {/* iOS 16.4 以下警告 */}
      {!supportsPush && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="flex-none w-4 h-4 text-amber-400 mt-0.5" />
          <div className="text-xs text-amber-200 leading-relaxed">
            <strong>你的 iOS{v ? ` ${v.major}.${v.minor}` : ''} 不支持 Web 推送</strong> —
            装到主屏可以全屏使用, 但 App 关闭时收不到新消息通知。
            建议升级到 <strong>iOS 16.4 或更新</strong>。
          </div>
        </div>
      )}

      {/* 方式 Tab 切换 */}
      <div className="flex gap-2 p-1 bg-zinc-900/60 border border-zinc-800 rounded-xl">
        <button
          onClick={() => setTab('manual')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
            tab === 'manual'
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          标准方式
        </button>
        <button
          onClick={() => setTab('config')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
            tab === 'config'
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          一键安装
        </button>
      </div>

      {tab === 'manual' && <IOSManualSteps isIPad={isIPad} />}
      {tab === 'config' && <IOSConfigInstall />}

      {/* 两种方式对比说明(折叠)*/}
      <IOSWaysCompare />
    </div>
  );
}

/** 标准方式: Safari 分享按钮 → 添加到主屏 */
function IOSManualSteps({ isIPad }: { isIPad: boolean }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex-none w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">1</span>
        <div className="text-sm text-zinc-200 leading-relaxed">
          点击 Safari {isIPad
            ? <span><strong>右上角</strong>地址栏右侧</span>
            : <span><strong>底部</strong>地址栏中央</span>
          } 的 <strong>分享按钮</strong>
          <Share className="inline-block w-4 h-4 ml-1 -mt-0.5 text-blue-400" />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className="flex-none w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">2</span>
        <div className="text-sm text-zinc-200 leading-relaxed">
          向下滑动找到, 选择 <strong>「添加到主屏幕」</strong>
          <Plus className="inline-block w-4 h-4 ml-1 -mt-0.5 text-blue-400" />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className="flex-none w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">3</span>
        <div className="text-sm text-zinc-200 leading-relaxed">
          点右上角 <strong>「添加」</strong> 完成
          <Check className="inline-block w-4 h-4 ml-1 -mt-0.5 text-green-400" />
        </div>
      </div>
      <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
        添加后请<strong className="text-zinc-300">从主屏图标启动</strong>, 不要回到 Safari 标签 —
        只有从主屏启动才会进入全屏 PWA 模式。
      </p>
    </div>
  );
}

/** 一键安装: 下载 .mobileconfig 描述文件 */
function IOSConfigInstall() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  const handleDownload = async () => {
    setError('');
    setGenerating(true);
    try {
      await downloadWebClipMobileConfig({});
    } catch (e) {
      console.error('[InstallGate] generate mobileconfig failed:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 未签名警告 */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
        <AlertTriangle className="flex-none w-4 h-4 text-amber-400 mt-0.5" />
        <div className="text-xs text-amber-200 leading-relaxed">
          <strong>iOS 会显示「未签名」红字警告</strong> —
          我们不申请 Apple Developer 账号(避免中心化依赖),所以描述文件未签名。
          这<strong>不代表内容有问题</strong>,可用文本编辑器打开 .mobileconfig 查看完整内容。
        </div>
      </div>

      {/* 下载按钮 */}
      <button
        onClick={handleDownload}
        disabled={generating}
        className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        {generating ? '生成中...' : '下载描述文件'}
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-200">
          生成失败: {error}
        </div>
      )}

      {/* 安装步骤 */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex-none w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
          <div className="text-sm text-zinc-200 leading-relaxed">
            点上方 <strong>「下载描述文件」</strong>,iOS 会弹「下载了配置描述文件」对话框,点 <strong>「允许」</strong>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex-none w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
          <div className="text-sm text-zinc-200 leading-relaxed">
            打开 iOS <strong>「设置」</strong>App,最上方会出现 <strong>「已下载描述文件」</strong> 入口
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex-none w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
          <div className="text-sm text-zinc-200 leading-relaxed">
            点 <strong>「安装」</strong> → 输入 iPhone 锁屏密码 → 再次确认安装
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex-none w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">4</span>
          <div className="text-sm text-zinc-200 leading-relaxed">
            主屏会出现 <strong>DAO Message</strong> 图标
            <Check className="inline-block w-4 h-4 ml-1 -mt-0.5 text-green-400" />
          </div>
        </div>
        <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
          可在 <strong className="text-zinc-300">「设置 → 通用 → VPN 与设备管理」</strong>
          找到本描述文件,一键删除即可移除主屏图标。
        </p>
      </div>
    </div>
  );
}

/** 两种安装方式对比说明 */
function IOSWaysCompare() {
  const [show, setShow] = useState(false);
  return (
    <div>
      <button
        onClick={() => setShow(v => !v)}
        className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
      >
        {show ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        两种方式有什么区别?
      </button>
      {show && (
        <div className="mt-2 bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 space-y-2 leading-relaxed">
          <div>
            <strong className="text-zinc-200">标准方式</strong>(Safari 分享 → 添加到主屏):
            iOS 内置流程,无任何警告。需要自己点 Safari 分享按钮 → 找到「添加到主屏」选项 →
            点添加。<strong className="text-green-400">推荐多数用户使用</strong>。
          </div>
          <div>
            <strong className="text-zinc-200">一键安装</strong>(下载 .mobileconfig 描述文件):
            iOS 系统级配置文件路径,通过设置 App 完成安装。图标质量更好,Label 可定制。
            <strong className="text-amber-300">iOS 会显示「未签名」红字警告</strong>,这是因为我们
            不申请 Apple Developer 证书(保持零中介依赖)。<strong className="text-blue-400">
            技术用户可选</strong>,普通用户建议用标准方式避免心理负担。
          </div>
          <div className="pt-2 border-t border-zinc-800/60 text-zinc-500">
            <Info className="inline-block w-3 h-3 mr-1 -mt-0.5" />
            两种方式装出来的是<strong className="text-zinc-300">同一个 web app</strong>,
            打开图标后行为完全一致(都是 chat.daomessage.com 的 standalone PWA)。
          </div>
        </div>
      )}
    </div>
  );
}

function AndroidInstallButton({ onClick, installing, isMobile }: { onClick: () => void; installing: boolean; isMobile: boolean }) {
  return (
    <div className="w-full space-y-4">
      <button
        onClick={onClick}
        disabled={installing}
        className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
      >
        <Smartphone className="w-5 h-5" />
        {installing ? '正在安装...' : (isMobile ? '安装到主屏' : '安装到桌面')}
      </button>
      <p className="text-xs text-zinc-500 text-center">
        点击后浏览器会弹出确认窗口, 选择"安装"即可。
      </p>
    </div>
  );
}

function WaitingPrompt() {
  return (
    <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center">
      <div className="w-8 h-8 mx-auto border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin mb-3" />
      <p className="text-sm text-zinc-400">正在加载浏览器安装能力...</p>
    </div>
  );
}

function UnsupportedBrowser() {
  // iOS 非 Safari: 重点提示用户必须切到 Safari
  if (isIOS()) {
    return (
      <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
        <p className="text-sm text-amber-200 leading-relaxed">
          <strong>iOS 限制</strong>: 你当前用的不是 Safari 浏览器。
        </p>
        <p className="text-sm text-zinc-300 leading-relaxed">
          只有 <strong className="text-zinc-100">Safari</strong> 能把网站添加到主屏 +
          收 Web 推送, Chrome / Firefox / Edge for iOS 都不支持(Apple 系统限制)。
        </p>
        <p className="text-sm text-zinc-300 leading-relaxed">
          请<strong className="text-blue-400">用 Safari 重新打开</strong> chat.daomessage.com 后再添加到主屏。
        </p>
      </div>
    );
  }
  if (isChromiumDesktop()) {
    return (
      <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <p className="text-sm text-zinc-200 leading-relaxed">
          <strong>桌面安装方式</strong>:
        </p>
        <ol className="text-sm text-zinc-300 space-y-2 list-decimal list-inside">
          <li>点击浏览器<strong className="text-zinc-100">地址栏右侧</strong>的「⊕ 安装」图标</li>
          <li>或者点浏览器右上角 <strong className="text-zinc-100">⋮ 菜单</strong> → <strong>「投放、保存和分享」</strong> → <strong>「安装 DAO Message」</strong></li>
          <li>如果都看不到,直接点下方<strong className="text-blue-400">「继续在浏览器使用」</strong>(桌面 Web 版完整可用)</li>
        </ol>
      </div>
    );
  }
  return (
    <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
      <p className="text-sm text-amber-200 leading-relaxed">
        当前浏览器不支持 PWA 安装。建议使用:
      </p>
      <ul className="text-sm text-zinc-300 space-y-1 list-disc list-inside">
        <li>iOS: <strong>Safari</strong></li>
        <li>Android: <strong>Chrome / Edge</strong></li>
        <li>桌面: <strong>Chrome / Edge / Brave</strong></li>
      </ul>
    </div>
  );
}
