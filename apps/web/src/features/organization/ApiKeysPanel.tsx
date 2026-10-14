import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  LoadingState,
  SelectField,
  TextField,
} from 'ui';
import { useId, useRef, useState, type FormEvent } from 'react';
import {
  apiScopeSchema,
  createApiKeySchema,
  type ApiScope,
  type CreateApiKeyInput,
} from 'contracts';
import * as organizationsApi from '../../api/organizations';
import type { ApiKeyRecord, CreatedApiKey } from '../../api/organizations';
import { previewMode } from '../../app/session';
import {
  errorKey,
  fieldErrors,
  fieldErrorsFromIssues,
} from '../../core/api/errors';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { useTranslation } from '../../core/i18n';
import { Tag } from '../roles/RoleParts';

const SCOPES = apiScopeSchema.options;
/** Days until it expires; empty, never. A key that never expires is a choice. */
const EXPIRY = ['30', '90', '180', '365', ''] as const;

/** `tickets:read` → `ticketsRead`: i18next reads «:» as a namespace mark. */
const scopeKey = (scope: ApiScope) =>
  scope.replace(/:(\w)/, (_, letter: string) => letter.toUpperCase());

type KeyStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

function statusOf(key: ApiKeyRecord): KeyStatus {
  if (key.revokedAt) return 'REVOKED';
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now())
    return 'EXPIRED';
  return 'ACTIVE';
}

// La vista previa no tiene API: sus claves viven en memoria mientras dura.
const previewKeys: ApiKeyRecord[] = [];

function previewCreate(input: CreateApiKeyInput): CreatedApiKey {
  const prefix = crypto.randomUUID().slice(0, 8);
  const key: ApiKeyRecord = {
    createdAt: new Date().toISOString(),
    createdBy: { username: 'preview' },
    expiresAt: input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null,
    id: crypto.randomUUID(),
    lastUsedAt: null,
    name: input.name,
    prefix,
    rateLimitPerMinute: 60,
    revokedAt: null,
    scopes: input.scopes,
  };
  previewKeys.unshift(key);
  return {
    ...key,
    secret: `hdl_live_${prefix}.${crypto.randomUUID().replace(/-/g, '')}`,
  };
}

/**
 * The organization's keys for the public API (PR 2.2): list, create, revoke.
 *
 * The secret of a new key arrives once, in the answer to creating it, and is
 * shown once: it lives in the state of the dialog that shows it and goes with
 * it. Nothing keeps it — no other state, no storage, no URL, no log — because
 * the server keeps only its hash and nobody, there or here, can show it again.
 *
 * The page header owns the «Create key» button, like the other tabs; the
 * panel owns the rest.
 */
