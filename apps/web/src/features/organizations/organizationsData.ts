import type { ViewerSession } from '../../app/session';

export interface OrganizationSummary {
  description: string;
  id: string;
  initials: string;
  name: string;
  roleLabel: string;
  slug: string;
  summary: string;
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

const roleLabels = {
  AGENT: 'Support agent',
  MEMBER: 'Member',
  ORG_ADMIN: 'Organization admin',
} as const;

export function organizationsForViewer(
  viewer: ViewerSession,
): OrganizationSummary[] {
  if (viewer.globalRole === 'GLOBAL_ADMIN') {
    return organizationCatalog.map((organization) => ({
      description: organization.description,
      id: organization.id,
      initials: organization.initials,
      name: organization.name,
      roleLabel: 'Platform access',
      slug: organization.slug,
      summary: `${organization.members} members · ${organization.openTickets} open tickets`,
    }));
  }

  return viewer.memberships.flatMap((membership) => {
    const organization = organizationCatalog.find(
      (item) => item.id === membership.organizationId,
    );
    if (!organization) return [];
    return [
      {
        description:
          membership.organizationDescription ?? organization.description,
        id: organization.id,
        initials: organization.initials,
        name: organization.name,
        roleLabel: roleLabels[membership.role],
        slug: organization.slug,
        summary:
          membership.role === 'MEMBER'
            ? 'Your organization'
            : `${organization.members} members · ${organization.openTickets} open tickets`,
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
