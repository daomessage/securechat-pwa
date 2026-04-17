import { useEffect, useState } from 'react';
import { onNetworkStateChange } from '../../lib/imClient';
import type { NetworkState } from '../../lib/imClient';
import { Loader2 } from 'lucide-react';

export function NetworkBanner() {
  const [state, setState] = useState<NetworkState>('connected');
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    // 👤 App：订阅事件总线
    // 🔒 SDK：内部 WebSocket 状态变化时 emit 'network_state'
    const unsub = onNetworkStateChange((newState) => {
      setState(prev => {
        if (prev !== 'connected' && newState === 'connected') {
          setShowRecovered(true); // 断线恢复时短暂显示绿色横幅
          setTimeout(() => setShowRecovered(false), 2000);
        }
        return newState;
      });
    });
    return unsub;
  }, []);

  if (state === 'connected' && !showRecovered) return null;

  if (showRecovered) {
    return (
      <div className="w-full bg-green-600 text-white text-xs py-1.5 text-center font-medium animate-in fade-in slide-in-from-top-2">
        网络连接已恢复
      </div>
    );
  }

  if (state === 'disconnected') {
    return (
      <div className="w-full bg-red-500 text-white text-xs py-1.5 text-center font-medium">
        网络连接已断开，请检查网络设置
      </div>
    );
  }

  return (
    <div className="w-full bg-yellow-500/90 text-yellow-50 text-xs py-1.5 text-center font-medium flex items-center justify-center gap-2">
      <Loader2 className="w-3 h-3 animate-spin" />
      正在重新连接...
    </div>
  );
}
