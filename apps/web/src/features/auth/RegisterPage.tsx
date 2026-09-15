import { useState } from 'react';
import { Button, Checkbox, TextField } from 'ui';
import { AuthBrandPanel, BrandHeader } from './AuthBrand';
import { register } from '../../api/auth';
import './auth.css';

export interface RegisterValues {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  error: string | null;
  locale: 'EN' | 'SP' | 'AR';
}

interface RegisterPageProps {
  onSignIn: () => void;
  onSubmit: (user: any) => void | Promise<void>;
}

export function RegisterPage({ onSignIn, onSubmit }: RegisterPageProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasMinLength = password.length >= 10;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[\W_]/.test(password);

  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSymbol;

  const matchError = confirmPassword.length > 0 && password !== confirmPassword 
    ? "The passwords don't match." 
    : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }

    // Detectamos el idioma del navegador para el campo locale
    let browserLocale = navigator.language ? navigator.language.split('-')[0].toUpperCase() : 'EN';
    if (browserLocale !== 'EN' && browserLocale !== 'SP' && browserLocale !== 'AR') {
      browserLocale = 'EN';
    }

    setIsSubmitting(true);

    try {
      const authData = await register({
        email,
        username,
        password,
        confirmPassword,
        firstName,
        lastName,
        acceptTerms: acceptedTerms,
        locale: browserLocale as 'EN' | 'SP' | 'AR',
      });

      // El token ya se guardó en auth.ts. Pasamos el usuario al componente padre (ej. para redirigir)
      void onSubmit(authData.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleChange = (setter: React.Dispatch<React.SetStateAction<any>>) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value);
      if (error) setError(null);
    };
  };

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
              label="First Name"
              name="FirstName"
              autoComplete="name"
              placeholder="Ana"
              value={firstName}
              onChange={handleChange(setFirstName)}
              required
            />
            <TextField
              label="Last Name"
              name="lastName"
              autoComplete="lastName"
              placeholder="Ruiz"
              value={lastName}
              onChange={handleChange(setLastName)}
              required
            />
            <TextField
              label="Username"
              name="user"
              autoComplete="username"
              placeholder="aruiz"
              value={username}
              onChange={handleChange(setUsername)}
              required
            />
            <TextField
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ana@company.com"
              value={email}
              onChange={handleChange(setEmail)}
              required
            />
            <div className="auth-password-field">
              <div className="auth-password-wrapper">
                <TextField
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={handleChange(setPassword)}
                  minLength={10}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1} // Evita que el usuario caiga aquí accidentalmente al usar la tecla Tab
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <ul className="auth-password-rules">
                <li className={hasMinLength ? 'valid' : ''}>
                  {hasMinLength ? '✓' : '•'} At least 10 characters
                </li>
                <li className={hasUpperCase ? 'valid' : ''}>
                  {hasUpperCase ? '✓' : '•'} One uppercase letter
                </li>
                <li className={hasLowerCase ? 'valid' : ''}>
                  {hasLowerCase ? '✓' : '•'} One lowercase letter
                </li>
                <li className={hasNumber ? 'valid' : ''}>
                  {hasNumber ? '✓' : '•'} One number
                </li>
                <li className={hasSymbol ? 'valid' : ''}>
                  {hasSymbol ? '✓' : '•'} One special character
                </li>
              </ul>
            </div>
            <div className="auth-password-field">
              <div className="auth-password-wrapper">
                <TextField
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  value={confirmPassword}
                  onChange={handleChange(setConfirmPassword)}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1} // Evita que el usuario caiga aquí accidentalmente al usar la tecla Tab
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {matchError && <p className='auth-password-match-error'>✗ {matchError}</p>}
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
            {error && <p className="auth-error-msg">{error}</p>}
            <Button fullWidth type="submit" disabled={!!error || !isPasswordValid || !!matchError || !confirmPassword.length || isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
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
