import { useState, useCallback } from 'react';

/**
 * 专门针对 SecureChat SDK 设计的异步交互拦截器（防弹衣 Hook）
 * 目标：将防并发连点、try-catch 错误捕获、Loading 状态全部收敛。
 * 效果：让 UI 开发者哪怕写出极其随意的前端按钮，也不会导致 App 崩溃或产生幽灵并发请求。
 */
export function useSdkAction<TArgs extends any[], TResult>(
  actionFn: (...args: TArgs) => Promise<TResult>,
  options?: {
    onSuccess?: (res: TResult) => void;
    onError?: (err: any) => void;
  }
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...args: TArgs) => {
    if (isProcessing) return; // 绝对防守：如果上一个请求没结束，丢弃所有新点击
    
    setIsProcessing(true);
    setError(null);
    try {
      const res = await actionFn(...args);
      if (options?.onSuccess) options.onSuccess(res);
      return res;
    } catch (e: any) {
      console.error('[SDK Action Error]:', e);
      const errorMsg = e?.message || String(e) || '操作遇到未知问题';
      setError(errorMsg);
      if (options?.onError) options.onError(e);
      // 错误被在此层吸收，确保不会抛出到导致 React 渲染树崩溃
    } finally {
      setIsProcessing(false);
    }
  }, [actionFn, options, isProcessing]);

  return { execute, isProcessing, error, setError };
}
