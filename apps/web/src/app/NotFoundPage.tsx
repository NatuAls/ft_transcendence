import { Button } from 'ui';

export function NotFoundPage({ onBack }: { onBack: () => void }) {
  return (
    <section
      className="grid min-h-[calc(100dvh-72px)] place-content-center justify-items-center p-8 text-center"
      aria-labelledby="not-found-title"
    >
      <span className="text-[13px] font-semibold tracking-[.12em] text-primary">
        404
      </span>
      <h1
        className="mt-2.5 mb-2 text-[clamp(28px,5vw,46px)] font-medium"
        id="not-found-title"
      >
        Page not found
      </h1>
      <p className="mb-6 text-muted">
        The address does not match an available HelpDesk Lite page.
      </p>
      <Button onClick={onBack}>Back to tickets</Button>
    </section>
  );
}
