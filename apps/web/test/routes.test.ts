import { describe, expect, it } from 'vitest';
import {
  buildHash,
  getAccountView,
  getActiveSection,
  publicRoutes,
  readLocation,
  returnRoute,
} from '../src/app/routes';

const at = (hash: string) => {
  window.history.replaceState(null, '', hash);
  return readLocation();
};

describe('routes', () => {
  it('reads the route and its parameters from the hash', () => {
    const location = at('#verify-email?token=abc123');
    expect(location.route).toBe('verify-email');
    expect(location.params.get('token')).toBe('abc123');
    expect(at('#account/sessions').route).toBe('account/sessions');
    expect(at('#platform-roles').route).toBe('platform-roles');
    expect(at('#organization-roles').route).toBe('organization-roles');
  });

  it('opens the sign-in without a hash and a not-found page for anything unknown', () => {
    expect(at('/').route).toBe('login');
    expect(at('#definitely-not-a-route').route).toBe('not-found');
    expect(at('#account/../admin').route).toBe('not-found');
  });

  it('builds hashes that leave out empty parameters and encode the rest', () => {
    expect(buildHash('register', { email: 'new+hire@example.com' })).toBe(
      '#register?email=new%2Bhire%40example.com',
    );
    expect(buildHash('terms', { from: undefined })).toBe('#terms');
    expect(buildHash('privacy-policy', { from: 'account/sessions' })).toBe(
      '#privacy-policy?from=account%2Fsessions',
    );
  });

  it('only lets a legal page go back to a known workspace route', () => {
    expect(returnRoute('organization-roles')).toBe('organization-roles');
    expect(returnRoute('account/sessions')).toBe('account/sessions');
    // Values from the URL that must not decide where the app navigates.
    for (const value of [
      null,
      '',
      'login',
      'verify-email',
      'https://evil.example',
      'javascript:alert(1)',
    ])
      expect(returnRoute(value)).toBeUndefined();
  });

  it('keeps the pages that need no session public, and nothing else', () => {
    expect([...publicRoutes].sort()).toEqual([
      'forgot-password',
      'login',
      'privacy-policy',
      'register',
      // Las dos de recuperación son públicas por obligación: quien llega es
      // justamente quien no puede entrar, y el testigo del correo es la
      // prueba que sustituye a la sesión.
      'reset-password',
      'terms',
      'verify-email',
    ]);
  });

  it('highlights the right section and account view', () => {
    expect(getActiveSection('platform-roles')).toBe('platform-roles');
    expect(getActiveSection('organization-roles')).toBe('organization-roles');
    expect(getActiveSection('people-profile')).toBe('people');
    expect(getActiveSection('account/sessions')).toBe('account');
    expect(getAccountView('account/sessions')).toBe('sessions');
    expect(getAccountView('account')).toBe('home');
  });
});
