/**
 * template-app-3/src/components/chat/CallScreen.tsx
 *
 * 全屏沉浸式 E2EE 通话界面（WebRTC + Insertable Streams 帧加密）
 * 通过 appStore 订阅通话状态，全局浮在所有路由之上（z-[200]）。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
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
  const { callState, callRemoteAlias, callType } = useAppStore();

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

  // ── 挂载 CallModule 回调 ──────────────────────────────────────
  useEffect(() => {
    const mod = getCallModule();
    if (!mod) return;

    // 如果挂载时已经有流了，直接赋值
    if (mod.getLocalStream() && localVideoRef.current) {
      localVideoRef.current.srcObject = mod.getLocalStream();
    }
    if (mod.getRemoteStream() && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = mod.getRemoteStream();
      remoteVideoRef.current.play().catch(e => console.error('🔥 [CallScreen] autoplay 被拦截:', e));
    }
    if (mod.getRemoteStream() && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = mod.getRemoteStream();
      remoteAudioRef.current.play().catch(e => console.error('🔥 [CallScreen] audio autoplay 被拦截:', e));
    }

    mod.onLocalStream = (stream: MediaStream) => {
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    };

    mod.onRemoteStream = (stream: MediaStream) => {
      console.warn(`🔥 [CallScreen] 收到远程媒体流! Audio tracks: ${stream.getAudioTracks().length}, Video tracks: ${stream.getVideoTracks().length}`);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(e => console.error('🔥 [CallScreen] video autoplay 被拦截:', e));
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(e => console.error('🔥 [CallScreen] audio autoplay 被拦截:', e));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const handleAnswer  = useCallback(async () => { try { await getCallModule()?.answer(); } catch (e) { console.error('[Call] 接听失败', e); } }, []);
  const handleReject  = useCallback(() => { getCallModule()?.reject(); }, []);

  const toggleMute = useCallback(() => {
    if (localVideoRef.current?.srcObject) {
      const tracks = (localVideoRef.current.srcObject as MediaStream).getAudioTracks();
      tracks.forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(prev => !prev);
    }
  }, []);

  const toggleCam = useCallback(() => {
    if (localVideoRef.current?.srcObject) {
      const tracks = (localVideoRef.current.srcObject as MediaStream).getVideoTracks();
      tracks.forEach(t => { t.enabled = !t.enabled; });
      setIsCamOff(prev => !prev);
    }
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

      {/* 主体内容 */}
      <div className="relative z-10 flex flex-col h-full">

        {/* 顶部：头像 + 对方名称 + 状态 */}
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

        {/* ── 底部控制栏 ─────────────────────────────────────────── */}
        <div className="pb-16 px-8">

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
