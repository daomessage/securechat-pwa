import { useEffect } from 'react';

/**
 * useVisualViewport — 把 VisualViewport.height 写到 CSS 变量 --vv-height
 *
 * 用途:键盘弹起时,iOS Safari 不会缩放 <html>/<body> 的 innerHeight,
 * 导致 100vh 依然占整个屏幕,输入框被键盘遮挡。
 * 订阅 visualViewport.resize / scroll 事件,把"可见视口"高度写给 CSS。
 *
 * 在聊天界面的根元素用 `.vv-height` 类即可自动使用该高度。
 *
 * 浏览器支持:
 *  - iOS Safari 13+ ✅
 *  - Android Chrome 62+ ✅
 *  - Desktop Chrome/Edge/FF ✅(键盘模拟无效,但不会出错)
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) {
      // 旧浏览器降级:用 innerHeight
      const setFallback = () => {
        document.documentElement.style.setProperty('--vv-height', `${window.innerHeight}px`);
      };
      setFallback();
      window.addEventListener('resize', setFallback);
      return () => window.removeEventListener('resize', setFallback);
    }

    const update = () => {
      document.documentElement.style.setProperty('--vv-height', `${vv.height}px`);
      // 键盘顶部到屏幕顶部的距离(用于 fixed 元素贴键盘上方)
      document.documentElement.style.setProperty('--vv-offset-top', `${vv.offsetTop}px`);
    };
    update();

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}
