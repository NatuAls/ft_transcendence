import { useState } from 'react';
import { loginSchema } from 'contracts';
import { Alert, Button, Checkbox, TextField } from 'ui';
import { AuthBrandPanel, BrandHeader } from './AuthBrand';
import { login, type AuthResponse } from '../../api/auth';

export interface SignInValues {
  email: string;
  password: string;
  keepSignedIn: boolean;
}

interface SignInPageProps {
  onCreateAccount: () => void;
  onOpenPreview?: () => void;
  onSubmit: (user: AuthResponse['user']) => void | Promise<void>;
}

export function SignInPage({
  onCreateAccount,
  onOpenPreview,
  onSubmit,
}: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value);
      if (error) setError(null);
    };
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Please check the form fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const authData = await login(parsed.data);

      // Si fue exitoso, pasamos el usuario al router/padre
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

  return (
    <main className="min-h-screen bg-canvas text-ink min-[1100px]:grid min-[1100px]:grid-cols-[580px_minmax(0,1fr)]">
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
          <section
            className="mt-36 max-w-[452px] rounded-lg bg-[#244148] p-6"
            aria-labelledby="benefits-heading"
          >
            <h2
              className="mb-[21px] text-xs2 font-medium text-[#bfd8cf] uppercase"
              id="benefits-heading"
            >
              Built for dependable support
            </h2>
            <ul className="grid list-none gap-[15px] p-0 text-[0.8125rem] text-[#f7faf8] [&_li]:flex [&_li]:items-center [&_li]:gap-3 [&_li]:before:grid [&_li]:before:size-5 [&_li]:before:shrink-0 [&_li]:before:place-items-center [&_li]:before:rounded-full [&_li]:before:bg-[#86afa4] [&_li]:before:text-xs2 [&_li]:before:font-medium [&_li]:before:text-[#183039] [&_li]:before:content-['✓']">
              <li>Clear ownership from request to resolution</li>
              <li>Shared context for requesters and agents</li>
              <li>A searchable record of every decision</li>
            </ul>
          </section>
        }
      />

      <section className="flex min-h-screen min-w-0 flex-col px-4 pt-6 pb-10 md:items-center md:justify-center md:p-12">
        <div className="md:hidden">
          <BrandHeader />
        </div>

        <header className="mx-2 mt-[55px] mb-[18px] md:hidden">
          <h1 className="text-[1.75rem] leading-[1.2] font-medium">
            Welcome back
          </h1>
          <p className="mt-2.5 text-[0.8125rem] leading-[1.45] text-muted">
            Sign in to continue to your organization workspace.
          </p>
        </header>

        <section
          className="auth-card-enter w-full rounded-lg border border-border bg-surface px-[23px] pt-[37px] pb-[72px] md:max-w-[520px] md:px-[51px] md:pt-[46px] md:pb-[118px]"
          aria-labelledby="sign-in-heading"
        >
          <header className="mb-8 hidden md:block">
            <p className="mb-[17px] text-xs2 font-medium tracking-[.01em] text-primary uppercase">
              Welcome back
            </p>
            <h1
              className="text-[1.75rem] leading-[1.2] font-medium"
              id="sign-in-heading"
            >
              Sign in to your workspace
            </h1>
            <p className="mt-2.5 text-[0.8125rem] leading-[1.45] text-muted">
              Use the credentials provided by your organization.
            </p>
          </header>

          <form className="grid gap-7 md:gap-5" onSubmit={handleSubmit}>
            <TextField
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
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
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={handleChange(setPassword)}
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
            </div>
            <Checkbox
              className="md:my-2"
              label={
                <>
                  <span className="hidden md:inline">
                    Keep me signed in on this device
                  </span>
                  <span className="md:hidden">Keep me signed in</span>
                </>
              }
              checked={keepSignedIn}
              onChange={(event) => setKeepSignedIn(event.target.checked)}
            />
            {error && <Alert tone="danger">{error}</Alert>}
            <Button
              className="!min-h-12"
              fullWidth
              type="submit"
              disabled={isSubmitting || !!error}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
            {onOpenPreview ? (
              <Button fullWidth onClick={onOpenPreview} variant="secondary">
                Open frontend preview
              </Button>
            ) : null}
          </form>

          <div className="mt-[26px] flex justify-center gap-3 border-t border-border pt-[29px] text-xs2 text-muted md:mt-[31px] md:border-0 md:pt-0 md:text-[0.8125rem] [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline">
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

        <footer className="mt-auto pt-[47px] text-center text-2xs text-muted md:mt-7 md:p-0 md:text-xs [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline">
          <p>
            <a href="#terms">Terms of Service</a> ·{' '}
            <a href="#privacy-policy">Privacy Policy</a>
          </p>
          <p className="mt-8 md:hidden">Secure access · Privacy-first</p>
        </footer>
      </section>
    </main>
  );
}
