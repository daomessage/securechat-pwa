/**
 * mobileconfigGenerator.ts — 客户端生成 iOS WebClip .mobileconfig · 1.0.47
 *
 * 为什么客户端生成,不用服务端预生成:
 *   1. Fork 用户部署到自己域名(比如 myname.com)时, 静态预生成无法适配。
 *      客户端生成自动用 location.origin, 任何域名都能用。
 *   2. 与"零知识 / 零中介"铁律一致 — 不需要服务端参与,纯前端完成。
 *   3. 用户可自定义 Label, 让 PWA fork 实例显示自己的品牌名。
 *
 * 安全 / 透明度:
 *   - 文件未签名, iOS 16+ 会显示红色「未签名」警告。这是正常的, 不签名是
 *     因为我们不申请 Apple Developer 账号(违背 DAO Message 零依赖铁律)。
 *   - 内容 100% 透明 — 用户可以打开 .mobileconfig 用任何文本编辑器查看完整 XML,
 *     里面只有一个 WebClip payload, 没有任何系统配置 / 证书 / VPN / MDM。
 *   - 安装后用户随时可在「设置 → 通用 → VPN 与设备管理」一键删除。
 *
 * 与 Safari 添加到主屏的对比:
 *   优势: 图标质量更好(直接 embed 180x180 PNG), Label 可定制, 步骤可能更短
 *   劣势: 未签名警告, 用户可能不熟悉描述文件流程
 *
 * 用户自己选哪个路径。InstallGate UI 同时展示两种方式让用户对比。
 */

export interface MobileConfigOptions {
  /** PWA 网址,默认 location.origin */
  url?: string;
  /** 主屏图标下显示的名字 */
  label?: string;
  /** 180x180 PNG 图标的 Blob 或 URL,默认 /apple-touch-icon.png */
  iconUrl?: string;
  /** 组织名(显示在 PayloadOrganization)*/
  organization?: string;
}

/**
 * 生成 .mobileconfig XML 字符串。
 * 异步: 因为要 fetch + 转 base64 图标。
 */
export async function generateWebClipMobileConfig(opts: MobileConfigOptions = {}): Promise<string> {
  const url = opts.url || (typeof location !== 'undefined' ? location.origin : 'https://chat.daomessage.com');
  const label = opts.label || 'DAO Message';
  const iconUrl = opts.iconUrl || '/apple-touch-icon.png';
  const organization = opts.organization || 'DAO Message';

  // 拉图标 → base64
  const iconBase64 = await fetchImageAsBase64(iconUrl);

  // 生成 UUID v4(WebCrypto 兜底, 老浏览器用伪随机)
  const profileUUID = randomUUID();
  const payloadUUID = randomUUID();

  // PayloadIdentifier 用域名反转(同 ID 重装会覆盖, 避免主屏图标越积越多)
  const host = new URL(url).hostname;
  const reverseDomain = host.split('.').reverse().join('.');
  const profileId = `${reverseDomain}.webclip.install`;
  const payloadId = `${reverseDomain}.webclip.install.payload`;

  // 多语言 ConsentText
  const consentZh = `${label} 是基于 DAO Message 协议的零知识端到端加密通讯客户端。

本描述文件只会将 ${url} 添加到您的主屏:
• 不会获取设备数据
• 不会修改系统设置
• 不会安装任何证书或 VPN
• 不会进行设备管理

安装后,主屏会出现 "${label}" 图标,点击直接打开网站。可随时长按图标删除,或在「设置 → 通用 → VPN 与设备管理」中删除本描述文件。

注: 本文件未签名(我们未申请 Apple Developer 证书,以保持零中介依赖),iOS 会显示「未签名」警告 — 这不代表内容有问题,您可用文本编辑器打开本文件验证完整内容。`;

  const consentEn = `${label} is a zero-knowledge end-to-end encrypted messaging client built on the DAO Message protocol.

This profile will only add ${url} to your Home Screen:
• Does NOT access device data
• Does NOT modify system settings
• Does NOT install any certificate or VPN
• Does NOT perform device management

After installation, the "${label}" icon appears on your Home Screen. Tap it to open the website. You can remove it anytime by long-pressing the icon, or via Settings → General → VPN & Device Management.

Note: This file is unsigned (we don't subscribe to an Apple Developer account, to maintain zero centralized dependency). iOS will display an "Unsigned" warning — this does NOT mean the content is malicious. You can open this file in any text editor to inspect its full content.`;

  // 转义 XML 特殊字符
  const e = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadIdentifier</key>
  <string>${e(profileId)}</string>
  <key>PayloadUUID</key>
  <string>${profileUUID}</string>
  <key>PayloadDisplayName</key>
  <string>${e(label)} · 添加到主屏</string>
  <key>PayloadDescription</key>
  <string>${e(`将 ${label} 添加到 iPhone / iPad 主屏。装上后内容与直接访问 ${url} 完全一样。`)}</string>
  <key>PayloadOrganization</key>
  <string>${e(organization)}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>ConsentText</key>
  <dict>
    <key>zh-Hans</key>
    <string>${e(consentZh)}</string>
    <key>en</key>
    <string>${e(consentEn)}</string>
  </dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>${e(payloadId)}</string>
      <key>PayloadUUID</key>
      <string>${payloadUUID}</string>
      <key>PayloadDisplayName</key>
      <string>${e(label)}</string>
      <key>URL</key>
      <string>${e(url)}</string>
      <key>Label</key>
      <string>${e(label)}</string>
      <key>Icon</key>
      <data>${iconBase64}</data>
      <key>IsRemovable</key>
      <true/>
      <key>FullScreen</key>
      <true/>
      <key>Precomposed</key>
      <true/>
      <key>IgnoreManifestScope</key>
      <false/>
    </dict>
  </array>
</dict>
</plist>
`;

  return xml;
}

/**
 * 触发浏览器下载 .mobileconfig 文件。
 * iOS Safari 看到 application/x-apple-aspen-config MIME 会自动进入「下载描述文件」流程。
 */
export async function downloadWebClipMobileConfig(opts: MobileConfigOptions = {}): Promise<void> {
  const xml = await generateWebClipMobileConfig(opts);
  const filename = `${(opts.label || 'DAO Message').replace(/[^a-zA-Z0-9 _-]/g, '')}.mobileconfig`;

  // 用 Blob + a[download] 触发下载
  // iOS Safari 对 application/x-apple-aspen-config 会主动弹「下载描述文件」流程
  const blob = new Blob([xml], { type: 'application/x-apple-aspen-config' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 100ms 后回收 Blob URL(给浏览器一点时间发起下载)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
}

// ─── 内部工具 ────────────────────────────────────────────

/** 拉图片 → ArrayBuffer → base64 (不带 data:image/... 前缀) */
async function fetchImageAsBase64(url: string): Promise<string> {
  const resp = await fetch(url, { cache: 'force-cache' });
  if (!resp.ok) throw new Error(`fetch icon failed: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return arrayBufferToBase64(buf);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // 分段 btoa, 避免 String.fromCharCode.apply 在大 buffer 上栈溢出
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
  }
  // 兜底 UUID v4 (老 iOS 14 / 旧 Chrome)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
