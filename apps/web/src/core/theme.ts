export type ThemePreference = 'light' | 'dark' | 'system';

/** Dónde queda el último tema elegido, para avisar a las demás pestañas. */
const STORAGE_KEY = 'hd_theme';

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

/**
 * Aplica el tema que la persona acaba de elegir y lo deja para las demás
 * pestañas del mismo navegador.
 *
 * Sólo lo que se elige se comparte. El tema que una pestaña aplica al cargar
 * —el de arranque, el que trae la API— va por `applyTheme`: si se compartiese,
 * abrir una pestaña nueva cambiaría el tema de las que ya estaban abiertas.
 */
export function chooseTheme(theme: string | undefined): void {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, activePreference);
  } catch {
    /* modo privado: cada pestaña con el suyo, como antes */
  }
}

/**
 * El tema elegido en otra pestaña se aplica en ésta. El navegador avisa con el
 * evento `storage` a las demás pestañas, no a la que lo ha escrito.
 */
export function followThemeOfOtherTabs(): void {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    const theme = event.newValue ?? undefined;
    if (isThemePreference(theme)) applyTheme(theme);
  });
}
