import { describe, expect, it } from 'vitest';
import {
  evaluatePolicy,
  POLICIES,
  type PolicyId,
} from '../../api/src/rbac/policies.ts';
import {
  permissionsForOrganizationRole,
  scopeViewerToOrganization,
  type Permission,
  type ViewerSession,
} from '../src/app/session';
import {
  organizationCapabilities,
  organizationRoles,
} from '../src/features/roles/rolesGateway';

/**
 * The web decides which controls to SHOW from its own per-role lists; the
 * API decides what is ALLOWED from its policy table. If they drift, a button
 * appears that the API refuses, or the "what each role can do" table on the
 * Roles & access screen tells people something false. Both are read here,
 * from their sources, and compared.
 */
const subject = (orgRole: 'MEMBER' | 'AGENT' | 'ORG_ADMIN') => ({
  userId: 'u',
  isGlobalAdmin: false,
  orgRole,
});

describe('web permissions and API policies', () => {
  const roles = organizationRoles.map((role) => role.value);

  it('never shows a control the API would refuse', () => {
    // Some rules depend on the record (whose ticket, who created the
    // organization, whether you are the last admin). A role "may" do those
    // when the record is favourable; the screen narrows them case by case.
    const favourable = {
      ownerId: 'u',
      isLastAdmin: false,
      status: 'OPEN' as const,
      createdAt: new Date(),
    };
    const overpromised: string[] = [];
    for (const role of roles)
      for (const permission of permissionsForOrganizationRole(role)) {
        if (!(permission in POLICIES)) continue;
        const decision = evaluatePolicy(
          permission as PolicyId,
          subject(role),
          favourable,
        );
        if (!decision.allowed) overpromised.push(`${role}: ${permission}`);
      }
    expect(overpromised).toEqual([]);
  });

  it('tells the truth in the "what each role can do" table', () => {
    const wrong: string[] = [];
    for (const { permission, label } of organizationCapabilities) {
      expect(permission in POLICIES, `${permission} is an API policy`).toBe(
        true,
      );
      for (const role of roles) {
        const shown = permissionsForOrganizationRole(role).includes(permission);
        const allowed = evaluatePolicy(
          permission as PolicyId,
          subject(role),
          {},
        ).allowed;
        if (shown !== allowed)
          wrong.push(`${label} / ${role}: table ${shown}, API ${allowed}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('gives each role strictly more than the one below it', () => {
    const [member, agent, admin] = roles.map(
      (role) => new Set(permissionsForOrganizationRole(role)),
    );
    for (const permission of member!) expect(agent!.has(permission)).toBe(true);
    for (const permission of agent!) expect(admin!.has(permission)).toBe(true);
    expect(agent!.size).toBeGreaterThan(member!.size);
    expect(admin!.size).toBeGreaterThan(agent!.size);
    // Only administrators manage people.
    expect(member!.has('member:invite') || agent!.has('member:invite')).toBe(
      false,
    );
    expect(admin!.has('member:invite')).toBe(true);
  });

  it('keeps deleting an organization for its creator or a platform administrator', () => {
    const decide = (resource: { ownerId?: string }, isGlobalAdmin = false) =>
      evaluatePolicy(
        'organization:delete',
        { userId: 'u', isGlobalAdmin, orgRole: 'ORG_ADMIN' },
        resource,
      ).allowed;
    expect(decide({ ownerId: 'u' })).toBe(true);
    expect(decide({ ownerId: 'someone-else' })).toBe(false);
    expect(decide({ ownerId: 'someone-else' }, true)).toBe(true);
  });
});

/**
 * Los permisos se recortan a la organización activa.
 *
 * `/auth/me` manda el rol más alto que la persona tiene en cualquiera de sus
 * organizaciones, y lo dice en su propio comentario: sirve para apagar
 * controles, no para decidir. Quien es ORG_ADMIN en una y MEMBER en otra
 * llegaría con permisos de administrador a las dos, y al cambiar de
 * organización seguiría viendo los botones de gestionar gente. Esto fija que
 * el recorte ocurre y que cambia con la organización.
 */
describe('permisos de la organización activa', () => {
  const VILANOVA = 'org-a';
  const CONSELL = 'org-b';

  function viewer(permissions: Permission[]): ViewerSession {
    return {
      accountState: 'ACTIVE',
      emailVerified: true,
      globalRole: 'USER',
      id: 'u',
      memberships: [
        {
          organizationDescription: '',
          organizationId: VILANOVA,
          organizationName: 'Vilanova',
          organizationSlug: 'vilanova',
          role: 'ORG_ADMIN',
        },
        {
          organizationDescription: '',
          organizationId: CONSELL,
          organizationName: 'Consell Comarcal',
          organizationSlug: 'consell',
          role: 'MEMBER',
        },
      ],
      pendingRoles: [],
      permissions,
      profile: {
        bio: '',
        email: 'a@b.test',
        firstName: 'A',
        fullName: 'A B',
        jobTitle: '',
        lastName: 'B',
        location: 'Europe/Madrid',
        username: 'ab',
      },
    };
  }

  // Lo que manda la API: el rol más alto entre las dos organizaciones.
  const session = viewer(permissionsForOrganizationRole('ORG_ADMIN'));

  it('da permisos de administrador sólo en la organización donde lo es', () => {
    expect(scopeViewerToOrganization(session, VILANOVA).permissions).toContain(
      'member:invite',
    );
    expect(
      scopeViewerToOrganization(session, CONSELL).permissions,
    ).not.toContain('member:invite');
  });

  it('cambia de permisos al cambiar de organización, no se queda con los anteriores', () => {
    const enVilanova = scopeViewerToOrganization(session, VILANOVA).permissions;
    const enConsell = scopeViewerToOrganization(session, CONSELL).permissions;
    expect(new Set(enVilanova)).not.toEqual(new Set(enConsell));
    expect([...enConsell].every((p) => enVilanova.includes(p))).toBe(true);
  });

  it('no deja ninguno en una organización a la que no se pertenece', () => {
    expect(scopeViewerToOrganization(session, 'org-ajena').permissions).toEqual(
      [],
    );
  });

  it('deja intacto al administrador de plataforma, que no se mide por organización', () => {
    const plataforma: ViewerSession = {
      ...session,
      globalRole: 'GLOBAL_ADMIN',
      memberships: [],
    };
    expect(scopeViewerToOrganization(plataforma, 'org-ajena')).toBe(plataforma);
  });
});
