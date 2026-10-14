import { Avatar, Icon } from 'ui';
import type { ReactNode } from 'react';
import type { OrgRole, ReservationWaitingFor } from 'contracts';
import { getInitials } from '../../app/text';
import { permissionsForOrganizationRole } from '../../app/session';
import { useTranslation } from '../../core/i18n';
import {
  organizationCapabilities,
  organizationRoleLabel,
  organizationRoles,
} from './rolesGateway';

/**
 * Pieces shared by the platform and the organization role screens. Page files
 * keep the orchestration; these only render.
 */

export function PageHeader({
  description,
  eyebrow,
  title,
}: {
  description: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <header>
      <span className="text-2xs tracking-[.08em] text-muted">{eyebrow}</span>
      <h1 className="my-2 text-[1.875rem] font-medium max-md:text-[1.375rem]">
        {title}
      </h1>
      <p className="max-w-[720px] text-sm leading-6 text-muted">
        {description}
      </p>
    </header>
  );
}

/**
 * A translated sentence with one value in bold, wherever each language puts
 * it. The value goes in as a React node, never inside the text: whatever a
 * user typed as an organization name is shown, not interpreted as markup.
 */
export function Highlighted({
  sentence,
  value,
}: {
  sentence: (marker: string) => string;
  value: string;
}) {
  const marker = '\u0000';
  const [before, after = ''] = sentence(marker).split(marker);
  return (
    <>
      {before}
      <strong className="font-medium">{value}</strong>
      {after}
    </>
  );
}

export function SummaryCards({
  items,
}: {
  items: Array<{ label: string; value: number }>;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('organization.access.summary')}
      className={`my-6 grid gap-3 max-md:grid-cols-2 ${items.length > 3 ? 'grid-cols-4' : 'grid-cols-3'}`}
    >
      {items.map((item) => (
        <article
          className="grid gap-[5px] rounded-md border border-border bg-surface p-[18px]"
          key={item.label}
        >
          <strong className="text-[1.375rem] font-medium">{item.value}</strong>
          <span className="text-xs text-muted">{item.label}</span>
        </article>
      ))}
    </section>
  );
}

export function Panel({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex items-start justify-between gap-4 p-5 max-md:p-4">
        <div>
          <h2 className="text-base font-medium">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-xs leading-5 text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function PersonCell({
  avatarUrl,
  detail,
  name,
  online,
}: {
  avatarUrl?: string | null;
  detail: ReactNode;
  name: string;
  online?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar
        className="!size-9 !basis-9"
        initials={getInitials(name)}
        online={online}
        src={avatarUrl ?? undefined}
      />
      <span className="grid min-w-0 gap-0.5">
        <strong className="truncate text-sm font-medium">{name}</strong>
        <small className="truncate text-xs text-muted">{detail}</small>
      </span>
    </span>
  );
}

/** A short label next to a name. Never the only carrier of meaning: it is text. */
export function Tag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}) {
  const tones = {
    danger: 'bg-danger-surface text-danger',
    info: 'bg-info-surface text-info',
    neutral: 'bg-surface-secondary text-muted',
    success: 'bg-success-surface text-success',
    warning: 'bg-warning-surface text-warning',
  };
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function WaitingTag({ reason }: { reason: ReservationWaitingFor }) {
  const { t } = useTranslation();
  return (
    <span className="grid justify-items-start gap-0.5">
      <Tag tone={reason === 'ACCOUNT' ? 'warning' : 'info'}>
        {t(`organization.access.waiting.${reason}.label`)}
      </Tag>
      <small className="text-xs text-muted max-md:hidden">
        {t(`organization.access.waiting.${reason}.hint`)}
      </small>
    </span>
  );
}

/**
 * The link explained in three steps, because the one thing an administrator
 * must understand is that assigning by address does NOT create the account.
 * Without an organization, the role is the platform's.
 */
export function HowTheLinkWorks({
  organizationName,
}: {
  organizationName?: string;
}) {
  const { t } = useTranslation();
  const steps = [
    organizationName
      ? t('organization.access.link.stepOneOrganization', {
          organization: organizationName,
        })
      : t('organization.access.link.stepOnePlatform'),
    t('organization.access.link.stepTwo'),
    t('organization.access.link.stepThree'),
  ];
  return (
    <aside className="grid content-start gap-4 rounded-md border border-border bg-surface p-5">
      <h2 className="text-base font-medium">
        {t('organization.access.link.title')}
      </h2>
      <ol className="grid gap-3">
        {steps.map((step, index) => (
          <li className="grid grid-cols-[28px_1fr] gap-2.5" key={step}>
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-surface-secondary text-xs font-medium text-primary"
            >
              {index + 1}
            </span>
            <span className="text-sm leading-6 text-muted">{step}</span>
          </li>
        ))}
      </ol>
      <p className="flex gap-2 rounded-sm bg-info-surface p-3 text-xs leading-5 text-info">
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          name="shield"
          size={15}
        />
        <span>{t('organization.access.link.protection')}</span>
      </p>
    </aside>
  );
}

/** What each organization role can do, as a table a screen reader can walk. */
export function CapabilityMatrix({ highlight }: { highlight?: OrgRole }) {
  const { t } = useTranslation();
  return (
    <Panel
      description={t('organization.access.matrix.description')}
      title={t('organization.access.matrix.title')}
    >
      {/* Scrolls sideways on a phone; focusable so a keyboard can scroll it. */}
      <div
        aria-label={t('organization.access.matrix.label')}
        className="overflow-x-auto border-t border-border focus-visible:outline-3 focus-visible:outline-focus"
        role="region"
        tabIndex={0}
      >
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <caption className="sr-only">
            {t('organization.access.matrix.label')}
          </caption>
          <thead className="bg-surface-secondary text-xs text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium" scope="col">
                {t('organization.access.matrix.capability')}
              </th>
              {organizationRoles.map((role) => (
                <th
                  className={`px-3 py-2.5 text-center font-medium ${role.value === highlight ? 'text-primary' : ''}`}
                  key={role.value}
                  scope="col"
                >
                  {organizationRoleLabel(role.value)}
                  {role.value === highlight ? (
                    <span className="block text-2xs">
                      {t('organization.access.matrix.yourRole')}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {organizationCapabilities.map((capability) => (
              <tr
                className="border-t border-border"
                key={capability.permission}
              >
                <th className="px-5 py-2.5 font-normal" scope="row">
                  {t(`organization.access.capabilities.${capability.key}`)}
                </th>
                {organizationRoles.map((role) => {
                  const allowed = permissionsForOrganizationRole(
                    role.value,
                  ).includes(capability.permission);
                  return (
                    <td
                      className={`px-3 py-2.5 text-center ${role.value === highlight ? 'bg-success-surface/40' : ''}`}
                      key={role.value}
                    >
                      {allowed ? (
                        <span className="text-success">
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">
                            {t('organization.access.matrix.yes')}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">
                            {t('organization.access.matrix.no')}
                          </span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
