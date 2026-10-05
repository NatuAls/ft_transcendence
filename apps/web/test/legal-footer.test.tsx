import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { AppFooter, LegalLinks } from '../src/layout/AppFooter';

/**
 * The subject requires the Privacy Policy and the Terms of Service to be
 * reachable from the application, and a missing link rejects the project.
 * These are the links on every signed-in screen and on the status page.
 */
describe('legal links', () => {
  it('are in the footer of every signed-in screen, and come back to it', () => {
    render(<AppFooter from="organization-roles" />);
    const nav = screen.getByRole('navigation', {
      name: 'Legal and service information',
    });
    expect(
      within(nav)
        .getByRole('link', { name: 'Privacy Policy' })
        .getAttribute('href'),
    ).toBe('#privacy-policy?from=organization-roles');
    expect(
      within(nav)
        .getByRole('link', { name: 'Terms of Service' })
        .getAttribute('href'),
    ).toBe('#terms?from=organization-roles');
    expect(
      within(nav)
        .getByRole('link', { name: 'Service status' })
        .getAttribute('href'),
    ).toBe('/status');
  });

  it('work without a return route as well', () => {
    render(<LegalLinks />);
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href'),
    ).toBe('#privacy-policy');
  });

  it('are on the public status page too', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public/status.html'),
      'utf8',
    );
    document.body.innerHTML = html.slice(
      html.indexOf('<body'),
      html.lastIndexOf('</body>') + 7,
    );
    const links = [...document.querySelectorAll('footer a')].map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual(
      expect.arrayContaining([
        ['Privacy Policy', '/#privacy-policy'],
        ['Terms of Service', '/#terms'],
      ]),
    );
  });
});
