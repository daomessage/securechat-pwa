/**
 * template-app-3/src/components/chat/CallScreen.tsx
 *
 * 全屏沉浸式 E2EE 通话界面（WebRTC + Insertable Streams 帧加密）
 * 通过 appStore 订阅通话状态，全局浮在所有路由之上（z-[200]）。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/appStore';
import { getCallModule } from '../../lib/imClient';
import { PhoneOff, PhoneIncoming, Mic, MicOff, Video, VideoOff } from 'lucide-react';

// 每个通话状态对应的 UI 文案
const STATE_LABELS: Record<string, string> = {
  calling:    '正在呼叫…',
  ringing:    '来电呼入',
  connecting: '正在建立加密通道…',
  connected:  '通话中',
  hangup:     '通话已结束',
  rejected:   '对方拒绝了通话',
  ended:      '通话已结束',
};

export function CallScreen() {
  const { callState, callRemoteAlias, callType } = useAppStore(
    useShallow(s => ({
      callState: s.callState,
      callRemoteAlias: s.callRemoteAlias,
      callType: s.callType,
    }))
  );

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [isMuted,     setIsMuted]     = useState(false);
  const [isCamOff,    setIsCamOff]    = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  const isVideo = callType === 'video';
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── 通话计时器 ────────────────────────────────────────────────
  useEffect(() => {
    if (callState !== 'connected') { setDurationSec(0); return; }
    const id = setInterval(() => setDurationSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [callState]);

  const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── 订阅 local / remote stream ──────────────────────────────
  // 之前用 mod.onLocalStream = (s) => localVideoRef.current.srcObject = s 有竞态:
  // answer() 里 getUserMedia 很快 resolve,触发 onLocalStream 时 CallScreen 可能还在 mount
  // 或者 localVideo 元素 (isVideo=true 但 render 未完成) 的 ref 还是 null, 导致流不挂上,
  // 手机端看到对方视频但自己小窗空。
  // 改用 React 状态 + observable 订阅, 用 [stream, ref] 双依赖的 useEffect 保证任何时候
  // 两端都变化都会 re-attach.
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const mod = getCallModule();
    if (!mod) return;
    // 初始值(订阅立刻拿到 current value)
    setLocalStream(mod.getLocalStream());
    setRemoteStream(mod.getRemoteStream());
    // observable 订阅,任何时候 stream 变都 sync
    const loSub = mod.observeLocalStream().subscribe(setLocalStream);
    const reSub = mod.observeRemoteStream().subscribe(setRemoteStream);
    return () => { loSub.unsubscribe(); reSub.unsubscribe(); };
  }, []);

  // 把 localStream 挂到 <video>, 依赖 [stream, isVideo, callState] 覆盖所有变化时机
  // 为什么需要 isVideo: <video> 元素在 isVideo=true 时才渲染, 第一次 effect 跑时
  //   可能 ref.current 仍是 null (元素未 mount) → effect 后续不重跑就永远挂不上
  // 加 play() 兜底 iOS Safari autoplay 拦截
  useEffect(() => {
    if (!localVideoRef.current || !localStream) return;
    if (localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn('[CallScreen] local autoplay blocked:', e));
    }
  }, [localStream, callState, isVideo]);

  // remote 同理,attach 到大窗 video + 独立 audio 元素(autoplay 被拦时兜底)
  useEffect(() => {
    if (remoteStream) {
      console.warn(`🔥 [CallScreen] remoteStream: audio=${remoteStream.getAudioTracks().length} video=${remoteStream.getVideoTracks().length}`);
    }
    if (remoteVideoRef.current && remoteStream && remoteVideoRef.current.srcObject !== remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.warn('[CallScreen] remote video autoplay blocked:', e));
    }
    if (remoteAudioRef.current && remoteStream && remoteAudioRef.current.srcObject !== remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(e => console.warn('[CallScreen] remote audio autoplay blocked:', e));
    }
  }, [remoteStream, callState]);

  // 始终尝试唤醒
  useEffect(() => {
    const tryPlay = async () => {
      if (callState === 'connected') {
        const mod = getCallModule();
        if (mod && mod.getRemoteStream()) {
          const stream = mod.getRemoteStream()!;
          if (!isVideo && remoteAudioRef.current && remoteAudioRef.current.srcObject !== stream) {
            remoteAudioRef.current.srcObject = stream;
            await remoteAudioRef.current.play().catch(e => console.warn(e));
          }
          if (isVideo && remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
            remoteVideoRef.current.srcObject = stream;
            await remoteVideoRef.current.play().catch(e => console.warn(e));
          }
        }
      }
    };
    tryPlay();
  }, [callState, isVideo]);

  // ── 操作处理 ──────────────────────────────────────────────────
  const handleHangup  = useCallback(() => { getCallModule()?.hangup(); }, []);
  // answering 锁防连点:接听是异步的(getUserMedia 可能 6 秒),在 Promise resolve 前
  // 重复点击会重入 answer() 并发多次调 gUM,多个并发 gUM 互相阻塞导致全部 timeout。
  const [answering, setAnswering] = useState(false);
  const handleAnswer = useCallback(async () => {
    if (answering) return;
    setAnswering(true);
    try {
      // 显式把 callType 传给 answer()，确保视频来电时被叫方也开摄像头。
      // SDK answer() 靠 offer SDP 判断，但 onIncomingCall 的 isVideo 解析偶尔
      // 在某些移动端信令时序下会漏 video track，显式传参作为双重保险。
      const mod = getCallModule();
      if (!mod) return;
      const isVideoCall = callType === 'video';
      await (mod as any).answer({ audio: true, video: isVideoCall });
    } catch (e) {
      console.error('[Call] 接听失败', e);
    } finally {
      setAnswering(false);
    }
  }, [answering, callType]);
  const handleReject  = useCallback(() => { getCallModule()?.reject(); }, []);

  // 修复要点 (2026-04-23 v2):
  //   1. 从 SDK getLocalStream() 读流, 不依赖 DOM 元素 srcObject
  //   2. 只操作 state === 'live' 的 track, ended track 残留不影响 (之前 forEach
  //      所有 track 切 enabled, ended track 的 enabled 翻转但 live track 也跟着翻,
  //      偶数次点击 live enabled 回到 true → 用户看到静音图标但实际没静音)
  //   3. 用 React state 作为源真相 (setIsMuted 的新值),然后把所有 live track
  //      统一设成 !newMuted, 避免多条 track 状态不一致
  const toggleMute = useCallback(() => {
    const stream = getCallModule()?.getLocalStream();
    if (!stream) return;
    const liveAudio = stream.getAudioTracks().filter(t => t.readyState === 'live');
    if (liveAudio.length === 0) {
      console.warn('[CallScreen] toggleMute: no live audio track');
      return;
    }
    // React 闭包读当前 isMuted 作为翻转依据
    setIsMuted(prev => {
      const next = !prev;
      // track.enabled=false → 发送端发 silence frame, 对方听不到
      liveAudio.forEach(t => { t.enabled = !next; });
      console.log(`[CallScreen] mute → ${next}, live audio tracks now enabled=${!next}`);
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    const stream = getCallModule()?.getLocalStream();
    if (!stream) return;
    const liveVideo = stream.getVideoTracks().filter(t => t.readyState === 'live');
    if (liveVideo.length === 0) {
      console.warn('[CallScreen] toggleCam: no live video track');
      return;
    }
    setIsCamOff(prev => {
      const next = !prev;
      liveVideo.forEach(t => { t.enabled = !next; });
      console.log(`[CallScreen] cam → ${next}, live video tracks now enabled=${!next}`);
      return next;
    });
  }, []);

  // 无通话时不渲染任何内容
  if (!callState || callState === 'idle') return null;

  const isEnding = ['hangup', 'ended', 'rejected'].includes(callState);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col select-none overflow-hidden">
      {/* ── 背景层 ── */}
      <video
        ref={remoteVideoRef}
        className={`absolute inset-0 w-full h-full object-cover bg-zinc-950 ${!isVideo ? 'opacity-0 pointer-events-none' : ''}`}
        autoPlay playsInline
      />
      
      {/* 纯音频层（专门解决手机端隐藏 video 时截断声音流的兼容性 BUG） */}
      <audio
        ref={remoteAudioRef}
        autoPlay playsInline
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
      />

      {!isVideo && (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black" />
      )}

      {/* 主体内容 · pointer-events-none 让 video 元素可被点击 (按钮区域单独启用 pointer-events) */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">

        {/* 顶部 · 视频连接后变紧凑 (只在顶部状态栏显示名字 + 计时 + 加密徽章),
            让 remoteVideo 背景画面占满中间区域不被遮挡 */}
        {isVideo && callState === 'connected' ? (
          // 视频通话已接通: 紧凑顶栏 (名字 + 计时徽章)
          <div className="flex items-center justify-between px-5 pt-3 pb-2 bg-gradient-to-b from-black/40 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow">
                <span className="text-white text-xs font-bold">
                  {callRemoteAlias ? callRemoteAlias.slice(0, 2).toUpperCase() : '??'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-white text-sm font-semibold drop-shadow">{callRemoteAlias}</span>
                <span className="font-mono text-green-400 text-xs drop-shadow">{fmtDuration(durationSec)}</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] text-green-400 border border-green-500/40 bg-green-500/10 backdrop-blur-sm">
              🔒 E2EE
            </span>
          </div>
        ) : (
          // 呼叫中 / 响铃中 / 音频通话: 大头像 + 名字 + 状态 (原设计)
          <div className="flex flex-col items-center pt-20 pb-6 px-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-2xl
                            bg-gradient-to-br from-blue-500 via-violet-500 to-purple-600
                            ring-4 ring-white/10">
              <span className="text-white text-3xl font-bold">
                {callRemoteAlias ? callRemoteAlias.slice(0, 2).toUpperCase() : '??'}
              </span>
            </div>

            <h1 className="text-white text-2xl font-semibold tracking-tight mb-1 drop-shadow-lg">
              {callRemoteAlias || '未知联系人'}
            </h1>

            <p className={`text-sm font-medium tracking-wide drop-shadow ${isEnding ? 'text-red-400' : 'text-blue-300'}`}>
              {callState === 'connected' ? (
                <span className="font-mono text-green-400">{fmtDuration(durationSec)}</span>
              ) : (
                STATE_LABELS[callState] ?? callState
              )}
            </p>

            {callState === 'connected' && (
              <span className="mt-2 px-2 py-0.5 rounded-full text-[10px] text-green-400 border border-green-500/40 bg-green-500/10">
                🔒 端到端加密通话
              </span>
            )}
          </div>
        )}

        {/* 中间弹性区（放本地小窗） */}
        <div className="flex-1 relative">
          {isVideo && (
            <video
              ref={localVideoRef}
              className={`absolute bottom-4 right-4 w-28 aspect-[9/16] rounded-2xl object-cover
                         border-2 border-white/20 shadow-2xl transition-opacity duration-300
                         ${isCamOff ? 'opacity-0' : 'opacity-100'}`}
              autoPlay playsInline muted
            />
          )}
        </div>

        {/* ── 底部控制栏 · pointer-events-auto 覆盖父容器的 none, 让按钮可点 ── */}
        <div className="pb-16 px-8 pointer-events-auto">

          {/* 通话中：静音 + 挂断 + 摄像头 */}
          {(callState === 'connected' || callState === 'connecting' || callState === 'calling') && (
            <div className="flex items-center justify-center gap-6">
              <button id="call-btn-mute" onClick={toggleMute} className="flex flex-col items-center gap-1.5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95
                                ${isMuted ? 'bg-red-500/80' : 'bg-white/15 backdrop-blur-md border border-white/20'}`}>
                  {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                </div>
                <span className="text-white/70 text-[11px]">{isMuted ? '已静音' : '静音'}</span>
              </button>

              <button id="call-btn-hangup" onClick={handleHangup} className="flex flex-col items-center gap-1.5">
                <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-xl transition-all active:scale-95">
                  <PhoneOff className="w-7 h-7 text-white" />
                </div>
                <span className="text-white/70 text-[11px]">挂断</span>
              </button>

              {isVideo && (
                <button id="call-btn-cam" onClick={toggleCam} className="flex flex-col items-center gap-1.5">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95
                                  ${isCamOff ? 'bg-red-500/80' : 'bg-white/15 backdrop-blur-md border border-white/20'}`}>
                    {isCamOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
                  </div>
                  <span className="text-white/70 text-[11px]">{isCamOff ? '已关闭' : '摄像头'}</span>
                </button>
              )}
            </div>
          )}

          {/* 响铃中：拒绝 + 接听 */}
          {callState === 'ringing' && (
            <div className="flex items-center justify-center gap-16">
              <button id="call-btn-reject" onClick={handleReject} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-xl transition-all active:scale-95">
                  <PhoneOff className="w-7 h-7 text-white" />
                </div>
                <span className="text-white/80 text-xs">拒绝</span>
              </button>

              <button id="call-btn-answer" onClick={handleAnswer} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-xl transition-all active:scale-95 animate-pulse">
                  <PhoneIncoming className="w-7 h-7 text-white" />
                </div>
                <span className="text-white/80 text-xs">接听</span>
              </button>
            </div>
          )}

          {/* 结束态提示 */}
          {isEnding && (
            <div className="text-center">
              <p className="text-white/60 text-sm">通话已结束，窗口即将关闭…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
