import { BrandMark, Button, Icon } from 'ui';
import { PreviewIdentitySelect } from './PreviewIdentitySelect';
import {
  previewMode,
  type PreviewIdentity,
  type ViewerSession,
} from './session';

export function SessionStatePage({
  kind,
  onPreviewIdentityChange,
  onSignOut,
  viewer,
}: {
  kind: 'no-organization' | 'suspended';
  onPreviewIdentityChange: (identity: PreviewIdentity) => void;
  onSignOut: () => void | Promise<void>;
  viewer: ViewerSession;
}) {
  const suspended = kind === 'suspended';
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-5">
      <section className="w-full max-w-[520px] rounded-lg border border-border bg-surface p-8 text-center shadow-sm max-sm:p-6">
        <BrandMark className="mx-auto !size-12" />
        <span className="mx-auto mt-6 grid size-11 place-items-center rounded-full bg-surface-secondary text-primary">
          <Icon name={suspended ? 'shield' : 'building'} size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-medium">
          {suspended ? 'Account suspended' : 'No active workspace'}
        </h1>
        <p className="mx-auto mt-2 max-w-[410px] text-sm leading-6 text-muted">
          {suspended
            ? 'Your access is currently paused. Contact a platform administrator if you think this is a mistake.'
            : 'You are not an active member of an organization yet. Ask an organization administrator for an invitation.'}
        </p>
        {previewMode && viewer.previewIdentity ? (
          <PreviewIdentitySelect
            className="mx-auto mt-7 w-fit text-left"
            onChange={onPreviewIdentityChange}
            value={viewer.previewIdentity}
          />
        ) : null}
        <Button
          className="mt-7"
          onClick={() => void onSignOut()}
          variant="secondary"
        >
          Sign out
        </Button>
      </section>
    </main>
  );
}
