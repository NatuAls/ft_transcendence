import { Button } from 'ui';

export function AdminAccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <main className="access-denied">
      <span>PLATFORM ADMINISTRATION</span>
      <h1>Access restricted</h1>
      <p>
        This area requires the platform administration capability. The backend
        must provide and enforce that permission for the authenticated session.
      </p>
      <Button onClick={onBack}>Return to workspace</Button>
    </main>
  );
}
