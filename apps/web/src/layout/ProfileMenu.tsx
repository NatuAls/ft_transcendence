import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Navigate } from '../app/routes';

export function ProfileMenu({
  children,
  className = '',
  label,
  onNavigate,
  showAdministration = false,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onNavigate: Navigate;
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
    <div className={`profile-menu ${className}`.trim()} ref={wrapperRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="profile-menu__trigger"
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
        <div
          className="profile-menu__popover"
          id={menuId}
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
          role="menu"
        >
          <button
            onClick={() => navigate('account/profile')}
            ref={firstItemRef}
            role="menuitem"
            type="button"
          >
            <span aria-hidden="true">○</span>
            Profile settings
          </button>
          <button
            onClick={() => navigate('account/privacy')}
            role="menuitem"
            type="button"
          >
            <span aria-hidden="true">◇</span>
            Privacy &amp; data
          </button>
          <button
            onClick={() => navigate('organizations')}
            role="menuitem"
            type="button"
          >
            <span aria-hidden="true">◫</span>
            Organizations
          </button>
          {showAdministration ? (
            <button
              onClick={() => navigate('admin')}
              role="menuitem"
              type="button"
            >
              <span aria-hidden="true">▣</span>
              Administration
            </button>
          ) : null}
          <hr role="separator" />
          <button
            onClick={() => navigate('login')}
            role="menuitem"
            type="button"
          >
            <span aria-hidden="true">↪</span>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
