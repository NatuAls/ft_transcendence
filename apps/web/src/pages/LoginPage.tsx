import '../styles/pages/login.css';
// Añadido: conexión del formulario con el cliente de autenticación del backend.
import { login, saveAccessToken } from '../api/auth';
import { useState } from 'react';

interface LoginPageProps {
  onCreateAccount: () => void;
}

export default function LoginPage({ onCreateAccount }: LoginPageProps) {
  // Añadido: estado controlado para enviar los valores reales escritos por el usuario.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Añadido: envía las credenciales al endpoint existente y guarda el access token.
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await login({ email, password });
      saveAccessToken(result.accessToken, keepSignedIn);
      setSuccess(`Bienvenido/a, ${result.user.username}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo iniciar sesión.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      {/* La página usa sus estilos propios en styles/pages/login.css. */}
      
      {/* ── PANEL IZQUIERDO (Brand & Insights) ── */}
      <aside className="brand-panel">
        
        {/* Cabecera / Marca */}
        <div className="brand-header">
          <div className="brand-logo">
            {/* Logo simplificado */}
            <div className="logo-mark">
              <div className="logo-line logo-line-long" />
              <div className="logo-line logo-line-short" />
            </div>
          </div>
          <span className="brand-title">HelpDesk Lite</span>
        </div>

        {/* Sección Hero / Textos principales */}
        <div className="brand-hero">
          <h1>
            Support work,<br />without the noise.
          </h1>
          <p>
            Track requests, collaborate clearly and keep every resolution in one dependable place.
          </p>

          {/* Tarjeta de Métricas */}
          <div className="insight-card">
            <span className="insight-eyebrow">
              Today at a glance
            </span>
            <div className="metrics-row">
              <div>
                <div className="metric-value">92%</div>
                <div className="metric-label">tickets resolved</div>
              </div>
              <div className="metrics-divider" />
              <div>
                <div className="metric-value">18 min</div>
                <div className="metric-label">average first response</div>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de página */}
        <footer className="brand-footer">
          Privacy-first · Accessible · Designed for focus
        </footer>
      </aside>

      {/* ── PANEL DERECHO (Formulario de Acceso) ── */}
      <main className="form-wrapper">
        <div className="form-card desktop-7d6ddbfbab56">
          
          {/* Encabezado del Formulario */}
          <div className="form-header">
            <span className="form-eyebrow desktop-7d6ddc04ff70">
              Welcome back
            </span>
            <h2 className="desktop-7d6ddc10ecf4">
              Sign in to your workspace
            </h2>
            <p className="desktop-7d6ddc1ce710">
              Use the credentials provided by your organization.
            </p>
          </div>

          {/* Formulario */}
          {/* Añadido: el submit ahora ejecuta la llamada real al backend. */}
          <form onSubmit={handleSubmit}>
            
            {/* Campo Email */}
            <div className="input-group">
              <label className="desktop-7d6ddc28da24">Email address</label>
              <input
                type="email" 
                className="input-field desktop-7d6ddc33afc6"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>

            {/* Campo Password */}
            <div className="input-group">
              <label className="desktop-7d6ddc4c5d91">Password</label>
              <input
                type="password" 
                className="input-field desktop-7d6ddc5c36e6"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {/* Checkbox "Keep me signed in" */}
            <label className="checkbox-container desktop-7d6ddc9f9590">
                {/* Añadido: controla si el token se conserva en localStorage o sessionStorage. */}
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(event) => setKeepSignedIn(event.target.checked)}
                />
                <span>Keep me signed in on this device</span>
              </label>

            {/* Botón Submit */}
            <button
              type="submit"
              className="submit-btn desktop-7d6ddcab14fd"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Añadido: mensajes de respuesta del backend para el usuario. */}
          {error && <p role="alert">{error}</p>}
          {success && <p role="status">{success}</p>}

          {/* Enlace de Registro / Cambio */}
          <div className="form-footer-links">
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

          {/* Términos y Privacidad */}
          <div className="legal-footer">
            <p>
              {/* Los enlaces legales usan el selector .legal-footer de esta página. */}
              <a href="#terms">Terms of Service</a> · <a href="#privacy">Privacy Policy</a>
            </p>
          </div>

        </div>
      </main>

    </div>
  );
}
