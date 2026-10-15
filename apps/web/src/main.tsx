// Primero: fija la configuración de zod antes de que se cree ningún esquema.
import './core/zod';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.tsx';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { initI18n } from './core/i18n';
import { applyTheme, followThemeOfOtherTabs } from './core/theme';

applyTheme('system');
followThemeOfOtherTabs();
await initI18n();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
