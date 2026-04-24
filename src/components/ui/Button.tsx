/**
 * Primary / Secondary Button · 三端统一按钮组件
 * 对齐 docs/DESIGN_TOKENS.md · 关键组件规格
 *
 * 规格:
 *   高度 48px (h-12)
 *   圆角 radius.lg (rounded-lg = 8px)
 *   水平内边距 space.6 (px-6 = 24px)
 *   背景 color.brand.primary (bg-blue-500 #3B82F6)
 *   按下 color.brand.primary-hover (hover:bg-blue-600)
 *   字号 text-base (16), 字重 500 (font-medium)
 *   禁用态 opacity 50%
 *   点击反馈 active:scale-95
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
}

const BASE = 'h-12 px-6 rounded-lg text-base font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANT_STYLES: Record<Variant, string> = {
  primary:   'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20',
  secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100',
  danger:    'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20',
  ghost:     'bg-transparent hover:bg-zinc-800 text-zinc-300',
};

export function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`${BASE} ${VARIANT_STYLES[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