export function ApiKeysPanel({
  creating,
  onCreatingChange,
  organizationId,
}: {
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
  organizationId: string;
}) {
  const { t, i18n } = useTranslation();
  const keys = useAsync(
    async () =>
      previewMode
        ? [...previewKeys]
        : organizationsApi.listApiKeys(organizationId),
    [organizationId],
  );
  const list = keys.data ?? [];
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');

  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(value),
    );

  async function revoke(key: ApiKeyRecord) {
    setBusy(true);
    setFeedback('');
    setFailure('');
    try {
      if (previewMode) {
        const found = previewKeys.find((row) => row.id === key.id);
        if (found) found.revokedAt = new Date().toISOString();
      } else {
        await organizationsApi.revokeApiKey(organizationId, key.id);
      }
      setFeedback(t('organization.apiKeys.revoked', { name: key.name }));
      keys.reload();
    } catch (error) {
      setFailure(t(errorKey(error)));
    } finally {
      setBusy(false);
      setRevoking(null);
    }
  }

  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-[18px] py-3 text-xs2 text-muted max-md:px-3">
        <span>{t('organization.apiKeys.usage')}</span>
        <a
          className="text-primary underline underline-offset-2"
          href="/api/v1/docs"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('organization.apiKeys.docs')}
        </a>
        <span>{t('organization.apiKeys.docsNote')}</span>
      </p>
      {feedback ? (
        <Alert
          aria-live="polite"
          className="mx-[18px] mb-3 !py-2.5 !text-xs2 max-md:mx-3"
          role="status"
          tone="success"
        >
          {feedback}
        </Alert>
      ) : null}
      {failure ? (
        <Alert
          className="mx-[18px] mb-3 !py-2.5 !text-xs2 max-md:mx-3"
          tone="danger"
        >
          {failure}
        </Alert>
      ) : null}
      <AsyncState
        emptyDescription={t('organization.apiKeys.emptyDescription')}
        emptyTitle={t('organization.apiKeys.emptyTitle')}
        error={keys.error}
        errorTitle={t('organization.apiKeys.errorTitle')}
        isEmpty={!list.length}
        loading={
          <div className="border-t border-border p-5">
            <LoadingState label={t('organization.apiKeys.loading')} />
          </div>
        }
        onRetry={keys.reload}
        status={keys.status}
      >
        <ul className="border-t border-border">
          {list.map((key) => {
            const status = statusOf(key);
            return (
              <li
                className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-[18px] py-3 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:px-3"
                key={key.id}
              >
                <div className="grid min-w-0 gap-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <strong className="truncate text-xs">{key.name}</strong>
                    <Tag
                      tone={
                        status === 'ACTIVE'
                          ? 'success'
                          : status === 'EXPIRED'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {t(`organization.apiKeys.status.${status}`)}
                    </Tag>
                  </span>
                  <code className="truncate text-2xs text-muted">
                    hdl_live_{key.prefix}…
                  </code>
                  <small className="text-2xs text-muted">
                    {t('organization.apiKeys.createdBy', {
                      date: date(key.createdAt),
                      username: key.createdBy.username,
                    })}
                  </small>
                </div>
                <ul
                  aria-label={t('organization.apiKeys.dialog.scopes')}
                  className="flex flex-wrap gap-1.5 max-md:order-3 max-md:col-span-2"
                >
                  {key.scopes.map((scope) => (
                    <li key={scope}>
                      <Tag>
                        {t(`organization.apiKeys.scopes.${scopeKey(scope)}`)}
                      </Tag>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-1 text-2xs text-muted max-md:order-4 max-md:col-span-2">
                  <span>
                    {key.revokedAt
                      ? t('organization.apiKeys.revokedOn', {
                          date: date(key.revokedAt),
                        })
                      : key.expiresAt
                        ? t(
                            status === 'EXPIRED'
                              ? 'organization.apiKeys.expired'
                              : 'organization.apiKeys.expires',
                            { date: date(key.expiresAt) },
                          )
                        : t('organization.apiKeys.noExpiry')}
                  </span>
                  <span>
                    {key.lastUsedAt
                      ? t('organization.apiKeys.lastUsed', {
                          date: date(key.lastUsedAt),
                        })
                      : t('organization.apiKeys.neverUsed')}
                  </span>
                </div>
                {status === 'REVOKED' ? (
                  <span aria-hidden="true" />
                ) : (
                  <Button
                    aria-label={t('organization.apiKeys.revokeLabel', {
                      name: key.name,
                    })}
                    disabled={busy}
                    onClick={() => setRevoking(key)}
                    size="compact"
                    variant="secondary"
                  >
                    {t('organization.apiKeys.revoke')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </AsyncState>
      {creating ? (
        <CreateKeyDialog
          onClose={() => onCreatingChange(false)}
          onCreated={(key) => {
            onCreatingChange(false);
            setFeedback('');
            setCreated(key);
            keys.reload();
          }}
          organizationId={organizationId}
        />
      ) : null}
      {created ? (
        <SecretDialog apiKey={created} onClose={() => setCreated(null)} />
      ) : null}
      {revoking ? (
        <Dialog
          description={t('organization.apiKeys.revokeDialog.description')}
          eyebrow={t('organization.eyebrow')}
          footer={
            <>
              <Button
                disabled={busy}
                onClick={() => setRevoking(null)}
                variant="secondary"
              >
                {t('organization.apiKeys.revokeDialog.keep')}
              </Button>
              <Button disabled={busy} type="submit" variant="destructive">
                {t('organization.apiKeys.revokeDialog.confirm')}
              </Button>
            </>
          }
          onClose={() => {
            if (!busy) setRevoking(null);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void revoke(revoking);
          }}
          title={t('organization.apiKeys.revokeDialog.title', {
            name: revoking.name,
          })}
        />
      ) : null}
    </>
  );
}

function CreateKeyDialog({
  onClose,
  onCreated,
  organizationId,
}: {
  onClose: () => void;
  onCreated: (key: CreatedApiKey) => void;
  organizationId: string;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ReadonlySet<ApiScope>>(new Set());
  const [expiry, setExpiry] = useState<(typeof EXPIRY)[number]>('90');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    // El mismo esquema que aplica la API: lo que se rechaza aquí, y cómo se
    // dice, es lo mismo que respondería ella.
    const parsed = createApiKeySchema.safeParse({
      name,
      scopes: SCOPES.filter((scope) => scopes.has(scope)),
      ...(expiry ? { expiresInDays: Number(expiry) } : {}),
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }
    setErrors({});
    setFailure('');
    setSubmitting(true);
    try {
      onCreated(
        previewMode
          ? previewCreate(parsed.data)
          : await organizationsApi.createApiKey(organizationId, parsed.data),
      );
    } catch (error) {
      const porCampo = fieldErrors(error);
      if (Object.keys(porCampo).length) setErrors(porCampo);
      else setFailure(t(errorKey(error)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      description={t('organization.apiKeys.dialog.description')}
      eyebrow={t('organization.eyebrow')}
      footer={
        <>
          <Button disabled={submitting} onClick={onClose} variant="secondary">
            {t('common.actions.cancel')}
          </Button>
          <Button disabled={submitting} type="submit">
            {submitting
              ? t('organization.apiKeys.dialog.submitting')
              : t('organization.apiKeys.dialog.submit')}
          </Button>
        </>
      }
      onClose={() => {
        if (!submitting) onClose();
      }}
      onSubmit={(event) => void submit(event)}
      title={t('organization.apiKeys.dialog.title')}
    >
      <TextField
        autoComplete="off"
        error={errors.name}
        label={t('organization.apiKeys.dialog.name')}
        maxLength={60}
        name="name"
        onChange={(event) => setName(event.target.value)}
        placeholder={t('organization.apiKeys.dialog.namePlaceholder')}
        value={name}
      />
      <fieldset className="m-0 grid min-w-0 gap-2.5 border-0 p-0">
        <legend className="mb-2.5 text-xs leading-[1.2] font-medium text-ink">
          {t('organization.apiKeys.dialog.scopes')}
        </legend>
        {SCOPES.map((scope) => (
          <Checkbox
            checked={scopes.has(scope)}
            key={scope}
            label={
              <>
                {t(`organization.apiKeys.scopes.${scopeKey(scope)}`)}{' '}
                <code className="text-2xs">{scope}</code>
              </>
            }
            name="scopes"
            onChange={(event) => {
              const next = new Set(scopes);
              if (event.target.checked) next.add(scope);
              else next.delete(scope);
              setScopes(next);
            }}
            value={scope}
          />
        ))}
        {errors.scopes ? (
          <span className="text-xs text-danger" role="alert">
            {errors.scopes}
          </span>
        ) : null}
      </fieldset>
      <SelectField
        label={t('organization.apiKeys.dialog.expiry')}
        name="expiry"
        onChange={(event) =>
          setExpiry(event.target.value as (typeof EXPIRY)[number])
        }
        value={expiry}
      >
        {EXPIRY.map((days) => {
          const option = days ? `days${days}` : 'never';
          return (
            <option key={option} value={days}>
              {t(`organization.apiKeys.dialog.expiryOptions.${option}`)}
            </option>
          );
        })}
      </SelectField>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
    </Dialog>
  );
}

/**
 * The secret, once. Closing the dialog — the button, Escape — is the end of
 * it: the parent forgets the key it received and nothing else ever had it.
 */
function SecretDialog({
  apiKey,
  onClose,
}: {
  apiKey: CreatedApiKey;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copyIt() {
    try {
      // Sin HTTPS no hay portapapeles: `clipboard` ni existe y esto lanza.
      await navigator.clipboard.writeText(apiKey.secret);
      setCopy('copied');
    } catch {
      field.current?.select();
      setCopy('failed');
    }
  }

  return (
    <Dialog
      description={t('organization.apiKeys.secret.description')}
      eyebrow={t('organization.eyebrow')}
      footer={
        <Button type="submit">{t('organization.apiKeys.secret.done')}</Button>
      }
      initialFocusRef={field}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onClose();
      }}
      title={t('organization.apiKeys.secret.title')}
    >
      <div className="grid gap-[7px]">
        <label
          className="text-xs leading-[1.2] font-medium text-ink"
          htmlFor={fieldId}
        >
          {t('organization.apiKeys.secret.label', { name: apiKey.name })}
        </label>
        <div className="flex min-w-0 gap-2 max-md:grid">
          <input
            autoComplete="off"
            className="h-[52px] min-w-0 flex-1 rounded-[10px] border border-border bg-surface-secondary px-4 font-mono text-sm text-ink"
            id={fieldId}
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            ref={field}
            spellCheck={false}
            value={apiKey.secret}
          />
          <Button onClick={() => void copyIt()} variant="secondary">
            {copy === 'copied'
              ? t('organization.apiKeys.secret.copied')
              : t('organization.apiKeys.secret.copy')}
          </Button>
        </div>
      </div>
      <p aria-live="polite" className="text-xs text-danger">
        {copy === 'failed' ? t('organization.apiKeys.secret.copyFailed') : ''}
      </p>
      <p className="text-xs text-muted">{t('organization.apiKeys.usage')}</p>
    </Dialog>
  );
}
