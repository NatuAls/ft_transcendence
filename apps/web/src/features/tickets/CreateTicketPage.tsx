import { Button, SelectField, TextField } from 'ui';
import { useState, type FormEvent } from 'react';
import './create-ticket.css';

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
    <div className="create-ticket-page">
      <button
        className="create-ticket-page__mobile-back"
        onClick={onCancel}
        type="button"
      >
        ← <strong>Create ticket</strong>
      </button>
      <header className="create-ticket-page__heading">
        <div>
          <span>TICKETS / NEW</span>
          <h1>Create a ticket</h1>
          <p>Describe the issue clearly so the right person can help.</p>
        </div>
        <button onClick={onCancel} type="button">
          ← Back to tickets
        </button>
      </header>

      <div className="create-ticket-page__grid">
        <form className="create-ticket-form" onSubmit={handleSubmit}>
          <header>
            <h2>Ticket details</h2>
            <p>All fields marked * are required.</p>
          </header>
          <TextField
            label="Subject *"
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Short summary of the issue"
            required
            value={subject}
          />
          <div className="create-ticket-form__columns">
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
          <label className="create-ticket-form__description">
            <span>Description *</span>
            <textarea
              maxLength={1200}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain what happened, what you expected and any steps that reproduce the problem."
              required
              value={description}
            />
            <small>{description.length} / 1200</small>
          </label>
          <fieldset className="create-ticket-priority">
            <legend>Priority *</legend>
            <div>
              {priorities.map((item) => (
                <label key={item.label}>
                  <input
                    checked={priority === item.label}
                    name="priority"
                    onChange={() => setPriority(item.label)}
                    type="radio"
                  />
                  <span
                    className={`create-ticket-priority__dot create-ticket-priority__dot--${item.label.toLowerCase()}`}
                  />
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <footer>
            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
            <Button type="submit">Create ticket</Button>
          </footer>
        </form>

        <aside className="create-ticket-help">
          <span>BEFORE YOU SUBMIT</span>
          <h2>Help us solve it faster</h2>
          {[
            ['Be specific', 'Use a clear subject that describes the problem.'],
            ['Add context', 'Explain what changed and who is affected.'],
            ['Choose priority', 'Use High only when work is blocked.'],
          ].map(([title, copy], index) => (
            <div className="create-ticket-help__tip" key={title}>
              <b>{index + 1}</b>
              <p>
                <strong>{title}</strong>
                <small>{copy}</small>
              </p>
            </div>
          ))}
          <h3>What happens next?</h3>
          {[
            'Open — Your request joins the queue.',
            'In progress — An agent takes ownership.',
            'Resolved — You review the proposed solution.',
          ].map((step, index) => (
            <p className="create-ticket-help__step" key={step}>
              <b>{index + 1}</b>
              {step}
            </p>
          ))}
        </aside>
      </div>
    </div>
  );
}
