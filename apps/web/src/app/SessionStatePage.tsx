import { Alert, BrandMark, Button, Icon } from 'ui';
import { useState } from 'react';
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
  onRecheck,
  onSignOut,
  viewer,
}: {
  kind: 'no-organization' | 'suspended';
  onPreviewIdentityChange: (identity: PreviewIdentity) => void;
  /**
   * Vuelve a leer la sesión del servidor. Es lo que convierte esta pantalla
   * en algo que se resuelve solo: en cuanto un administrador añade la
   * dirección a su organización, la persona entra desde aquí. Sin esto, la
   * única salida era cerrar sesión y volver a entrar, que nadie adivina.
   */
  onRecheck: () => Promise<ViewerSession | null>;
  onSignOut: () => void | Promise<void>;
  viewer: ViewerSession;
}) {
  const suspended = kind === 'suspended';
  const [checking, setChecking] = useState(false);
  const [nothingYet, setNothingYet] = useState(false);

  async function recheck() {
    setChecking(true);
    setNothingYet(false);
    try {
      // Si la pertenencia ya existe, App deja de pintar esta pantalla sola:
      // `viewer.memberships` deja de estar vacío y el armazón toma el relevo.
      await onRecheck();
      setNothingYet(true);
    } finally {
      setChecking(false);
    }
  }
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
                : 'You are not in an organization yet'}
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
          {nothingYet ? (
            <Alert className="mt-6 text-left" tone="info">
              {suspended
                ? 'Your account is still suspended.'
                : 'Nothing yet: your address is still not a member of any organization. Leave this page open and check again in a while.'}
            </Alert>
          ) : null}
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button disabled={checking} onClick={() => void recheck()}>
              {checking ? 'Checking…' : 'Check again'}
            </Button>
            <Button onClick={() => void onSignOut()} variant="secondary">
              Sign out
            </Button>
          </div>
        </section>
        <LegalLinks className="text-xs" />
      </div>
    </main>
  );
}
