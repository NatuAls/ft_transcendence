/**
 * The primary administrator is created at deploy time from secrets, so the
 * parts of it that a test can reach without a database are exactly the parts
 * that would fail silently in production:
 *
 *   · its e-mail is derived, and login validates e-mails with `emailSchema` -
 *     a derived address that does not pass that check would produce an account
 *     nobody can log into.
 *   · the account is protected by comparing usernames, so that comparison must
 *     not be fooled by case and must not catch anybody else.
 *
 * Creating the account itself is exercised by starting the API with the
 * variables set; see the DevOps guide.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env['NODE_ENV'] ??= 'test';
process.env['DATABASE_URL'] ??=
  'postgresql://u:p@localhost:5432/d?schema=public';
process.env['JWT_ACCESS_SECRET'] ??=
  'test_access_secret_not_a_real_secret_0123456789';
process.env['JWT_REFRESH_SECRET'] ??=
  'test_refresh_secret_not_a_real_secret_0123456789';
process.env['PASSWORD_PEPPER'] ??= 'test_pepper_not_a_real_secret_0123456789';
process.env['CORS_ORIGINS'] ??= 'http://localhost:5173';
process.env['LOG_LEVEL'] ??= 'error';
process.env['BOOTSTRAP_ADMIN_USERNAME'] ??= 'Zurcal-Op7';

const { primaryAdminEmail, isPrimaryAdminUsername } =
  await import('../../src/modules/admin/bootstrap-admin.ts');
const { emailSchema, usernameSchema, passwordSchema } =
  await import('contracts');

describe('primary administrator · derived e-mail', () => {
  it('is a valid address for the login endpoint', () => {
    for (const username of ['zurcal-op7', 'a_b-c', 'x'.repeat(32)]) {
      const email = primaryAdminEmail(username);
      assert.equal(
        emailSchema.safeParse(email).success,
        true,
        `login would reject ${email}`,
      );
    }
  });

  it('cannot be delivered anywhere, on purpose', () => {
    // RFC 2606 reserves `.invalid`: no verification mail, no password reset
    // and no future notification can leave the building through this address.
    assert.match(primaryAdminEmail('zurcal-op7'), /@[a-z0-9.-]+\.invalid$/);
  });

  it('never collides with the address of a person', () => {
    // Anybody who registers goes through `emailSchema` with a real domain;
    // two different usernames also give two different addresses.
    assert.notEqual(primaryAdminEmail('one'), primaryAdminEmail('two'));
  });
});

describe('primary administrator · protection', () => {
  it('recognises the configured account whatever the case', () => {
    for (const username of ['zurcal-op7', 'Zurcal-Op7', 'ZURCAL-OP7']) {
      assert.equal(isPrimaryAdminUsername(username), true, username);
    }
  });

  it('does not catch anybody else', () => {
    for (const username of [
      'admin',
      'zurcal-op',
      'zurcal-op77',
      'xzurcal-op7',
      '',
    ]) {
      assert.equal(isPrimaryAdminUsername(username), false, username);
    }
  });
});

describe('primary administrator · the secrets it accepts', () => {
  /**
   * The module refuses a username or a password that the application itself
   * would not accept: otherwise the deploy would hand us an administrator who
   * cannot change their own password from the interface.
   */
  it('demands a username the interface would also accept', () => {
    assert.equal(usernameSchema.safeParse('Zurcal-Op7').success, true);
    for (const bad of ['ab', 'with space', 'tilde-ñ', 'x'.repeat(33)]) {
      assert.equal(usernameSchema.safeParse(bad).success, false, bad);
    }
  });

  it('demands a password that meets the published policy', () => {
    assert.equal(passwordSchema.safeParse('Cv7!nube-larga').success, true);
    for (const bad of [
      'short1!A',
      'nouppercase1!',
      'NOLOWERCASE1!',
      'NoSymbol1',
    ]) {
      assert.equal(passwordSchema.safeParse(bad).success, false, bad);
    }
  });
});
