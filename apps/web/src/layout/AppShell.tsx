import { Avatar, BrandMark } from 'ui';
import { useState, type ReactNode } from 'react';
import type { AppSection, Navigate } from '../app/routes';
import { sessionCapabilities } from '../app/session';
import { getInitials } from '../app/text';
import { GlobalSearchDialog } from './GlobalSearchDialog';
import { ProfileMenu } from './ProfileMenu';
import './shell.css';

export type { AppSection } from '../app/routes';

interface AppShellProps {
  activeSection: AppSection;
  avatarUrl?: string;
  children: ReactNode;
  onNavigate: Navigate;
  organizationName: string;
  userEmail: string;
  userName: string;
}

const desktopNavigation: Array<{
  icon: string;
  label: string;
  section: AppSection;
}> = [
  { icon: '▣', label: 'Tickets', section: 'tickets' },
  { icon: '◎', label: 'People', section: 'people' },
  { icon: '◫', label: 'Messages', section: 'messages' },
  { icon: '◇', label: 'Organization', section: 'organization' },
];

const mobileNavigation = desktopNavigation
  .slice(0, 3)
  .concat({ icon: '○', label: 'Account', section: 'account' });

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
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`app-shell__nav-item ${active ? 'app-shell__nav-item--active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="app-shell__nav-icon">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function AppShell({
  activeSection,
  avatarUrl,
  children,
  onNavigate,
  organizationName,
  userEmail,
  userName,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const userInitials = getInitials(userName);

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <BrandMark />
          <span>HelpDesk Lite</span>
        </div>
        <nav aria-label="Main navigation" className="app-shell__desktop-nav">
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
        <div className="app-shell__profile-area">
          <button
            className="app-shell__profile"
            onClick={() => onNavigate('account/profile')}
            type="button"
          >
            <Avatar
              className="app-shell__avatar"
              initials={userInitials}
              src={avatarUrl}
            />
            <span className="app-shell__profile-copy">
              <strong>{userName}</strong>
              <small>{userEmail}</small>
            </span>
          </button>
          <ProfileMenu
            className="profile-menu--sidebar"
            label="Open account menu"
            onNavigate={onNavigate}
            showAdministration={sessionCapabilities.managePlatform}
          >
            <span aria-hidden="true">•••</span>
          </ProfileMenu>
        </div>
      </aside>

      <div className="app-shell__workspace">
        <header className="app-shell__topbar">
          <div className="app-shell__workspace-identity">
            <strong>{organizationName}</strong>
            <span>Frontend preview · local data</span>
          </div>
          <div className="app-shell__topbar-actions">
            <button
              aria-label="Search HelpDesk Lite"
              className="app-shell__icon-button"
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              ⌕
            </button>
            <ProfileMenu
              className="profile-menu--topbar"
              label="Open account menu"
              onNavigate={onNavigate}
              showAdministration={sessionCapabilities.managePlatform}
            >
              <Avatar
                className="app-shell__avatar"
                initials={userInitials}
                src={avatarUrl}
              />
            </ProfileMenu>
          </div>
        </header>
        <header className="app-shell__mobile-topbar">
          <BrandMark />
          <strong>{mobileTitles[activeSection]}</strong>
          <ProfileMenu
            className="profile-menu--mobile"
            label="Open account menu"
            onNavigate={onNavigate}
            showAdministration={sessionCapabilities.managePlatform}
          >
            <Avatar
              className="app-shell__avatar"
              initials={userInitials}
              src={avatarUrl}
            />
          </ProfileMenu>
        </header>
        <main className="app-shell__content">{children}</main>
        <nav aria-label="Mobile navigation" className="app-shell__mobile-nav">
          {mobileNavigation.map((item) => (
            <NavButton
              active={item.section === activeSection}
              icon={item.icon}
              key={item.section}
              label={item.label}
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
