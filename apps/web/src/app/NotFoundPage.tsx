import { Button } from 'ui';

export function NotFoundPage({ onBack }: { onBack: () => void }) {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <span>404</span>
      <h1 id="not-found-title">Page not found</h1>
      <p>The address does not match an available HelpDesk Lite page.</p>
      <Button onClick={onBack}>Back to tickets</Button>
    </section>
  );
}
