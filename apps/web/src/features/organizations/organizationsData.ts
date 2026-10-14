import type { OrgRole } from 'contracts';
import type { OrganizationRecord } from '../../api/organizations';
import type { ViewerSession } from '../../app/session';

/**
 * An organization as the screens use it. Only data: the role and the counters
 * are turned into words where they are drawn, so they follow the language of
 * the interface instead of the one it had when the list was loaded.
 */
export interface OrganizationSummary {
  /** Members and tickets, when your role lets you see them. */
  counts: { members: number; tickets: number } | null;
  /** What its administrators wrote; empty when they wrote nothing. */
  description: string;
  id: string;
  initials: string;
  name: string;
  /** Preview only: the administrator invitation still waiting. */
  pendingAdministrator?: string;
  /** Your role in it; `null` when you reach it as a platform administrator. */
  role: OrgRole | null;
  slug: string;
}

export const organizationCatalog = [
  {
    description: 'Design and product operations for the Northstar team.',
    id: 'org-northstar',
    initials: 'NS',
    members: 28,
    name: 'Northstar Studio',
    openTickets: 24,
    slug: 'northstar-studio',
  },
  {
    description: 'Research operations and internal support for Helio Labs.',
    id: 'org-helio',
    initials: 'HL',
    members: 14,
    name: 'Helio Labs',
    openTickets: 9,
    slug: 'helio-labs',
  },
  {
    description: 'Finance systems, reporting and employee service requests.',
    id: 'org-orbit',
    initials: 'OF',
    members: 36,
    name: 'Orbit Finance',
    openTickets: 17,
    slug: 'orbit-finance',
  },
] as const;

export function organizationsForViewer(
  viewer: ViewerSession,
): OrganizationSummary[] {
  if (viewer.globalRole === 'GLOBAL_ADMIN') {
    return organizationCatalog.map((organization) => ({
      counts: {
        members: organization.members,
        tickets: organization.openTickets,
      },
      description: organization.description,
      id: organization.id,
      initials: organization.initials,
      name: organization.name,
      role: null,
      slug: organization.slug,
    }));
  }

  return viewer.memberships.flatMap((membership) => {
    const organization = organizationCatalog.find(
      (item) => item.id === membership.organizationId,
    );
    if (!organization) return [];
    return [
      {
        counts:
          membership.role === 'MEMBER'
            ? null
            : {
                members: organization.members,
                tickets: organization.openTickets,
              },
        description:
          membership.organizationDescription ?? organization.description,
        id: organization.id,
        initials: organization.initials,
        name: organization.name,
        role: membership.role,
        slug: organization.slug,
      },
    ];
  });
}

export function normalizeOrganizationSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function organizationById(id: string) {
  return organizationCatalog.find((organization) => organization.id === id);
}

export function getOrganizationInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/** An organization as the API returns it, in the shape the screens use. */
export function summaryFromRecord(
  record: OrganizationRecord,
): OrganizationSummary {
  return {
    // A member sees their own tickets, not the organization's counters.
    counts:
      record.myRole === 'MEMBER'
        ? null
        : {
            members: record._count?.members ?? 0,
            tickets: record._count?.tickets ?? 0,
          },
    // Empty stays empty: a stand-in text here ended up pre-filled in the
    // settings form and saved as if somebody had written it.
    description: record.description ?? '',
    id: record.id,
    initials: getOrganizationInitials(record.name),
    name: record.name,
    role: record.myRole ?? null,
    slug: record.slug,
  };
}
