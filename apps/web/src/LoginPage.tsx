import './LoginPage.css';
// Añadido: conexión del formulario con el cliente de autenticación del backend.
import { login, saveAccessToken } from './api/auth';
import { useState } from 'react';

export default function LoginPage() {
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
      {/* Cambio: se sustituyen las clases Tailwind por las clases definidas en LoginPage.css. */}
      
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
        <div className="form-card">
          
          {/* Encabezado del Formulario */}
          <div className="form-header">
            <span className="form-eyebrow">
              Welcome back
            </span>
            <h2>
              Sign in to your workspace
            </h2>
            <p>
              Use the credentials provided by your organization.
            </p>
          </div>

          {/* Formulario */}
          {/* Añadido: el submit ahora ejecuta la llamada real al backend. */}
          <form onSubmit={handleSubmit}>
            
            {/* Campo Email */}
            <div className="input-group">
              <label>Email address</label>
              <input
                type="email" 
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                required
                className="input-field"
              />
            </div>

            {/* Campo Password */}
            <div className="input-group">
              <label>Password</label>
              <input
                type="password" 
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="input-field"
              />
            </div>

            {/* Checkbox "Keep me signed in" */}
            <label className="checkbox-container">
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
              className="submit-btn"
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
            <a href="#register">
              Create an account
            </a>
          </div>

          {/* Términos y Privacidad */}
          <div className="legal-footer">
            <p>
              {/* Cambio: los enlaces legales ahora usan el selector .legal-footer de LoginPage.css. */}
              <a href="#terms">Terms of Service</a> · <a href="#privacy">Privacy Policy</a>
            </p>
          </div>

        </div>
      </main>

    </div>
  );
}
