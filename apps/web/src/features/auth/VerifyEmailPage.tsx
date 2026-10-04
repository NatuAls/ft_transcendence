import { BrandMark, Button, Icon, LoadingState } from 'ui';
import { useEffect, useRef, useState } from 'react';
import { verifyEmail } from '../../api/verification';
import { previewMode, type ViewerSession } from '../../app/session';
import { organizationRoleLabel } from '../roles/rolesGateway';

type State =
  | { kind: 'checking' }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; viewer: ViewerSession | null };

/**
 * Where the confirmation e-mail lands (`#verify-email?token=…`).
 *
 * The API used to build `/verify-email?token=…`, a path no router has: the
 * link opened the home screen and the token was lost, so no address could
 * ever be confirmed - and no role reserved for an address could ever reach
 * its account. Confirming is public (the token proves the mailbox, a session
 * is not needed); when there IS a session, the page reloads it and shows the
 * access that has just become active.
 */
export function VerifyEmailPage({
  onContinue,
  onVerified,
  token,
}: {
  onContinue: (signedIn: boolean) => void;
  onVerified: () => Promise<ViewerSession | null>;
  token: string;
}) {
  const [state, setState] = useState<State>(
    token ? { kind: 'checking' } : { kind: 'missing' },
  );
  // A token works once. React's development double-mount must not spend it
  // on the first, discarded run and then report the second one as invalid.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    // The token is single use and has just been read: take it out of the
    // address bar and the history, where it would only linger.
    window.history.replaceState(null, '', '#verify-email');
    (previewMode ? Promise.resolve() : verifyEmail(token))
      .then(() => onVerified())
      .then((viewer) => setState({ kind: 'done', viewer }))
      .catch(() =>
        setState({
          kind: 'failed',
          message:
            'This link is not valid any more: it was already used, it expired after 24 hours, or a newer one was sent.',
        }),
      );
  }, [onVerified, token]);

  const viewer = state.kind === 'done' ? state.viewer : null;
  const access = viewer
    ? [
        ...(viewer.globalRole === 'GLOBAL_ADMIN'
          ? ['Platform administrator']
          : []),
        ...viewer.memberships.map(
          (membership) =>
            `${organizationRoleLabel(membership.role)} in ${membership.organizationName}`,
        ),
      ]
    : [];

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-5">
      <section className="w-full max-w-[520px] rounded-lg border border-border bg-surface p-8 text-center shadow-sm max-sm:p-6">
        <BrandMark className="mx-auto !size-12" />
        {state.kind === 'checking' ? (
          <div className="mt-6">
            <LoadingState label="Confirming your e-mail address" />
          </div>
        ) : (
          <>
            <span
              className={`mx-auto mt-6 grid size-11 place-items-center rounded-full ${state.kind === 'done' ? 'bg-success-surface text-success' : 'bg-surface-secondary text-primary'}`}
            >
              <Icon
                aria-hidden="true"
                name={state.kind === 'done' ? 'check' : 'shield'}
                size={22}
              />
            </span>
            <h1 className="mt-4 text-2xl font-medium">
              {state.kind === 'done'
                ? 'Address confirmed'
                : state.kind === 'missing'
                  ? 'Nothing to confirm'
                  : 'The link did not work'}
            </h1>
            <p
              aria-live="polite"
              className="mx-auto mt-2 max-w-[410px] text-sm leading-6 text-muted"
              role="status"
            >
              {state.kind === 'done'
                ? viewer
                  ? 'Your e-mail address is confirmed. Any role an administrator had reserved for it is now active.'
                  : 'Your e-mail address is confirmed. Sign in to use your account, including any role an administrator had reserved for it.'
                : state.kind === 'missing'
                  ? 'This page opens from the link in the confirmation e-mail. Open the newest message and follow its link.'
                  : `${state.message} Sign in and ask for a new one from the notice on your screen.`}
            </p>
            {access.length ? (
              <div className="mx-auto mt-5 max-w-[410px] rounded-md border border-border bg-surface-secondary p-4 text-left">
                <span className="text-xs font-medium text-muted">
                  YOUR ACCESS NOW
                </span>
                <ul className="mt-2 grid gap-1 text-sm">
                  {access.map((item) => (
                    <li className="flex items-center gap-2" key={item}>
                      <Icon
                        aria-hidden="true"
                        className="text-success"
                        name="check"
                        size={15}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button
              className="mt-7"
              onClick={() => onContinue(Boolean(viewer))}
            >
              {viewer ? 'Continue to HelpDesk Lite' : 'Go to sign in'}
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
