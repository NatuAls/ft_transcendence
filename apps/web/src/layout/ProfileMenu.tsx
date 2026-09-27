import { DropdownMenu, Icon, type IconName } from 'ui';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import type { Navigate } from '../app/routes';

export function ProfileMenu({
  children,
  className = '',
  label,
  onNavigate,
  onSignOut,
  placement = 'topbar',
  showAdministration = false,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onNavigate: Navigate;
  onSignOut: () => void | Promise<void>;
  placement?: 'mobile' | 'sidebar' | 'topbar';
  showAdministration?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();

    function closeFromOutside(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === 'Tab') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('mousedown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [open]);

  function navigate(route: Parameters<Navigate>[0]) {
    setOpen(false);
    onNavigate(route);
  }

  return (
    <div className={`relative ${className}`.trim()} ref={wrapperRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={`grid min-w-0 place-items-center border-0 bg-transparent p-0 text-inherit ${placement === 'sidebar' ? 'h-11 w-9 rounded-sm' : ''}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        {children}
      </button>
      {open ? (
        <DropdownMenu
          className={`absolute z-60 grid w-[220px] overflow-hidden text-ink ${placement === 'sidebar' ? 'bottom-[calc(100%+8px)] left-0' : 'top-[calc(100%+10px)] right-0'}`}
          id={menuId}
          label="Account menu"
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
              return;
            event.preventDefault();
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]',
              ),
            );
            const currentIndex = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const nextIndex =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : event.key === 'ArrowUp'
                    ? (currentIndex - 1 + items.length) % items.length
                    : (currentIndex + 1) % items.length;
            items[nextIndex]?.focus();
          }}
        >
          <MenuItem
            icon="user"
            onClick={() => navigate('account/profile')}
            ref={firstItemRef}
          >
            Profile settings
          </MenuItem>
          <MenuItem icon="shield" onClick={() => navigate('account/privacy')}>
            Privacy &amp; data
          </MenuItem>
          <MenuItem icon="building" onClick={() => navigate('organizations')}>
            Organizations
          </MenuItem>
          {showAdministration ? (
            <MenuItem icon="ticket" onClick={() => navigate('admin')}>
              Administration
            </MenuItem>
          ) : null}
          <hr
            className="my-[5px] w-full border-0 border-t border-border"
            role="separator"
          />
          <MenuItem
            icon="logout"
            onClick={() => {
              setOpen(false);
              void onSignOut();
            }}
          >
            Sign out
          </MenuItem>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

const MenuItem = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName }
>(function MenuItem({ children, icon, ...props }, ref) {
  return (
    <button
      className="grid min-h-[42px] grid-cols-[24px_1fr_auto] items-center rounded-sm px-2.5 text-left hover:bg-surface-secondary focus-visible:bg-surface-secondary"
      ref={ref}
      role="menuitem"
      type="button"
      {...props}
    >
      <Icon name={icon} size={17} />
      {children}
    </button>
  );
});
