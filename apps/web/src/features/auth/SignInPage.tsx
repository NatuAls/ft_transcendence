import { useState, type FormEvent } from 'react';
import { Button, Checkbox, TextField } from 'ui';
import { AuthBrandPanel, BrandHeader } from './AuthBrand';
import './auth.css';

export interface SignInValues {
  email: string;
  password: string;
  keepSignedIn: boolean;
}

interface SignInPageProps {
  onCreateAccount: () => void;
  onSubmit: (values: SignInValues) => void | Promise<void>;
}

export function SignInPage({ onCreateAccount, onSubmit }: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({ email, password, keepSignedIn });
  }

  return (
    <main className="auth-page">
      <AuthBrandPanel
        title={
          <>
            Support work,
            <br />
            without the noise.
          </>
        }
        description="Track requests, collaborate clearly and keep every resolution in one dependable place."
        insight={
          <section className="auth-insight" aria-labelledby="today-heading">
            <h2 id="today-heading">Today at a glance</h2>
            <div className="auth-insight__metrics">
              <p>
                <strong>92%</strong>
                <span>tickets resolved</span>
              </p>
              <p>
                <strong>18 min</strong>
                <span>average first response</span>
              </p>
            </div>
          </section>
        }
      />

      <section className="auth-content">
        <div className="auth-mobile-header">
          <BrandHeader />
        </div>

        <header className="auth-mobile-intro">
          <h1>Welcome back</h1>
          <p>Sign in to continue to your organization workspace.</p>
        </header>

        <section className="auth-card" aria-labelledby="sign-in-heading">
          <header className="auth-card__intro">
            <p className="auth-eyebrow">Welcome back</p>
            <h1 id="sign-in-heading">Sign in to your workspace</h1>
            <p>Use the credentials provided by your organization.</p>
          </header>

          <form className="auth-form" onSubmit={handleSubmit}>
            <TextField
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Checkbox
              label={
                <>
                  <span className="auth-remember__desktop">
                    Keep me signed in on this device
                  </span>
                  <span className="auth-remember__mobile">
                    Keep me signed in
                  </span>
                </>
              }
              checked={keepSignedIn}
              onChange={(event) => setKeepSignedIn(event.target.checked)}
            />
            <p className="auth-preview-note">
              Frontend preview: credentials are not sent or stored. Submitting
              opens the local sample workspace.
            </p>
            <Button fullWidth type="submit">
              Sign in
            </Button>
          </form>

          <div className="auth-switch">
            <span>New to HelpDesk Lite?</span>
            <a
              href="#register"
              onClick={(event) => {
                event.preventDefault();
                onCreateAccount();
              }}
            >
              Create an account
            </a>
          </div>
        </section>

        <footer className="auth-legal">
          <p>
            <a href="#terms">Terms of Service</a> ·{' '}
            <a href="#privacy-policy">Privacy Policy</a>
          </p>
          <p className="auth-legal__security">Secure access · Privacy-first</p>
        </footer>
      </section>
    </main>
  );
}
