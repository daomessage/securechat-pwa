import React, { useState, useRef } from 'react';
import { client } from '../../lib/imClient';
import { ShieldAlert, SendHorizontal, Image as ImageIcon, Loader2, X, Reply, Paperclip, Mic } from 'lucide-react';
import type { StoredMessage, SessionRecord } from '@daomessage_sdk/sdk';
import { useSdkAction } from '../../hooks/useSdkAction';


export function ChatInputBar({ 
  activeChatId, 
  sessionInfo, 
  trustVerified, 
  replyTo, 
  onClearReply, 
  onShowSecurityModal,
  onMessageSent 
}: {
  activeChatId: string | null;
  sessionInfo: SessionRecord | null;
  trustVerified: boolean;
  replyTo: StoredMessage | null;
  onClearReply: () => void;
  onShowSecurityModal: () => void;
  onMessageSent: () => void;
}) {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const selfTypingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const generateBlurryThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new self.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const max = 32;
        let w = img.width; let h = img.height;
        if (w > h) { h = Math.round(h * (max / w)); w = max; }
        else { w = Math.round(w * (max / h)); h = max; }
        canvas.width = w; canvas.height = h;
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.3));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  };

  const { execute: sendText, isProcessing: isSendingText } = useSdkAction(async () => {
    const text = inputText.trim();
    if (!text || !activeChatId || !sessionInfo?.theirAliasId) return;
    setInputText('');
    const rid = replyTo?.id;
    onClearReply();
    await client.sendMessage(activeChatId, sessionInfo.theirAliasId, text, rid || undefined);
    onMessageSent();
  });

  const { execute: sendImage, isProcessing: isSendingImage } = useSdkAction(async (file: File) => {
    if (!activeChatId || !sessionInfo?.theirAliasId) return;
    const thumbnail = await generateBlurryThumbnail(file);
    await client.sendImage(activeChatId, sessionInfo.theirAliasId, file, thumbnail);
    onMessageSent();
  });

  const { execute: sendFile, isProcessing: isSendingFile } = useSdkAction(async (file: File) => {
    if (!activeChatId || !sessionInfo?.theirAliasId) return;
    await client.sendFile(activeChatId, sessionInfo.theirAliasId, file);
    onMessageSent();
  });

  const { execute: sendVoice, isProcessing: isSendingVoice } = useSdkAction(async (args: { blob: Blob; durationMs: number }) => {
    if (!activeChatId || !sessionInfo?.theirAliasId) return;
    await client.sendVoice(activeChatId, sessionInfo.theirAliasId, args.blob, args.durationMs);
    onMessageSent();
  });

  const handleSendImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sendImage(file);
  };

  const handleSendFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sendFile(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
      recordStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordStartRef.current) / 1000));
      }, 500);
    } catch (e) {
      console.warn('无法获取麦克风权限:', e);
    }
  };

  const stopRecording = (send: boolean) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    clearInterval(recordIntervalRef.current);
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach(t => t.stop());
      if (send && recordChunksRef.current.length > 0) {
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType });
        const durationMs = Date.now() - recordStartRef.current;
        sendVoice({ blob, durationMs });
      }
      recordChunksRef.current = [];
    };
    recorder.stop();
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    clearTimeout(selfTypingTimerRef.current);
    selfTypingTimerRef.current = window.setTimeout(() => {
      if (activeChatId && sessionInfo?.theirAliasId && e.target.value.trim()) {
        client.sendTyping(activeChatId, sessionInfo.theirAliasId);
      }
    }, 400);
  };

  const getPreviewText = (m: StoredMessage, maxLen = 50): string => {
    if (m.msgType === 'retracted') return '消息已撤回';
    const inferType = (msg: StoredMessage) => {
      if (msg.msgType) return msg.msgType;
      if (msg.text?.startsWith('[img]')) return 'image';
      if (msg.text?.startsWith('[file]')) return 'file';
      if (msg.text?.startsWith('[voice]')) return 'voice';
      try {
        const parsed = JSON.parse(msg.text);
        if (parsed.type === 'image') return 'image';
        if (parsed.type === 'file') return 'file';
        if (parsed.type === 'voice') return 'voice';
      } catch {}
      return 'text';
    };
    const t = inferType(m);
    if (t === 'image') return '📷 图片';
    if (t === 'voice') {
      try { const p = JSON.parse(m.text); return `🎤 语音 ${Math.round((p.durationMs || 0) / 1000)}s`; } catch {}
      return '🎤 语音消息';
    }
    if (t === 'file') {
      try { const p = JSON.parse(m.text); return `📎 ${p.name || '文件'}`; } catch {}
      return '📎 文件';
    }
    return m.text?.slice(0, maxLen) || '[消息]';
  };

  return (
    <div className="shrink-0 bg-zinc-950 px-4 py-3 border-t border-zinc-900 pb-safe relative" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 max-w-2xl mx-auto">
          <Reply className="w-4 h-4 text-blue-400 shrink-0 pointer-events-none" />
          <div className="flex-1 min-w-0 text-xs text-zinc-300 truncate">
            <span className="text-blue-400 font-medium">{replyTo.isMe ? '你' : (replyTo.fromAliasId?.slice(0, 6) || '对方')}</span>
            <span className="ml-1 text-zinc-400">{getPreviewText(replyTo)}</span>
          </div>
          <button onClick={onClearReply} className="p-0.5 hover:bg-zinc-700 rounded transition-colors shrink-0">
            <X className="w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          </button>
        </div>
      )}

      {!trustVerified && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[2px] z-30 flex items-center justify-center cursor-pointer" onClick={onShowSecurityModal}>
          <div className="flex items-center gap-2 bg-yellow-500 text-zinc-950 px-4 py-2 rounded-full font-medium text-sm shadow-lg hover:bg-yellow-400 transition-colors">
            <ShieldAlert className="w-4 h-4 pointer-events-none" />
            点击在此核查安全状态以开启输入
          </div>
        </div>
      )}

      <div className="flex items-end gap-1.5 max-w-2xl mx-auto">
        <label className="p-2 text-zinc-400 hover:text-white cursor-pointer rounded-full hover:bg-zinc-800 transition-all shrink-0">
          <input type="file" accept="image/*" className="hidden" onChange={handleSendImage} disabled={isSendingImage || !trustVerified} />
          <ImageIcon className="w-5 h-5 pointer-events-none" />
        </label>
        <label className="p-2 text-zinc-400 hover:text-white cursor-pointer rounded-full hover:bg-zinc-800 transition-all shrink-0">
          <input type="file" className="hidden" onChange={handleSendFile} disabled={isSendingFile || !trustVerified} />
          <Paperclip className="w-5 h-5 pointer-events-none" />
        </label>

        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-mono flex-1">{Math.floor(recordingDuration / 60).toString().padStart(2,'0')}:{(recordingDuration % 60).toString().padStart(2,'0')}</span>
            <button onClick={() => stopRecording(false)} className="p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors" title="取消">
              <X className="w-4 h-4 pointer-events-none" />
            </button>
            <button onClick={() => stopRecording(true)} className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors" title="发送">
              <SendHorizontal className="w-4 h-4 pointer-events-none" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center pr-1 overflow-hidden focus-within:border-blue-500 transition-colors">
              <input 
                type="text" 
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={e => { if (e.key === 'Enter') sendText() }}
                placeholder="输入消息..."
                disabled={isSendingText || !trustVerified}
                className="w-full bg-transparent px-4 py-2 text-sm outline-none placeholder:text-zinc-600"
              />
              {inputText.trim() ? (
                <button 
                  onClick={() => sendText()}
                  disabled={isSendingText || !trustVerified}
                  className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-all shrink-0"
                >
                  {isSendingText ? <Loader2 className="w-4 h-4 animate-spin pointer-events-none" /> : <SendHorizontal className="w-4 h-4 pointer-events-none" />}
                </button>
              ) : null}
            </div>
            {!inputText.trim() && (
              <button
                onClick={startRecording}
                disabled={isSendingVoice || !trustVerified}
                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-all shrink-0"
                title="按住录音"
              >
                {isSendingVoice ? <Loader2 className="w-5 h-5 animate-spin pointer-events-none" /> : <Mic className="w-5 h-5 pointer-events-none" />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
