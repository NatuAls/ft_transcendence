import type { ReactNode } from 'react';
import { BrandMark } from 'ui';

interface AuthBrandPanelProps {
  description: string;
  insight: ReactNode;
  title: ReactNode;
  tone?: 'sign-in' | 'register';
}

export function AuthBrandPanel({
  description,
  insight,
  title,
  tone = 'sign-in',
}: AuthBrandPanelProps) {
  return (
    <aside
      className={`hidden min-h-screen flex-col p-16 text-[#f7faf8] min-[1100px]:flex ${tone === 'register' ? 'bg-[#2d5b60]' : 'bg-[#183039]'}`}
      aria-label="About HelpDesk Lite"
    >
      <div className="auth-brand-enter">
        <BrandHeader inverse />
        <div className="mt-[123px]">
          <h1 className="text-[40px] leading-[1.2] font-medium">{title}</h1>
          <p className="mt-[47px] max-w-[420px] text-base leading-[1.2] text-[#c9d5d3]">
            {description}
          </p>
        </div>
        {insight}
      </div>
      <p className="mt-auto text-xs text-[#9eb1b3]">
        Privacy-first · Accessible · Designed for focus
      </p>
    </aside>
  );
}

export function BrandHeader({
  inverse = false,
  mark = true,
}: {
  inverse?: boolean;
  mark?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 font-medium ${inverse ? 'text-xl' : 'text-[15px]'}`}
    >
      {mark ? (
        <BrandMark className={inverse ? '' : '!size-9 !rounded-[10px]'} />
      ) : null}
      <span>HelpDesk Lite</span>
    </div>
  );
}
