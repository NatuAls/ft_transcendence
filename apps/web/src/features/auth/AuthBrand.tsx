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
      className={`auth-brand-panel auth-brand-panel--${tone}`}
      aria-label="About HelpDesk Lite"
    >
      <BrandHeader inverse />
      <div className="auth-brand-panel__message">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {insight}
      <p className="auth-brand-panel__footer">
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
    <div className={`auth-brand ${inverse ? 'auth-brand--inverse' : ''}`}>
      {mark ? <BrandMark /> : null}
      <span>HelpDesk Lite</span>
    </div>
  );
}
