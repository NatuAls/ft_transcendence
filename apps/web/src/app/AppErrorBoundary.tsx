import { Button } from 'ui';
import { Component, type ErrorInfo, type ReactNode } from 'react';

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
      <main
        className="mx-auto grid min-h-dvh w-[min(560px,calc(100%_-_32px))] content-center justify-items-start gap-[14px]"
        role="alert"
      >
        <span className="text-[11px] tracking-[.08em] text-muted">
          HELPDESK LITE
        </span>
        <h1 className="text-3xl font-medium">Something went wrong</h1>
        <p className="leading-[1.6] text-muted">
          The interface could not finish rendering. Your browser data has not
          been changed.
        </p>
        <Button
          onClick={() => {
            window.location.hash = 'tickets';
            this.setState({ hasError: false });
          }}
        >
          Return to tickets
        </Button>
      </main>
    );
  }
}
