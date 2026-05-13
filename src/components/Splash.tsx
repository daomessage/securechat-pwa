/**
 * 冷启动 splash — 等 restoreSession 决定走 welcome 还是 main 时显示。
 *
 * 解决问题: 之前默认 route='welcome',restoreSession 异步返回前用户先看到
 * 创建账号页,慢的话可能误点"创建新账户"覆盖原身份。
 *
 * 视觉风格对齐 Welcome.tsx (zinc-950 底 + 蓝紫渐变 title)。
 */
export function Splash() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 gap-6">
      <img src="/favicon.svg" alt="DAO Message" width={72} height={72} className="opacity-90" />
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
        DAO Message
      </h1>
      <div className="w-6 h-6 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
    </div>
  );
}
