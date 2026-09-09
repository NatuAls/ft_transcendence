import { BrandMark } from 'ui';
import './legal.css';

const content = {
  privacy: {
    label: 'Privacy Policy',
    intro:
      'This policy explains what personal data HelpDesk Lite stores, why it is needed and the choices available to every user.',
    sections: [
      [
        'Overview',
        'HelpDesk Lite processes only the information needed to operate accounts, organizations, tickets, connections and conversations.',
      ],
      [
        'Information we collect',
        'Account details, profile information, organization membership, ticket activity and messages are stored to provide the service.',
      ],
      [
        'How we use data',
        'Data is used to authenticate users, enforce permissions, manage support requests and maintain persistent conversations.',
      ],
      [
        'Data retention',
        'Personal data is retained only while it is needed to operate the account and service.',
      ],
      [
        'Your rights',
        'You can request a portable export of your personal data or initiate account deletion from Privacy & data settings.',
      ],
      ['Contact', 'Questions can be sent to privacy@helpdesk.local.'],
    ],
  },
  terms: {
    label: 'Terms of Service',
    intro:
      'These terms explain the rules for using HelpDesk Lite, the responsibilities of each account and when access may be limited.',
    sections: [
      [
        'Overview',
        'By using HelpDesk Lite, you agree to use the service for legitimate support work.',
      ],
      [
        'Accounts and acceptable use',
        'Keep your account information accurate and secure.',
      ],
      [
        'Organizations and permissions',
        'Organization owners manage membership, roles and ticket categories.',
      ],
      [
        'Suspension and termination',
        'Access may be suspended for misuse or security reasons.',
      ],
      [
        'Changes to these terms',
        'Material changes are published on this page with an updated revision date.',
      ],
      ['Contact', 'Questions can be sent to support@helpdesk.local.'],
    ],
  },
} as const;
export function LegalPage({
  kind,
  onBack,
  onNavigate,
  onSignIn,
}: {
  kind: 'privacy' | 'terms';
  onBack: () => void;
  onNavigate: (k: 'privacy' | 'terms') => void;
  onSignIn: () => void;
}) {
  const page = content[kind];
  return (
    <div className="legal-page">
      <header>
        <div>
          <BrandMark />
          <strong>HelpDesk Lite</strong>
        </div>
        <nav>
          <button onClick={() => onNavigate('privacy')} type="button">
            Privacy Policy
          </button>
          <button onClick={() => onNavigate('terms')} type="button">
            Terms of Service
          </button>
          <button onClick={onSignIn} type="button">
            Sign in
          </button>
        </nav>
      </header>
      <div>
        <aside>
          <button onClick={onBack} type="button">
            ← Back to HelpDesk Lite
          </button>
          <span>ON THIS PAGE</span>
          {page.sections.map(([title]) => (
            <button
              key={title}
              onClick={() =>
                document
                  .getElementById(`legal-${title.replaceAll(' ', '-')}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              type="button"
            >
              {title}
            </button>
          ))}
        </aside>
        <main>
          <span>LEGAL · LAST UPDATED 17 AUGUST 2026</span>
          <h1>{page.label}</h1>
          <p>{page.intro}</p>
          {page.sections.map(([title, copy], i) => (
            <section id={`legal-${title.replaceAll(' ', '-')}`} key={title}>
              <h2>
                {i + 1}. {title}
              </h2>
              <p>{copy}</p>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
