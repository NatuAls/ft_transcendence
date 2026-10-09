import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearAccessToken } from '../src/api/auth';
import { initI18n } from '../src/core/i18n';

beforeAll(async () => {
  await initI18n();
});

// No test leaks a rendered screen, a token or a session cookie into the next.
afterEach(() => {
  cleanup();
  clearAccessToken();
  document.cookie = 'hd_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  window.history.replaceState(null, '', '/');
});
