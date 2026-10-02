import { Avatar, BrandMark, Icon, IconButton, type IconName } from 'ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppSection, Navigate } from '../app/routes';
import { PreviewIdentitySelect } from '../app/PreviewIdentitySelect';
import {
  can,
  previewMode,
  type PreviewIdentity,
  type ViewerSession,
} from '../app/session';
import { getInitials } from '../app/text';
import { GlobalSearchDialog } from './GlobalSearchDialog';
import { ProfileMenu } from './ProfileMenu';

export type { AppSection } from '../app/routes';

interface AppShellProps {
  activeOrganizationId: string;
  activeSection: AppSection;
  avatarUrl?: string;
  children: ReactNode;
  hideMobileHeader?: boolean;
  onNavigate: Navigate;
  onOrganizationChange: (organizationId: string) => void;
  onPreviewIdentityChange: (identity: PreviewIdentity) => void;
  onSignOut: () => void | Promise<void>;
  organizationName: string;
  organizationOptions: Array<{ id: string; name: string }>;
  userEmail: string;
  userName: string;
  viewer: ViewerSession;
}

const workspaceNavigation: Array<{
  icon: IconName;
  label: string;
  section: AppSection;
}> = [
  { icon: 'ticket', label: 'Tickets', section: 'tickets' },
  { icon: 'users', label: 'People', section: 'people' },
  { icon: 'message', label: 'Messages', section: 'messages' },
  {
    icon: 'building',
    label: 'Organization settings',
    section: 'organization',
  },
];

const platformNavigation: Array<{
  icon: IconName;
  label: string;
  section: AppSection;
}> = [
  { icon: 'users', label: 'Users', section: 'admin' },
  { icon: 'building', label: 'Organizations', section: 'organizations' },
];

const mobileNavigation = workspaceNavigation
  .slice(0, 3)
  .concat({ icon: 'user' as const, label: 'Account', section: 'account' });

const mobileTitles: Record<AppSection, string> = {
  account: 'Account',
  admin: 'Users',
  messages: 'Messages',
  organization: 'Organization',
  organizations: 'Organizations',
  people: 'People',
  tickets: 'Tickets',
};

function NavButton({
  active,
  icon,
  label,
  mobile = false,
  onClick,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  mobile?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`flex items-center border-0 bg-transparent font-[inherit] text-inherit ${
        mobile
          ? 'min-h-0 flex-col justify-center gap-1 rounded-none p-[5px] text-center text-xs2 text-muted'
          : 'min-h-12 gap-[14px] rounded-[10px] px-[14px] text-left'
      } ${active ? (mobile ? '!text-primary' : 'bg-white/12 text-white') : ''}`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" name={icon} size={20} />
      <span>{label}</span>
    </button>
  );
}

