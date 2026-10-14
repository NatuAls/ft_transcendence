import { Button } from 'ui';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from '../core/i18n';

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HelpDesk Lite render failure', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <CrashScreen
        onBack={() => {
          window.location.hash = 'tickets';
          this.setState({ hasError: false });
        }}
      />
    );
  }
}

/** A class cannot use hooks: the texts live here, in the reader's language. */
function CrashScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <main
      className="mx-auto grid min-h-dvh w-[min(560px,calc(100%_-_32px))] content-center justify-items-start gap-[14px]"
      role="alert"
    >
      <span className="text-xs2 tracking-[.08em] text-muted">
        HELPDESK LITE
      </span>
      <h1 className="text-3xl font-medium">{t('common.state.error')}</h1>
      <p className="leading-[1.6] text-muted">{t('common.crash')}</p>
      <Button onClick={onBack}>{t('common.notFound.back')}</Button>
    </main>
  );
}
