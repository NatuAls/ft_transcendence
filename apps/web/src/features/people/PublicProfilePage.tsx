import { Avatar, Button, Dialog } from 'ui';
import { useState } from 'react';
import { previewMode } from '../../app/session';
import { useTranslation } from '../../core/i18n';
import { initialConnections, people } from './peopleData';
import { ProfileView } from './ProfileView';

/**
 * Sample profiles in the frontend preview; `GET /users/:username` in the
 * application, where `personName` is the username.
 */
export function PublicProfilePage({
  currentUserId,
  onBack,
  onEditOwnProfile,
  onMessage,
  personName,
}: {
  currentUserId: string;
  onBack: () => void;
  onEditOwnProfile: () => void;
  onMessage: (personName: string) => void;
  personName: string;
}) {
  return previewMode ? (
    <PreviewProfilePage
      onBack={onBack}
      onMessage={onMessage}
      personName={personName}
    />
  ) : (
    <ProfileView
      currentUserId={currentUserId}
      onBack={onBack}
      onEditOwnProfile={onEditOwnProfile}
      onMessage={onMessage}
      username={personName}
    />
  );
}

function PreviewProfilePage({
  onBack,
  onMessage,
  personName,
}: {
  onBack: () => void;
  onMessage: (personName: string) => void;
  personName: string;
}) {
  const { t } = useTranslation();
  const initiallyConnected = initialConnections.includes(personName);
  const [connection, setConnection] = useState<
    'connected' | 'none' | 'pending'
  >(initiallyConnected ? 'connected' : 'none');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const person = people.find((item) => item.name === personName) ?? people[0];

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="text-primary max-md:pb-5"
        onClick={onBack}
        type="button"
      >
        ← {t('people.title')}
      </button>
      <section className="mt-7 grid grid-cols-[84px_1fr_auto] items-center rounded-md border border-border bg-surface p-[30px] max-md:mt-0 max-md:flex max-md:flex-col max-md:p-6 max-md:text-center">
        <Avatar
          alt={person.name}
          className="!size-16 !basis-16 !text-[1.0625rem]"
          initials={person.initials}
          online={person.status === 'Online'}
        />
        <div>
          <h1 className="mb-[5px] text-[1.625rem] font-medium max-md:mt-3 max-md:text-[1.375rem]">
            {person.name}
          </h1>
          <p className="mb-2 text-xs text-muted">
            {t(person.role)} · {t('people.preview.organizationName')}
          </p>
          <span
            className={`inline-flex items-center gap-[5px] text-2xs before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${person.status === 'Online' ? 'text-success' : person.status === 'Away' ? 'text-warning' : 'text-muted'}`}
          >
            {t(`people.status.${person.status.toLowerCase()}`)}
          </span>
          <p className="mt-4 max-w-[620px] text-[0.8125rem] leading-[1.55] text-muted max-md:mt-[14px] max-md:text-center max-md:text-xs2">
            {t('people.preview.profileDescription')}
          </p>
        </div>
        <div className="flex gap-2 max-md:mt-5 max-md:w-full max-md:[&_.ui-button]:flex-1">
          {connection === 'connected' ? (
            <>
              <Button onClick={() => onMessage(person.name)}>
                {t('people.actions.sendMessage')}
              </Button>
              <Button
                onClick={() => setConfirmDisconnect(true)}
                variant="secondary"
              >
                {t('people.actions.disconnect')}
              </Button>
            </>
          ) : connection === 'pending' ? (
            <span className="inline-flex min-h-11 items-center rounded-sm bg-warning-surface px-[18px] text-xs font-medium text-warning max-md:flex-1 max-md:justify-center">
              {t('people.actions.requestSent')}
            </span>
          ) : (
            <Button onClick={() => setConnection('pending')}>
              {t('people.actions.connect')}
            </Button>
          )}
        </div>
      </section>
      <div className="mt-5 grid grid-cols-[1fr_340px] gap-5 max-md:mt-3 max-md:block">
        <section className="rounded-md border border-border bg-surface p-[25px] max-md:p-[18px]">
          <h2 className="mb-5 text-base font-medium">
            {t('people.profile.about')}
          </h2>
          <dl className="grid grid-cols-2 gap-5">
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                {t('people.profile.jobTitle')}
              </dt>
              <dd className="mt-[5px] text-xs">{t(person.role)}</dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                {t('people.profile.team')}
              </dt>
              <dd className="mt-[5px] text-xs">{person.team}</dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                {t('people.profile.location')}
              </dt>
              <dd className="mt-[5px] text-xs">
                {t('people.preview.locationValue')}
              </dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                {t('people.profile.memberSince')}
              </dt>
              <dd className="mt-[5px] text-xs">
                {t('people.preview.memberSinceValue')}
              </dd>
            </div>
          </dl>
        </section>
        <aside className="rounded-md border border-border bg-surface p-[25px] max-md:hidden">
          <h2 className="mb-5 text-base font-medium">
            {t('people.profile.sharedContext')}
          </h2>
          <p className="text-xs2 text-muted">
            {t('people.preview.sharedContextDescription')}
          </p>
          <dl className="my-5 grid grid-cols-1 gap-[13px]">
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                {t('people.profile.connection')}
              </dt>
              <dd className="mt-[5px] text-xs">
                {connection === 'connected'
                  ? t('people.preview.connectedSince')
                  : connection === 'pending'
                    ? t('people.preview.connectionPending')
                    : t('people.preview.notConnected')}
              </dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                {t('people.profile.organization')}
              </dt>
              <dd className="mt-[5px] text-xs">
                {t('people.preview.organizationName')}
              </dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                {t('people.profile.onlineState')}
              </dt>
              <dd className="mt-[5px] text-xs">
                {t('people.preview.visible')}
              </dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                {t('people.profile.messages')}
              </dt>
              <dd className="mt-[5px] text-xs">
                {t('people.preview.sharedMessages', { count: 12 })}
              </dd>
            </div>
          </dl>
          {connection === 'connected' ? (
            <Button
              fullWidth
              onClick={() => onMessage(person.name)}
              variant="secondary"
            >
              {t('people.actions.openConversation')}
            </Button>
          ) : (
            <p className="rounded-sm bg-surface-secondary p-3 text-center">
              {t('people.preview.connectFirst')}
            </p>
          )}
        </aside>
      </div>
      {confirmDisconnect ? (
        <Dialog
          description={t('people.preview.disconnectDescription', {
            name: person.name,
          })}
          eyebrow={t('people.preview.connectionEyebrow')}
          footer={
            <>
              <Button
                onClick={() => setConfirmDisconnect(false)}
                variant="secondary"
              >
                {t('people.actions.cancel')}
              </Button>
              <Button
                onClick={() => {
                  setConnection('none');
                  setConfirmDisconnect(false);
                }}
                variant="destructive"
              >
                {t('people.actions.disconnect')}
              </Button>
            </>
          }
          onClose={() => setConfirmDisconnect(false)}
          title={t('people.preview.disconnectTitle', { name: person.name })}
        />
      ) : null}
    </div>
  );
}
