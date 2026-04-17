import React, { useState, useEffect, useRef } from 'react';
import { client } from '../../../lib/imClient';
import { Loader2, Download, FileText, Play, Pause } from 'lucide-react';
import { cn } from '../../../lib/utils';


export function ImageBubble({ mediaKey, thumbnail, conversationId }: {
  mediaKey: string; thumbnail?: string; conversationId: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let active = true, objectUrl = '';
    
    if (!mediaKey) {
      setError(true);
      return;
    }

    client.media.downloadDecryptedMedia(mediaKey, conversationId)
      .then(buffer => {
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([buffer]));
        setUrl(objectUrl);
      })
      .catch((e) => { 
        console.error('Download media err:', e);
        if (active) setError(true); 
      });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [mediaKey, conversationId]);

  if (error) return <div className="text-[10px] text-red-400 bg-red-400/10 px-2 py-1 rounded">⚠️ 解析失准</div>;

  if (!url) return thumbnail
    ? <div className="relative max-w-[200px] min-h-[150px] rounded overflow-hidden cursor-wait bg-zinc-900 border border-zinc-700/50">
        <img src={thumbnail} className="w-full h-full object-cover blur-sm scale-110 opacity-70" alt="skeleton" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="w-5 h-5 animate-spin text-white opacity-80" />
        </div>
      </div>
    : <span className="text-zinc-300 text-[10px] flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />解析密文...
      </span>;

  return <>
    <div className="cursor-zoom-in rounded overflow-hidden" onClick={() => setIsFullscreen(true)}>
      <img src={url} className="max-w-[220px] max-h-[220px] rounded object-cover" alt="decrypted" />
    </div>
    {isFullscreen && (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-sm cursor-zoom-out"
        onClick={() => setIsFullscreen(false)}>
        <img src={url} className="max-w-full max-h-full object-contain pointer-events-auto"
          onClick={e => e.stopPropagation()} alt="full" />
        <button className="absolute top-safe-4 right-4 p-2 bg-zinc-800/80 rounded-full text-white text-xs hover:bg-zinc-700"
          onClick={() => setIsFullscreen(false)}>关闭</button>
      </div>
    )}
  </>;
}

/** 文件卡片气泡 */
export function FileBubble({ text, conversationId, isMe }: { text: string; conversationId: string; isMe: boolean }) {
  const [downloading, setDownloading] = useState(false);

  // 解析 payload：JSON { type:'file', key, name, size } 或旧格式 [file]key|name|size
  const parsed = React.useMemo(() => {
    try {
      const j = JSON.parse(text);
      if (j.type === 'file') return { key: j.key, name: j.name, size: j.size };
    } catch {}
    if (text.startsWith('[file]')) {
      const parts = text.replace('[file]', '').split('|');
      return { key: parts[0], name: parts[1] || '未知文件', size: Number(parts[2]) || 0 };
    }
    return { key: '', name: '未知文件', size: 0 };
  }, [text]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (!parsed.key) return;
    setDownloading(true);
    try {
      const buffer = await client.media.downloadDecryptedMedia(parsed.key, conversationId);
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = parsed.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('文件下载失败:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-xl min-w-[200px]",
      isMe ? "bg-blue-700/30" : "bg-zinc-700/30"
    )}>
      <FileText className="w-8 h-8 text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{parsed.name}</div>
        <div className="text-[10px] text-zinc-400">{formatSize(parsed.size)}</div>
      </div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="p-1.5 rounded-full bg-blue-600/20 hover:bg-blue-600/40 transition-colors shrink-0"
      >
        {downloading
          ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          : <Download className="w-4 h-4 text-blue-400" />
        }
      </button>
    </div>
  );
}

/** 语音播放条气泡 */
export function VoiceBubble({ text, conversationId, isMe }: { text: string; conversationId: string; isMe: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const parsed = React.useMemo(() => {
    try {
      const j = JSON.parse(text);
      if (j.type === 'voice') return { key: j.key, duration: j.duration };
    } catch {}
    if (text.startsWith('[voice]')) {
      const parts = text.replace('[voice]', '').split('|');
      return { key: parts[0], duration: Number(parts[1]) || 0 };
    }
    return { key: '', duration: 0 };
  }, [text]);

  const formatDuration = (ms: number) => {
    const sec = Math.round(ms / 1000);
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  };

  const togglePlay = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
      trackProgress();
      return;
    }

    setLoading(true);
    try {
      const buffer = await client.media.downloadDecryptedMedia(parsed.key, conversationId);
      const blob = new Blob([buffer], { type: 'audio/mp4' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlaying(false);
        setProgress(0);
        cancelAnimationFrame(animFrameRef.current);
      };
      audioRef.current = audio;
      await audio.play();
      setPlaying(true);
      trackProgress();
    } catch (e) {
      console.error('语音播放失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const trackProgress = () => {
    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setProgress(audioRef.current.currentTime / (audioRef.current.duration || 1));
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    tick();
  };

  const barCount = Math.max(12, Math.min(40, Math.round((parsed.duration || 3000) / 500)));

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-xl min-w-[160px]",
      isMe ? "bg-blue-700/20" : "bg-zinc-700/30"
    )} style={{ maxWidth: Math.min(300, 120 + barCount * 4) }}>
      <button
        onClick={togglePlay}
        disabled={loading}
        className="p-1.5 rounded-full bg-blue-600/20 hover:bg-blue-600/40 transition-colors shrink-0"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          : playing ? <Pause className="w-4 h-4 text-blue-400" />
          : <Play className="w-4 h-4 text-blue-400 ml-0.5" />}
      </button>
      <div className="flex-1 flex items-center gap-[2px] h-6">
        {Array.from({ length: barCount }).map((_, i) => {
          const h = 4 + Math.sin(i * 0.7) * 8 + Math.random() * 4;
          const filled = i / barCount < progress;
          return (
            <div
              key={i}
              className={cn("rounded-full transition-colors duration-150",
                filled ? (isMe ? "bg-white" : "bg-blue-400") : (isMe ? "bg-blue-300/30" : "bg-zinc-500/40")
              )}
              style={{ width: 2, height: Math.round(h), minHeight: 3 }}
            />
          );
        })}
      </div>
      <span className={cn("text-[10px] shrink-0", isMe ? "text-blue-200" : "text-zinc-400")}>
        {formatDuration(parsed.duration)}
      </span>
    </div>
  );
}
