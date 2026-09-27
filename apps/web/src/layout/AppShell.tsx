import { Avatar, BrandMark, Icon, IconButton, type IconName } from 'ui';
import { useState, type ReactNode } from 'react';
import type { AppSection, Navigate } from '../app/routes';
import { sessionCapabilities } from '../app/session';
import { getInitials } from '../app/text';
import { GlobalSearchDialog } from './GlobalSearchDialog';
import { ProfileMenu } from './ProfileMenu';

export type { AppSection } from '../app/routes';

interface AppShellProps {
  activeSection: AppSection;
  avatarUrl?: string;
  children: ReactNode;
  onNavigate: Navigate;
  onSignOut: () => void | Promise<void>;
  organizationName: string;
  userEmail: string;
  userName: string;
}

const desktopNavigation: Array<{
  icon: IconName;
  label: string;
  section: AppSection;
}> = [
  { icon: 'ticket', label: 'Tickets', section: 'tickets' },
  { icon: 'users', label: 'People', section: 'people' },
  { icon: 'message', label: 'Messages', section: 'messages' },
  { icon: 'building', label: 'Organization', section: 'organization' },
];

const mobileNavigation = desktopNavigation
  .slice(0, 3)
  .concat({ icon: 'user' as const, label: 'Account', section: 'account' });

const mobileTitles: Record<AppSection, string> = {
  account: 'Account',
  messages: 'Messages',
  organization: 'Organization',
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
          ? 'min-h-0 flex-col justify-center gap-1 rounded-none p-[5px] text-center text-[11px] text-muted'
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
  activeSection,
  avatarUrl,
  children,
  onNavigate,
  onSignOut,
  organizationName,
  userEmail,
  userName,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const userInitials = getInitials(userName);

  return (
    <div className="min-h-dvh bg-canvas max-[1100px]:bg-surface">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[260px] flex-col bg-[#183039] px-5 pt-7 pb-5 text-surface max-[1100px]:hidden">
        <div className="flex items-center gap-3 px-2 pb-10 text-lg font-medium">
          <BrandMark className="!size-9 !rounded-[10px]" />
          <span>HelpDesk Lite</span>
        </div>
        <nav aria-label="Main navigation" className="grid gap-1.5">
          {desktopNavigation.map((item) => (
            <NavButton
              active={item.section === activeSection}
              icon={item.icon}
              key={item.section}
              label={item.label}
              onClick={() => onNavigate(item.section)}
            />
          ))}
        </nav>
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
            onSignOut={onSignOut}
            showAdministration={sessionCapabilities.managePlatform}
            placement="sidebar"
          >
            <span aria-hidden="true">•••</span>
          </ProfileMenu>
        </div>
      </aside>

      <div className="min-h-dvh pl-[260px] max-[1100px]:pb-[74px] max-[1100px]:pl-0">
        <header className="flex h-20 items-center justify-between border-b border-border bg-surface px-10 max-[1100px]:hidden">
          <div className="flex items-center gap-2.5">
            <strong className="text-base font-medium">
              {organizationName}
            </strong>
            <span className="rounded-full bg-surface-secondary px-[9px] py-[5px] text-[10px] text-muted">
              Frontend preview · local data
            </span>
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
              onSignOut={onSignOut}
              showAdministration={sessionCapabilities.managePlatform}
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
        <header className="sticky top-0 z-10 hidden h-[68px] grid-cols-[40px_1fr_40px] items-center border-b border-border bg-surface/94 px-[18px] max-[1100px]:grid">
          <BrandMark className="!size-9 !rounded-[10px]" />
          <strong className="text-center text-lg">
            {mobileTitles[activeSection]}
          </strong>
          <ProfileMenu
            className="justify-self-end"
            label="Open account menu"
            onNavigate={onNavigate}
            onSignOut={onSignOut}
            showAdministration={sessionCapabilities.managePlatform}
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
