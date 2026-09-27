import { Button } from 'ui';

export function AdminAccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh w-[min(620px,calc(100%_-_32px))] content-center justify-items-start gap-[14px]">
      <span className="text-[10px] tracking-[.08em] text-muted">
        PLATFORM ADMINISTRATION
      </span>
      <h1 className="text-3xl font-medium">Access restricted</h1>
      <p className="max-w-[560px] leading-[1.6] text-muted">
        This area requires the platform administration capability. The backend
        must provide and enforce that permission for the authenticated session.
      </p>
      <Button onClick={onBack}>Return to workspace</Button>
    </main>
  );
}
