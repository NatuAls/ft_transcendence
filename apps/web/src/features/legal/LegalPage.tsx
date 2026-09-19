import { BrandMark } from 'ui';
import './legal.css';

// Legal content. Written against what the application really does (Prisma
// schema, GDPR module, backups, infrastructure) so that the pages are
// adequate, not placeholders: the subject rejects projects with inadequate
// Privacy Policy / Terms of Service pages. Items marked [TEAM] need a real
// value before the defense.
const LAST_UPDATED = '17 September 2026';
const CONTACT = 'privacy@helpdesklite.me'; // [TEAM] real mailbox

const content = {
  privacy: {
    label: 'Privacy Policy',
    intro:
      'HelpDesk Lite is a help-desk application developed as an academic project at 42 Barcelona. This policy explains which personal data the application processes, why, for how long, and which rights you have over it. It applies to helpdesklite.me and its API.',
    sections: [
      [
        'Who is responsible',
        `The HelpDesk Lite student team acts as data controller for this deployment. Contact: ${CONTACT}.`,
      ],
      [
        'What data we collect',
        [
          'Account: e-mail address, username, password (stored only as an Argon2id hash with a server-side pepper, never in clear), e-mail verification status and preferred language.',
          'Profile: first and last name and an optional avatar, re-encoded to WebP 512×512 with EXIF metadata removed.',
          'Help-desk content: tickets, comments, internal notes written by agents, attachments you upload (with a SHA-256 checksum) and ticket history.',
          'Organization membership: the organizations you belong to and your role in each.',
          'Social features: friend requests, direct messages and online presence.',
          'Security and audit logs: IP address (last octet truncated in the centralized logs) and browser user-agent of security-relevant actions such as login, role changes, API keys and data requests; session identifiers and the failed-login counter.',
          'Notifications: in-app notifications and your notification preferences.',
        ],
      ],
      [
        'Why we process it',
        [
          'Performance of the service (Art. 6(1)(b) GDPR): account, profile, tickets, comments, attachments, organizations, notifications and messages.',
          'Legitimate interest in security (Art. 6(1)(f)): audit logs, session records, rate limiting, brute-force protection and backups.',
          'Legal obligation (Art. 6(1)(c)): answering data subject requests and keeping proof of them.',
          'We do not use your data for advertising and we do not sell it.',
        ],
      ],
      [
        'Cookies and local storage',
        'The application uses a single strictly necessary cookie, hd_refresh (HttpOnly, Secure, SameSite), to keep your session alive, plus a hint cookie without any token in it. The short-lived access token is kept in memory in your browser. No analytics or advertising cookies are set by us.',
      ],
      [
        'Who can see your data',
        [
          'Agents and administrators of the organizations you belong to can read the tickets and comments of that organization. Members of other organizations cannot: tenant isolation is enforced server-side.',
          'Platform administrators of this deployment can access account and audit data for support and security purposes.',
          'Infrastructure providers: Oracle Cloud (hosting, EU, Frankfurt) and Cloudflare (DNS, TLS and web application firewall). Backups are encrypted with AES-256 before being stored in Oracle Object Storage.',
          'We do not transfer your data outside the European Economic Area.',
        ],
      ],
      [
        'How long we keep it',
        [
          'Account and help-desk content: while your account exists. When you delete your account, personal data is removed and your comments are anonymized.',
          'Sessions: until they expire (7 days) or you revoke them.',
          'Audit logs: 12 months. [TEAM] confirm.',
          'Centralized application logs: 30 days.',
          'Encrypted backups: 14 days locally and in the off-site bucket, so a deleted account may persist in a backup for up to 14 days.',
        ],
      ],
      [
        'Your rights',
        [
          'Access and portability: request an export of your data from Privacy & data settings. You receive a ZIP with a machine-readable data.json after confirming the request by e-mail.',
          'Rectification: edit your profile at any time.',
          'Erasure: delete your account from Privacy & data settings. Deletion requires a double confirmation: a link sent to your e-mail and typing your username.',
          `For anything else, or to complain, write to ${CONTACT}. You also have the right to lodge a complaint with the Spanish supervisory authority (AEPD, aepd.es).`,
        ],
      ],
      [
        'Security',
        'Passwords are hashed with Argon2id; all traffic is served over HTTPS; uploads are validated by content type, not file extension; access is rate-limited; and every sensitive action is recorded in an audit log that never contains credentials.',
      ],
      [
        'Changes',
        'We will update this page when the processing changes and keep the "last updated" date current.',
      ],
    ],
  },
  terms: {
    label: 'Terms of Service',
    intro:
      'These terms govern the use of HelpDesk Lite, an academic help-desk application developed at 42 Barcelona. By creating an account you accept them. If you do not agree, do not use the service.',
    sections: [
      [
        'The service',
        'HelpDesk Lite lets organizations receive, assign and resolve support tickets, with comments, attachments, notifications, real-time updates, direct messages between users and a public API for integrations. It is provided as an educational project, free of charge, without any service-level commitment.',
      ],
      [
        'Your account',
        [
          'You must provide a valid e-mail address and verify it.',
          'You are responsible for keeping your password secret and for every action performed with your account. You can review and revoke your active sessions at any time.',
          'One person, one account. Accounts may be suspended by a platform administrator in case of abuse.',
        ],
      ],
      [
        'Organizations and roles',
        'An organization administrator can invite and remove members and assign the roles member, agent and organization admin. Agents can see the tickets of their organization and write internal notes that members do not see. An organization can never be left without an administrator.',
      ],
      [
        'Acceptable use',
        [
          'Do not upload malware, or content that is illegal, abusive or that you have no right to share.',
          "Do not try to access other organizations' data or other users' accounts.",
          'Do not circumvent rate limits, probe the infrastructure or disrupt the service.',
          'Do not use the public API beyond the quotas of your API key (60 requests per minute, 1 000 per hour).',
        ],
      ],
      [
        'Content',
        'You keep the rights over the content you post. You grant the organization that receives your ticket the permission to store and process it in order to handle your request. Attachments are limited in size and number per ticket and are checked by content type.',
      ],
      [
        'Public API',
        'API keys are issued by organization administrators, shown once, and can be revoked at any time. Requests made with a key are attributed to the organization that owns it.',
      ],
      [
        'Availability and changes',
        'The service may be interrupted for maintenance or for the needs of the academic project. We may change or discontinue features. Backups are taken daily, but you should keep your own copy of anything important.',
      ],
      [
        'Termination',
        'You can delete your account at any time from the privacy settings. We may suspend accounts that violate these terms.',
      ],
      [
        'Liability',
        'The service is provided "as is", without warranties. To the extent permitted by law, the team is not liable for damages arising from its use. Nothing in these terms limits your rights as a consumer or data subject.',
      ],
      [
        'Applicable law and contact',
        `These terms are governed by Spanish law. Questions: ${CONTACT}. Personal data is handled as described in the Privacy Policy.`,
      ],
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
          <span>LEGAL · LAST UPDATED {LAST_UPDATED.toUpperCase()}</span>
          <h1>{page.label}</h1>
          <p>{page.intro}</p>
          {page.sections.map(([title, copy], i) => (
            <section id={`legal-${title.replaceAll(' ', '-')}`} key={title}>
              <h2>
                {i + 1}. {title}
              </h2>
              {typeof copy === 'string' ? (
                <p>{copy}</p>
              ) : (
                <ul>
                  {copy.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
