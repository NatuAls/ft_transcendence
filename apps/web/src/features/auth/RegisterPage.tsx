import { useState } from 'react';
import { registerSchema } from 'contracts';
import { Alert, Button, Checkbox, TextField } from 'ui';
import { AuthBrandPanel, BrandHeader } from './AuthBrand';
import { register, type AuthResponse } from '../../api/auth';

export interface RegisterValues {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  error: string | null;
  locale: 'EN' | 'ES' | 'AR';
}

interface RegisterPageProps {
  onSignIn: () => void;
  onSubmit: (user: AuthResponse['user']) => void | Promise<void>;
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

  const isPasswordValid =
    hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSymbol;

  const matchError =
    confirmPassword.length > 0 && password !== confirmPassword
      ? "The passwords don't match."
      : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }

    // Detect the browser language, then validate it with the shared contract.
    let browserLocale = navigator.language
      ? navigator.language.split('-')[0].toUpperCase()
      : 'EN';
    if (
      browserLocale !== 'EN' &&
      browserLocale !== 'ES' &&
      browserLocale !== 'AR'
    ) {
      browserLocale = 'EN';
    }

    const parsed = registerSchema.safeParse({
      email,
      username,
      password,
      confirmPassword,
      firstName,
      lastName,
      acceptTerms: acceptedTerms,
      locale: browserLocale,
    });
    if (!parsed.success) {
      setError('Please check the form fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const authData = await register(parsed.data);

      // El token ya se guardó en auth.ts. Pasamos el usuario al componente padre (ej. para redirigir)
      void onSubmit(authData.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value);
      if (error) setError(null);
    };
  };

  return (
    <main className="min-h-screen bg-canvas text-ink min-[1100px]:grid min-[1100px]:grid-cols-[580px_minmax(0,1fr)]">
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
            className="mt-36 max-w-[452px] rounded-lg bg-[#365e62] p-6"
            aria-labelledby="benefits-heading"
          >
            <h2
              className="mb-[21px] text-xs2 font-medium text-[#bfd8cf] uppercase"
              id="benefits-heading"
            >
              Built for clarity
            </h2>
            <ul className="grid list-none gap-[15px] p-0 text-[0.8125rem] text-[#f7faf8] [&_li]:flex [&_li]:items-center [&_li]:gap-3 [&_li]:before:grid [&_li]:before:size-5 [&_li]:before:shrink-0 [&_li]:before:place-items-center [&_li]:before:rounded-full [&_li]:before:bg-[#bfd8cf] [&_li]:before:text-xs2 [&_li]:before:font-medium [&_li]:before:text-[#183039] [&_li]:before:content-['✓']">
              <li>One request, one clear owner</li>
              <li>Visible status at every step</li>
              <li>Your data stays under your control</li>
            </ul>
          </section>
        }
      />

      <section className="flex min-h-screen min-w-0 flex-col px-4 pt-6 pb-10 md:items-center md:justify-center md:p-12">
        <div className="md:hidden">
          <BrandHeader />
        </div>
        <header className="mx-4 mt-[39px] mb-[22px] md:hidden">
          <h1 className="text-[1.75rem] leading-[1.2] font-medium">
            Create your account
          </h1>
          <p className="mt-2.5 text-[0.8125rem] leading-[1.45] text-muted">
            Register to report issues and follow their resolution.
          </p>
        </header>

        <section
          className="auth-card-enter w-full px-4 md:max-w-[520px] md:rounded-lg md:border md:border-border md:bg-surface md:px-[51px] md:pt-[46px] md:pb-[52px]"
          aria-labelledby="register-heading"
        >
          <header className="mb-8 hidden md:block">
            <p className="mb-[17px] text-xs2 font-medium tracking-[.01em] text-primary uppercase">
              Create your account
            </p>
            <h1
              className="text-[1.75rem] leading-[1.2] font-medium"
              id="register-heading"
            >
              Start with HelpDesk Lite
            </h1>
            <p className="mt-2.5 text-[0.8125rem] leading-[1.45] text-muted">
              Your account starts as a standard user.
            </p>
          </header>

          <form
            className="grid gap-4 [&_.ui-field__label]:text-muted md:[&_.ui-field__label]:text-ink [&_.ui-field__input]:h-12 [&_.ui-field__input]:border-transparent [&_.ui-field__input]:bg-white md:[&_.ui-field__input]:h-[52px] md:[&_.ui-field__input]:border-border md:[&_.ui-field__input]:bg-[#f7faf8]"
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
            <div>
              <TextField
                label="Username"
                name="user"
                autoComplete="username"
                placeholder="aruiz"
                value={username}
                onChange={handleChange(setUsername)}
                required
              />
              <p className="mt-[5px] text-xs2 leading-[1.4] text-muted">
                Choose carefully: your username cannot be changed later.
              </p>
            </div>
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
            <div>
              <div className="relative">
                <TextField
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={handleChange(setPassword)}
                  minLength={10}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 bottom-0 flex h-12 items-center border-0 bg-transparent px-1 text-xs2 font-medium text-muted hover:text-primary hover:underline md:h-[52px] md:text-xs"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1} // Evita que el usuario caiga aquí accidentalmente al usar la tecla Tab
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <ul className="mt-2 grid list-none gap-1 p-0 text-xs2">
                <li
                  className={`flex items-center gap-1.5 ${hasMinLength ? 'font-bold text-success' : 'text-muted'}`}
                >
                  {hasMinLength ? '✓' : '•'} At least 10 characters
                </li>
                <li
                  className={`flex items-center gap-1.5 ${hasUpperCase ? 'font-bold text-success' : 'text-muted'}`}
                >
                  {hasUpperCase ? '✓' : '•'} One uppercase letter
                </li>
                <li
                  className={`flex items-center gap-1.5 ${hasLowerCase ? 'font-bold text-success' : 'text-muted'}`}
                >
                  {hasLowerCase ? '✓' : '•'} One lowercase letter
                </li>
                <li
                  className={`flex items-center gap-1.5 ${hasNumber ? 'font-bold text-success' : 'text-muted'}`}
                >
                  {hasNumber ? '✓' : '•'} One number
                </li>
                <li
                  className={`flex items-center gap-1.5 ${hasSymbol ? 'font-bold text-success' : 'text-muted'}`}
                >
                  {hasSymbol ? '✓' : '•'} One special character
                </li>
              </ul>
            </div>
            <div>
              <div className="relative">
                <TextField
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  value={confirmPassword}
                  onChange={handleChange(setConfirmPassword)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 bottom-0 flex h-12 items-center border-0 bg-transparent px-1 text-xs2 font-medium text-muted hover:text-primary hover:underline md:h-[52px] md:text-xs"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1} // Evita que el usuario caiga aquí accidentalmente al usar la tecla Tab
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {matchError && (
                <p className="mt-1 text-xs2 text-danger">✗ {matchError}</p>
              )}
            </div>
            <Checkbox
              className="items-start text-xs leading-[1.65] text-ink md:items-center md:text-[0.8125rem] md:text-muted [&_a]:text-inherit"
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
            {error && <Alert tone="danger">{error}</Alert>}
            <Button
              className="!min-h-12"
              fullWidth
              type="submit"
              disabled={
                !!error ||
                !isPasswordValid ||
                !!matchError ||
                !confirmPassword.length ||
                isSubmitting
              }
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 flex justify-between gap-3 text-[0.8125rem] text-muted md:mt-[31px] md:justify-center [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline">
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

        <footer className="mx-4 mt-[49px] text-left text-xs text-muted md:hidden">
          <p>Secure access · Privacy-first</p>
        </footer>
      </section>
    </main>
  );
}