export function AppShell({
  activeOrganizationId,
  activeSection,
  avatarUrl,
  children,
  hideMobileHeader = false,
  onNavigate,
  onOrganizationChange,
  onPreviewIdentityChange,
  onSignOut,
  organizationName,
  organizationOptions,
  userEmail,
  userName,
  viewer,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [organizationMenuOpen, setOrganizationMenuOpen] = useState(false);
  const organizationPickerRef = useRef<HTMLDivElement>(null);
  const userInitials = getInitials(userName);
  const showAdministration = can(viewer, 'user:listAll');
  const canSwitchOrganization = organizationOptions.length > 1;

  useEffect(() => {
    if (!organizationMenuOpen) return;
    function closeOrganizationMenu(event: MouseEvent) {
      if (!organizationPickerRef.current?.contains(event.target as Node)) {
        setOrganizationMenuOpen(false);
      }
    }
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOrganizationMenuOpen(false);
    }
    document.addEventListener('mousedown', closeOrganizationMenu);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('mousedown', closeOrganizationMenu);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [organizationMenuOpen]);

  return (
    <div className="min-h-dvh bg-canvas max-[1100px]:bg-surface">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[260px] flex-col bg-[#183039] px-5 pt-7 pb-5 text-surface max-[1100px]:hidden">
        <button
          className="flex items-center gap-3 px-2 pb-10 text-left text-lg font-medium"
          onClick={() => onNavigate('tickets')}
          type="button"
        >
          <BrandMark className="!size-9 !rounded-[10px]" />
          <span>HelpDesk Lite</span>
        </button>
        <nav aria-label="Main navigation" className="grid gap-1.5">
          <span className="px-3 pb-1 text-2xs tracking-[.08em] text-[#a9b9ba]">
            ORGANIZATION
          </span>
          {workspaceNavigation.map((item) => (
            <NavButton
              active={item.section === activeSection}
              icon={item.icon}
              key={item.section}
              label={
                item.section === 'organization' &&
                !can(viewer, 'organization:update')
                  ? 'Organization'
                  : item.label
              }
              onClick={() => onNavigate(item.section)}
            />
          ))}
          {showAdministration ? (
            <>
              <span className="mt-5 px-3 pb-1 text-2xs tracking-[.08em] text-[#a9b9ba]">
                PLATFORM
              </span>
              {platformNavigation.map((item) => (
                <NavButton
                  active={item.section === activeSection}
                  icon={item.icon}
                  key={item.section}
                  label={item.label}
                  onClick={() => onNavigate(item.section)}
                />
              ))}
            </>
          ) : null}
        </nav>
        {previewMode && viewer.previewIdentity ? (
          <PreviewIdentitySelect
            className="mt-6 px-2 !text-[#a9b9ba] [&_select]:border-white/20 [&_select]:bg-[#213e45] [&_select]:text-white"
            onChange={onPreviewIdentityChange}
            value={viewer.previewIdentity}
          />
        ) : null}
        <div className="relative mt-auto flex items-center rounded-sm">
          <button
            className="flex min-w-0 flex-1 items-center gap-2.5 border-0 bg-transparent px-2 py-3 text-left font-[inherit] text-inherit"
            onClick={() => onNavigate('account/profile')}
            type="button"
          >
            <Avatar
              className="!size-[38px] !basis-[38px]"
              initials={userInitials}
              src={avatarUrl}
            />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <strong className="text-sm font-medium">{userName}</strong>
              <small className="overflow-hidden text-xs text-ellipsis text-[#a9b9ba]">
                {userEmail}
              </small>
            </span>
          </button>
          <ProfileMenu
            label="Open account menu"
            onNavigate={onNavigate}
            onPreviewIdentityChange={onPreviewIdentityChange}
            onSignOut={onSignOut}
            previewIdentity={viewer.previewIdentity}
            showAdministration={showAdministration}
            placement="sidebar"
          >
            <span aria-hidden="true">•••</span>
          </ProfileMenu>
        </div>
      </aside>

      <div className="min-h-dvh pl-[260px] max-[1100px]:pb-[74px] max-[1100px]:pl-0">
        <header className="flex h-20 items-center justify-between border-b border-border bg-surface px-10 max-[1100px]:hidden">
          <div className="flex items-center gap-2.5">
            <div className="relative" ref={organizationPickerRef}>
              {canSwitchOrganization ? (
                <button
                  aria-expanded={organizationMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-surface-secondary"
                  onClick={() => setOrganizationMenuOpen((current) => !current)}
                  type="button"
                >
                  <span className="grid gap-0.5">
                    <small className="text-3xs tracking-[.06em] text-muted">
                      ACTIVE ORGANIZATION
                    </small>
                    <strong className="text-sm font-medium">
                      {organizationName}
                    </strong>
                  </span>
                  <Icon name="chevron-down" size={15} />
                </button>
              ) : (
                <span className="grid gap-0.5 px-2 py-1">
                  <small className="text-3xs tracking-[.06em] text-muted">
                    ACTIVE ORGANIZATION
                  </small>
                  <strong className="text-sm font-medium">
                    {organizationName}
                  </strong>
                </span>
              )}
              {organizationMenuOpen ? (
                <div
                  aria-label="Choose active organization"
                  className="absolute top-[calc(100%+8px)] left-0 z-60 grid min-w-[240px] overflow-hidden rounded-md border border-border bg-surface p-1.5 shadow-lg"
                  role="menu"
                >
                  {organizationOptions.map((organization) => (
                    <button
                      aria-current={
                        organization.id === activeOrganizationId
                          ? 'true'
                          : undefined
                      }
                      className="flex min-h-11 items-center justify-between gap-5 rounded-sm px-3 text-left text-sm hover:bg-surface-secondary focus-visible:bg-surface-secondary"
                      key={organization.id}
                      onClick={() => {
                        onOrganizationChange(organization.id);
                        setOrganizationMenuOpen(false);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <span>{organization.name}</span>
                      {organization.id === activeOrganizationId ? (
                        <span className="text-primary" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {previewMode ? (
              <span className="rounded-full bg-surface-secondary px-[9px] py-[5px] text-2xs text-muted">
                Frontend preview · local data
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-[18px]">
            <IconButton
              icon="search"
              label="Search HelpDesk Lite"
              onClick={() => setSearchOpen(true)}
            />
            <ProfileMenu
              label="Open account menu"
              onNavigate={onNavigate}
              onPreviewIdentityChange={onPreviewIdentityChange}
              onSignOut={onSignOut}
              previewIdentity={viewer.previewIdentity}
              showAdministration={showAdministration}
              placement="topbar"
            >
              <Avatar
                className="!size-[38px] !basis-[38px]"
                initials={userInitials}
                src={avatarUrl}
              />
            </ProfileMenu>
          </div>
        </header>
        <header
          className={`${hideMobileHeader ? '' : 'max-[1100px]:grid'} sticky top-0 z-10 hidden h-[68px] grid-cols-[40px_1fr_40px] items-center border-b border-border bg-surface/94 px-[18px]`}
        >
          <button
            aria-label="Go to tickets"
            className="grid size-10 place-items-center rounded-[10px]"
            onClick={() => onNavigate('tickets')}
            type="button"
          >
            <BrandMark className="!size-9 !rounded-[10px]" />
          </button>
          <strong className="text-center text-lg">
            {mobileTitles[activeSection]}
          </strong>
          <ProfileMenu
            className="justify-self-end"
            label="Open account menu"
            onNavigate={onNavigate}
            onPreviewIdentityChange={onPreviewIdentityChange}
            onSignOut={onSignOut}
            previewIdentity={viewer.previewIdentity}
            showAdministration={showAdministration}
            placement="mobile"
          >
            <Avatar
              className="!size-9"
              initials={userInitials}
              src={avatarUrl}
            />
          </ProfileMenu>
        </header>
        <main className="min-w-0">{children}</main>
        <nav
          aria-label="Mobile navigation"
          className="fixed right-0 bottom-0 left-0 z-20 hidden h-[74px] grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] max-[1100px]:grid"
        >
          {mobileNavigation.map((item) => (
            <NavButton
              active={item.section === activeSection}
              icon={item.icon}
              key={item.section}
              label={item.label}
              mobile
              onClick={() => onNavigate(item.section)}
            />
          ))}
        </nav>
      </div>
      {searchOpen ? (
        <GlobalSearchDialog
          onClose={() => setSearchOpen(false)}
          onNavigate={onNavigate}
          organizationName={organizationName}
        />
      ) : null}
    </div>
  );
}
