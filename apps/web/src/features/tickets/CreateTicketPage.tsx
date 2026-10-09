import { Alert, Button, SelectField, TextField } from 'ui';
import { useState, type FormEvent } from 'react';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import {
  errorKey,
  fieldErrors,
  fieldErrorsFromIssues,
} from '../../core/api/errors';
import { useToast } from '../../core/feedback/useToast';
import { useTranslation } from '../../core/i18n';
import { createTicketSchema } from 'contracts';
import { createTicket, type NewTicketValues } from '../../api/tickets';
import { listCategories } from '../../api/organizations';

interface CreateTicketPageProps {
  onCancel: () => void;
  onCreated: () => void;
  organizationName: string;
  organizationId: string;
}

const priorities = [
  { description: 'low', label: 'LOW' },
  { description: 'medium', label: 'MEDIUM' },
  { description: 'high', label: 'HIGH' },
] as const;

export function CreateTicketPage({
  onCancel,
  onCreated,
  organizationName,
  organizationId,
}: CreateTicketPageProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const categoriesQuery = useAsync(
    () => listCategories(organizationId),
    [organizationId],
  );

  const [description, setDescription] = useState('');
  const [priority, setPriority] =
    useState<NewTicketValues['priority']>('MEDIUM');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  const categories = categoriesQuery.data ?? [];
  const activeCategories = categories.filter((c) => c.isActive);
  const hasCategories = activeCategories.length > 0;
  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sent) return; // sin doble envío

    const parsed = createTicketSchema.safeParse({
      organizationId,
      title,
      description,
      priority,
      categoryId: categoryId === '' ? undefined : categoryId,
    });
    if (!parsed.success) {
      // mismo criterio que el servidor
      setErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }
    setErrors({});
    setGeneralError('');
    setSent(true);
    try {
      await createTicket(parsed.data);
      toast.success(t('tickets.create.done'));
      onCreated(); // navegar, cerrar, recargar…
    } catch (error) {
      const porCampo = fieldErrors(error); // 400 con details
      if (Object.keys(porCampo).length) setErrors(porCampo);
      else setGeneralError(t(errorKey(error))); // 409, 403, red…
    } finally {
      setSent(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1160px] px-10 py-9 max-[900px]:px-4 max-[900px]:pt-0 max-[900px]:pb-7">
      <button
        className="hidden h-14 w-full items-center gap-4 border-b border-border text-lg text-ink max-[900px]:flex"
        onClick={onCancel}
        type="button"
      >
        ← <strong>{t('tickets.create.actions.submit')}</strong>
      </button>
      <header className="mb-[30px] flex items-center justify-between max-[900px]:m-0 max-[900px]:block max-[900px]:px-1 max-[900px]:pt-[26px] max-[900px]:pb-5">
        <div>
          <span className="text-xs2 tracking-[.08em] text-muted max-[900px]:hidden">
            {t('tickets.create.breadcrumbs')}
          </span>
          <h1 className="my-2.5 mb-1.5 text-[1.875rem] font-medium max-[900px]:hidden">
            {t('tickets.create.title')}
          </h1>
          <p className="text-sm text-muted max-[900px]:text-xs2">
            {t('tickets.create.subtitle')}
          </p>
        </div>
        <button
          className="text-primary max-[900px]:hidden"
          onClick={onCancel}
          type="button"
        >
          ← {t('tickets.create.back')}
        </button>
      </header>

      <AsyncState
        status={categoriesQuery.status}
        error={categoriesQuery.error}
        onRetry={categoriesQuery.reload}
      >
        <div className="grid grid-cols-[minmax(0,680px)_280px] gap-8 max-[900px]:block">
          <form
            className="grid min-w-0 gap-6 rounded-md border border-border bg-surface p-7 max-md:gap-[22px] max-md:px-4 max-md:py-5"
            onSubmit={handleSubmit}
          >
            <header className="max-md:hidden">
              <h2 className="mb-1.5 text-lg font-medium">
                {t('tickets.create.detailsTitle')}
              </h2>
              <p className="text-xs text-muted">
                {t('tickets.create.requiredNote')}
              </p>
            </header>

            {generalError && (
              <Alert role="alert" tone="danger">
                {generalError}
              </Alert>
            )}

            <TextField
              label={t('tickets.create.fields.subject')}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('tickets.create.fields.subjectPlaceholder')}
              required
              minLength={5}
              maxLength={160}
              value={title}
              error={errors.title}
            />
            <div className="grid min-w-0 grid-cols-2 gap-4 max-md:grid-cols-1">
              <TextField
                label={t('tickets.create.fields.organization')}
                disabled
                value={organizationName}
              />
              <SelectField
                label={t('tickets.create.fields.category')}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={!hasCategories}
                required={hasCategories}
                value={categoryId}
              >
                <option value="">
                  {hasCategories
                    ? t('tickets.create.fields.categoryPlaceholder')
                    : t('tickets.create.fields.noCategories')}
                </option>
                {activeCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
            </div>
            {selectedCategory?.description ? (
              <p className="-mt-4 text-xs2 text-muted">
                {selectedCategory.description}
              </p>
            ) : null}
            <label className="relative grid gap-[7px] text-xs leading-[1.2] font-medium text-ink">
              <span>{t('tickets.create.fields.description')}</span>
              <textarea
                className="min-h-[130px] w-full min-w-0 resize-y rounded-[10px] border border-border bg-[#f7faf8] p-4 text-sm leading-[1.2] text-ink max-md:min-h-[120px]"
                minLength={10}
                maxLength={5000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('tickets.create.fields.descriptionPlaceholder')}
                required
                value={description}
              />
              <small className="absolute right-3 bottom-2.5 text-2xs font-normal text-muted">
                {description.length} / 5000
              </small>
              {errors.description && (
                <span className="text-xs text-danger">
                  {errors.description}
                </span>
              )}
            </label>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2.5 text-xs leading-[1.2] font-medium text-ink">
                {t('tickets.create.fields.priority')}
              </legend>
              <div className="grid grid-cols-3 gap-2.5 max-md:gap-2">
                {priorities.map((item) => (
                  <label
                    className="grid cursor-pointer grid-cols-[10px_1fr] gap-x-2 gap-y-[3px] rounded-sm border border-border p-[14px] has-checked:border-primary has-checked:bg-surface-secondary max-md:grid-cols-[8px_1fr] max-md:px-[9px] max-md:py-[11px]"
                    key={item.label}
                  >
                    <input
                      className="absolute opacity-0"
                      checked={priority === item.label}
                      name="priority"
                      onChange={() => setPriority(item.label)}
                      type="radio"
                    />
                    <span
                      className={`mt-[5px] size-[7px] rounded-full ${item.label === 'LOW' ? 'bg-success' : item.label === 'HIGH' ? 'bg-danger' : 'bg-warning'}`}
                    />
                    <strong className="text-[0.8125rem] font-medium">
                      {t(`tickets.priority.${item.label}`)}
                    </strong>
                    <small className="col-span-full text-xs2 text-muted max-md:hidden">
                      {t(
                        `tickets.create.fields.priorityDescriptions.${item.description}`,
                      )}
                    </small>
                  </label>
                ))}
              </div>
            </fieldset>
            <footer className="flex min-w-0 justify-end gap-2.5 border-t border-border pt-[22px] max-[900px]:sticky max-[900px]:bottom-[74px] max-[900px]:z-10 max-[900px]:bg-surface max-[900px]:pt-4 max-[900px]:[&_.ui-button]:!min-w-0 max-[900px]:[&_.ui-button]:flex-1 max-[900px]:[&_.ui-button]:!px-2 max-[900px]:[&_.ui-button]:text-xs max-[900px]:[&_.ui-button]:whitespace-nowrap">
              <Button onClick={onCancel} variant="secondary">
                {t('tickets.create.actions.cancel')}
              </Button>
              <Button type="submit" disabled={sent}>
                {sent
                  ? t('tickets.create.actions.submitting')
                  : t('tickets.create.actions.submit')}
              </Button>
            </footer>
          </form>

          <aside className="self-start rounded-md border border-border bg-surface p-6 max-[900px]:hidden">
            <span className="text-xs2 tracking-[.08em] text-muted">
              {t('tickets.create.aside.before')}
            </span>
            <h2 className="mt-3 mb-5 text-lg font-medium">
              {t('tickets.create.aside.helpTitle')}
            </h2>
            {[
              ['specificTitle', 'specificText'],
              ['contextTitle', 'contextText'],
              ['priorityTitle', 'priorityText'],
            ].map(([title, copy], index) => (
              <div
                className="my-[14px] grid grid-cols-[24px_1fr] gap-2.5"
                key={title}
              >
                <b className="grid size-[22px] place-items-center rounded-full bg-[#dce8e3] text-xs2 text-primary">
                  {index + 1}
                </b>
                <p className="grid gap-[5px]">
                  <strong className="text-xs">
                    {t(`tickets.create.aside.tips.${title}`)}
                  </strong>
                  <small className="text-xs2 leading-[1.5] text-muted">
                    {t(`tickets.create.aside.tips.${copy}`)}
                  </small>
                </p>
              </div>
            ))}
            <h3 className="mt-7 mb-[14px] border-t border-border pt-5 text-base font-medium">
              {t('tickets.create.aside.nextTitle')}
            </h3>
            {['open', 'inProgress', 'resolved'].map((step, index) => (
              <p
                className="flex items-center gap-2.5 text-2xs text-muted"
                key={step}
              >
                <b className="grid size-[22px] place-items-center rounded-full bg-[#dce8e3] text-xs2 text-primary">
                  {index + 1}
                </b>
                {t(`tickets.create.aside.steps.${step}`)}
              </p>
            ))}
          </aside>
        </div>
      </AsyncState>
    </div>
  );
}
