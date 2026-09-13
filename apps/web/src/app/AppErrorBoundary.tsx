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
      <main className="app-error" role="alert">
        <span>HELPDESK LITE</span>
        <h1>Something went wrong</h1>
        <p>
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
