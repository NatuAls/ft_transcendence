import { useState, type FormEvent } from 'react';
import { Button, Checkbox, TextField } from 'ui';
import { AuthBrandPanel, BrandHeader } from './AuthBrand';
import './auth.css';

export interface RegisterValues {
  fullName: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}

interface RegisterPageProps {
  onSignIn: () => void;
  onSubmit: (values: RegisterValues) => void | Promise<void>;
}

export function RegisterPage({ onSignIn, onSubmit }: RegisterPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({ fullName, email, password, acceptedTerms });
  }

  return (
    <main className="auth-page auth-page--register">
      <AuthBrandPanel
        tone="register"
        title={
          <>
            A calmer way to
            <br />
            ask for help.
          </>
        }
        description="Create an account to report issues, follow progress and stay connected with your organization."
        insight={
          <section
            className="auth-insight auth-insight--benefits"
            aria-labelledby="benefits-heading"
          >
            <h2 id="benefits-heading">Built for clarity</h2>
            <ul>
              <li>One request, one clear owner</li>
              <li>Visible status at every step</li>
              <li>Your data stays under your control</li>
            </ul>
          </section>
        }
      />

      <section className="auth-content auth-content--register">
        <div className="auth-mobile-header auth-mobile-header--register">
          <BrandHeader mark={false} />
        </div>
        <header className="auth-mobile-intro auth-mobile-intro--register">
          <h1>Create your account</h1>
          <p>Register to report issues and follow their resolution.</p>
        </header>

        <section
          className="auth-card auth-card--register"
          aria-labelledby="register-heading"
        >
          <header className="auth-card__intro">
            <p className="auth-eyebrow">Create your account</p>
            <h1 id="register-heading">Start with HelpDesk Lite</h1>
            <p>Your account starts as a standard user.</p>
          </header>

          <form
            className="auth-form auth-form--register"
            onSubmit={handleSubmit}
          >
            <TextField
              label="Full name"
              name="name"
              autoComplete="name"
              placeholder="Ana Ruiz"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
            <TextField
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ana@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <div className="auth-password-field">
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={10}
                required
              />
              <p>At least 10 characters</p>
            </div>
            <Checkbox
              className="auth-terms"
              label={
                <>
                  I accept the <a href="#terms">Terms of Service</a> and{' '}
                  <a href="#privacy-policy">Privacy Policy</a>
                </>
              }
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
            />
            <p className="auth-preview-note">
              Frontend preview: no account is created or persisted until the
              authentication API is connected.
            </p>
            <Button fullWidth type="submit">
              Create account
            </Button>
          </form>

          <div className="auth-switch auth-switch--register">
            <span>Already have an account?</span>
            <a
              href="#login"
              onClick={(event) => {
                event.preventDefault();
                onSignIn();
              }}
            >
              Sign in
            </a>
          </div>
        </section>

        <footer className="auth-legal auth-legal--register">
          <p>Secure access · Privacy-first</p>
        </footer>
      </section>
    </main>
  );
}
