/**
 * Avatar · 三端统一头像组件 (对齐 docs/DESIGN_TOKENS.md)
 *
 * 基础背景: gradient 蓝 → 紫 (color.brand.gradient)
 * 圆形 (radius.full), 字号 = size * 0.4
 *
 * 尺寸规范:
 *   sm  = 32px  — 列表项
 *   md  = 48px  — 聊天头像 / 顶栏
 *   lg  = 80px  — Welcome / 资料卡
 *   xl  = 96px  — 特殊场景
 */

import type { CSSProperties } from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 80,
  xl: 96,
};

interface AvatarProps {
  text?: string;      // 显示的字母/数字,通常取 alias 前 2 位大写
  size?: AvatarSize;
  className?: string; // 额外自定义(阴影 / ring 等)
}

export function Avatar({ text = '??', size = 'md', className = '' }: AvatarProps) {
  const px = SIZE_PX[size];
  const font = Math.round(px * 0.4);
  const letter = (text || '??').slice(0, 2).toUpperCase();

  // gradient 蓝→紫 · 和 Android / iOS 颜色一致
  const style: CSSProperties = {
    width: px,
    height: px,
    fontSize: font,
    background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #A855F7 100%)',
  };

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-white shadow-lg select-none ${className}`}
      style={style}
      aria-label={`头像 ${letter}`}
    >
      {letter}
    </div>
  );
}
