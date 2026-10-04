// Traducciones: i18next + react-i18next. Tres idiomas completos por
// construcción: es.ts y ca.ts se declaran con el tipo de en.ts, así que si
// falta una clave no compila. Las claves errors.* coinciden con el
// messageKey de la API.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { es } from './locales/es';
import { ca } from './locales/ca';

export const LANGUAGES = ['en', 'es', 'ca'] as const;
export type Language = (typeof LANGUAGES)[number];
const STORAGE_KEY = 'hd_lang';

/** Código que guarda la API en users.locale (enum Locale). */
export function toApiLocale(lang: Language): 'EN' | 'ES' | 'CA' {
  return lang.toUpperCase() as 'EN' | 'ES' | 'CA';
}
export function fromApiLocale(locale: string | undefined | null): Language {
  const l = (locale ?? '').toLowerCase();
  return (LANGUAGES as readonly string[]).includes(l) ? (l as Language) : 'en';
}

function detectLanguage(): Language {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* modo privado */
  }
  if (stored && (LANGUAGES as readonly string[]).includes(stored))
    return stored as Language;
  const nav = navigator.language.slice(0, 2).toLowerCase();
  return (LANGUAGES as readonly string[]).includes(nav)
    ? (nav as Language)
    : 'en';
}

export async function initI18n() {
  if (i18next.isInitialized) return i18next;
  await i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      ca: { translation: ca },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React ya escapa
    returnNull: false,
  });
  document.documentElement.lang = i18next.language;
  return i18next;
}

/** Cambia el idioma en la interfaz; la pantalla de cuenta lo persiste en la API. */
export async function setLanguage(lang: Language) {
  await i18next.changeLanguage(lang);
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* modo privado */
  }
}

export function currentLanguage(): Language {
  return fromApiLocale(i18next.language);
}

export { useTranslation } from 'react-i18next';
