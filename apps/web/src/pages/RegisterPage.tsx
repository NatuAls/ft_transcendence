import { type FormEvent, useState } from 'react';
import '../styles/pages/register.css';

interface RegisterPageProps {
  onSignIn: () => void;
}

/**
 * Adapta el HTML exportado de Penpot a JSX semántico.
 * Los div vacíos del export eran fondos decorativos; aquí son layout,
 * labels e inputs reales para que la pantalla sea utilizable.
 */
export default function RegisterPage({ onSignIn }: RegisterPageProps) {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="register-page">
      <aside className="register-brand-panel">
        <div className="brand-header">
          <div className="brand-logo"><div className="logo-mark" /></div>
          <span className="brand-title">HelpDesk Lite</span>
        </div>
        <div className="register-brand-hero">
          <h1>A calmer way to<br />ask for help.</h1>
          <p>Create an account to report issues, follow progress and stay connected with your organization.</p>
          <div className="register-insight-card">
            <span className="insight-eyebrow">Built for clarity</span>
            <ul>
              <li>One request, one clear owner</li>
              <li>Visible status at every step</li>
              <li>Your data stays under your control</li>
            </ul>
          </div>
        </div>
        <footer>Privacy-first · Accessible · Designed for focus</footer>
      </aside>

      <main className="register-form-wrapper">
        <section className="register-form-card">
          <header className="form-header">
            <span className="form-eyebrow">Create your account</span>
            <h2>Start with HelpDesk Lite</h2>
            <p>Your account starts as a standard user.</p>
          </header>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="register-name">Full name</label>
              <input id="register-name" className="input-field" type="text" placeholder="Ana Ruiz" required />
            </div>
            <div className="input-group">
              <label htmlFor="register-email">Email address</label>
              <input id="register-email" className="input-field" type="email" placeholder="ana@company.com" required />
            </div>
            <div className="input-group register-password-group">
              <label htmlFor="register-password">Password</label>
              <input id="register-password" className="input-field" type="password" minLength={10} required />
              <small>At least 10 characters</small>
            </div>
            <label className="checkbox-container">
              <input type="checkbox" required />
              <span>I accept the Terms of Service and Privacy Policy</span>
            </label>
            <button className="submit-btn" type="submit">Create account</button>
          </form>

          {submitted && <p className="register-message" role="status">Account creation is ready to connect to the API.</p>}

          <div className="form-footer-links">
            <span>Already have an account?</span>
            <a href="#login" onClick={(event) => { event.preventDefault(); onSignIn(); }}>Sign in</a>
          </div>
        </section>
      </main>
    </div>
  );
}
