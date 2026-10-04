import { BrandMark, Button, Icon } from 'ui';
import { PendingRolesNotice } from '../features/roles/PendingRolesNotice';
import { LegalLinks } from '../layout/AppFooter';
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
  // Somebody who has just registered the address an administrator reserved a
  // role for lands here: they have no organization YET. Say what is waiting
  // and what activates it, instead of "ask for an invitation" - they already
  // have one.
  const waiting =
    !suspended && !viewer.emailVerified && viewer.pendingRoles.length > 0;
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-5">
      <div className="grid w-full max-w-[520px] gap-5">
        <section className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm max-sm:p-6">
          <BrandMark className="mx-auto !size-12" />
          <span className="mx-auto mt-6 grid size-11 place-items-center rounded-full bg-surface-secondary text-primary">
            <Icon name={suspended ? 'shield' : 'building'} size={22} />
          </span>
          <h1 className="mt-4 text-2xl font-medium">
            {suspended
              ? 'Account suspended'
              : waiting
                ? 'Confirm your e-mail to continue'
                : 'No active workspace'}
          </h1>
          <p className="mx-auto mt-2 max-w-[410px] text-sm leading-6 text-muted">
            {suspended
              ? 'Your access is currently paused. Contact a platform administrator if you think this is a mistake.'
              : waiting
                ? `Your access is ready and waiting for one thing: confirming ${viewer.profile.email}.`
                : `You are not an active member of an organization yet. Ask an organization administrator to give a role to your address, ${viewer.profile.email}; you will join as soon as they do.`}
          </p>
          {waiting ? (
            <PendingRolesNotice
              className="mt-6"
              emailVerified={viewer.emailVerified}
              pendingRoles={viewer.pendingRoles}
            />
          ) : null}
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
        <LegalLinks className="text-xs" />
      </div>
    </main>
  );
}
