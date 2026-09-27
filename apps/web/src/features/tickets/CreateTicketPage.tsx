import { Button, SelectField, TextField } from 'ui';
import { useState, type FormEvent } from 'react';

interface CreateTicketPageProps {
  onCancel: () => void;
  onSubmit: (values: NewTicketValues) => void;
}

export interface NewTicketValues {
  category: string;
  description: string;
  organization: string;
  priority: 'High' | 'Low' | 'Medium';
  subject: string;
}

const priorities = [
  { description: 'Can wait', label: 'Low' },
  { description: 'Needs attention', label: 'Medium' },
  { description: 'Work is blocked', label: 'High' },
] as const;

export function CreateTicketPage({
  onCancel,
  onSubmit,
}: CreateTicketPageProps) {
  const [description, setDescription] = useState('');
  const [priority, setPriority] =
    useState<NewTicketValues['priority']>('Medium');
  const [subject, setSubject] = useState('');
  const [organization, setOrganization] = useState('Northstar Studio');
  const [category, setCategory] = useState('Account');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ category, description, organization, priority, subject });
  }

  return (
    <div className="mx-auto max-w-[1160px] px-10 py-9 max-md:px-4 max-md:pt-0 max-md:pb-7">
      <button
        className="hidden h-14 w-full items-center gap-4 border-b border-border text-lg text-ink max-md:flex"
        onClick={onCancel}
        type="button"
      >
        ← <strong>Create ticket</strong>
      </button>
      <header className="mb-[30px] flex items-center justify-between max-md:m-0 max-md:block max-md:px-1 max-md:pt-[26px] max-md:pb-5">
        <div>
          <span className="text-[11px] tracking-[.08em] text-muted max-md:hidden">
            TICKETS / NEW
          </span>
          <h1 className="my-2.5 mb-1.5 text-[30px] font-medium max-md:hidden">
            Create a ticket
          </h1>
          <p className="text-sm text-muted max-md:text-[11px]">
            Describe the issue clearly so the right person can help.
          </p>
        </div>
        <button
          className="text-primary max-md:hidden"
          onClick={onCancel}
          type="button"
        >
          ← Back to tickets
        </button>
      </header>

      <div className="grid grid-cols-[minmax(0,680px)_280px] gap-8 max-md:block">
        <form
          className="grid gap-6 rounded-md border border-border bg-surface p-7 max-md:gap-[22px] max-md:px-4 max-md:py-5"
          onSubmit={handleSubmit}
        >
          <header className="max-md:hidden">
            <h2 className="mb-1.5 text-lg font-medium">Ticket details</h2>
            <p className="text-xs text-muted">
              All fields marked * are required.
            </p>
          </header>
          <TextField
            label="Subject *"
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Short summary of the issue"
            required
            value={subject}
          />
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <SelectField
              label="Organization *"
              onChange={(event) => setOrganization(event.target.value)}
              required
              value={organization}
            >
              <option>Northstar Studio</option>
            </SelectField>
            <SelectField
              label="Category *"
              onChange={(event) => setCategory(event.target.value)}
              required
              value={category}
            >
              <option>Account</option>
              <option>Billing</option>
              <option>Organization</option>
            </SelectField>
          </div>
          <label className="relative grid gap-2 text-sm font-medium">
            <span>Description *</span>
            <textarea
              className="min-h-[130px] resize-y rounded-sm border border-border bg-surface p-[14px] text-ink max-md:min-h-[120px]"
              maxLength={1200}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain what happened, what you expected and any steps that reproduce the problem."
              required
              value={description}
            />
            <small className="absolute right-3 bottom-2.5 text-[10px] font-normal text-muted">
              {description.length} / 1200
            </small>
          </label>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2.5 text-sm font-medium">Priority *</legend>
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
                    className={`mt-[5px] size-[7px] rounded-full ${item.label === 'Low' ? 'bg-success' : item.label === 'High' ? 'bg-danger' : 'bg-warning'}`}
                  />
                  <strong className="text-[13px] font-medium">
                    {item.label}
                  </strong>
                  <small className="col-span-full text-[11px] text-muted max-md:hidden">
                    {item.description}
                  </small>
                </label>
              ))}
            </div>
          </fieldset>
          <footer className="flex justify-end gap-2.5 border-t border-border pt-[22px] max-md:sticky max-md:bottom-0 max-md:bg-surface max-md:pt-4 max-md:[&_.ui-button]:flex-1">
            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
            <Button type="submit">Create ticket</Button>
          </footer>
        </form>

        <aside className="self-start rounded-md border border-border bg-surface p-6 max-md:hidden">
          <span className="text-[11px] tracking-[.08em] text-muted">
            BEFORE YOU SUBMIT
          </span>
          <h2 className="mt-3 mb-5 text-lg font-medium">
            Help us solve it faster
          </h2>
          {[
            ['Be specific', 'Use a clear subject that describes the problem.'],
            ['Add context', 'Explain what changed and who is affected.'],
            ['Choose priority', 'Use High only when work is blocked.'],
          ].map(([title, copy], index) => (
            <div
              className="my-[14px] grid grid-cols-[24px_1fr] gap-2.5"
              key={title}
            >
              <b className="grid size-[22px] place-items-center rounded-full bg-[#dce8e3] text-[11px] text-primary">
                {index + 1}
              </b>
              <p className="grid gap-[5px]">
                <strong className="text-xs">{title}</strong>
                <small className="text-[11px] leading-[1.5] text-muted">
                  {copy}
                </small>
              </p>
            </div>
          ))}
          <h3 className="mt-7 mb-[14px] border-t border-border pt-5 text-base font-medium">
            What happens next?
          </h3>
          {[
            'Open — Your request joins the queue.',
            'In progress — An agent takes ownership.',
            'Resolved — You review the proposed solution.',
          ].map((step, index) => (
            <p
              className="flex items-center gap-2.5 text-[10px] text-muted"
              key={step}
            >
              <b className="grid size-[22px] place-items-center rounded-full bg-[#dce8e3] text-[11px] text-primary">
                {index + 1}
              </b>
              {step}
            </p>
          ))}
        </aside>
      </div>
    </div>
  );
}
