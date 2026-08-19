import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicketSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  searchTicketsQuerySchema,
} from 'contracts';

/** The schemas that run on BOTH sides. If these drift, both ends drift together. */
describe('shared contracts', () => {
  it('enforces the password policy', () => {
    assert.strictEqual(
      passwordSchema.safeParse('Str0ng!Passw0rd').success,
      true,
    );
    for (const weak of [
      'short1!A',
      'alllowercase1!',
      'ALLUPPERCASE1!',
      'NoDigitsHere!',
      'NoSymbols123',
    ]) {
      assert.strictEqual(passwordSchema.safeParse(weak).success, false);
    }
  });

  it('normalises email to lowercase and trims it', () => {
    const parsed = loginSchema.parse({
      email: '  Felipe@Example.COM ',
      password: 'x',
    });
    assert.strictEqual(parsed.email, 'felipe@example.com');
  });

  it('rejects a registration whose passwords do not match', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      username: 'felipe',
      password: 'Str0ng!Passw0rd',
      confirmPassword: 'Different1!',
      firstName: 'F',
      lastName: 'C',
      acceptTerms: true,
    });
    assert.strictEqual(result.success, false);
  });

  it('rejects a registration that did not accept the terms', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      username: 'felipe',
      password: 'Str0ng!Passw0rd',
      confirmPassword: 'Str0ng!Passw0rd',
      firstName: 'F',
      lastName: 'C',
      acceptTerms: false,
    });
    assert.strictEqual(result.success, false);
  });

  it('bounds ticket title and description', () => {
    const base = {
      organizationId: '018f0000-0000-7000-8000-000000000000',
      description: 'x'.repeat(20),
    };
    assert.strictEqual(
      createTicketSchema.safeParse({ ...base, title: 'four' }).success,
      false,
    );
    assert.strictEqual(
      createTicketSchema.safeParse({ ...base, title: 'x'.repeat(161) }).success,
      false,
    );
    assert.strictEqual(
      createTicketSchema.safeParse({ ...base, title: 'A valid subject' })
        .success,
      true,
    );
  });

  it('caps page size so no caller can ask for an unbounded page', () => {
    assert.strictEqual(
      searchTicketsQuerySchema.safeParse({ take: '500' }).success,
      false,
    );
    const parsed = searchTicketsQuerySchema.parse({
      take: '50',
      status: 'OPEN,CLOSED',
    });
    assert.strictEqual(parsed.take, 50);
    assert.deepStrictEqual(parsed.status, ['OPEN', 'CLOSED']);
  });

  it('refuses an unknown status in the csv filter', () => {
    assert.strictEqual(
      searchTicketsQuerySchema.safeParse({ status: 'OPEN,NOPE' }).success,
      false,
    );
  });
});
