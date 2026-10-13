export type ThemePreference = 'light' | 'dark' | 'system';

let activePreference: ThemePreference = 'system';
let systemQuery: MediaQueryList | undefined;

function isThemePreference(
  theme: string | undefined,
): theme is ThemePreference {
  return theme === 'light' || theme === 'dark' || theme === 'system';
}

function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyResolvedTheme() {
  const resolved = resolvedTheme(activePreference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function applyTheme(theme: string | undefined): void {
  activePreference = isThemePreference(theme) ? theme : 'system';
  systemQuery?.removeEventListener('change', applyResolvedTheme);
  systemQuery = undefined;

  if (activePreference === 'system') {
    systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemQuery.addEventListener('change', applyResolvedTheme);
  }
  applyResolvedTheme();
}
