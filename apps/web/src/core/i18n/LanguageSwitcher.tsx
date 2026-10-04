import { useTranslation } from 'react-i18next';
import {
  LANGUAGES,
  currentLanguage,
  setLanguage,
  type Language,
} from './index';

const LABELS: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  ca: 'Català',
};

/** Selector de idioma para el menú de perfil. onChange recibe el código de la API para persistirlo. */
export function LanguageSwitcher({
  onChange,
}: {
  onChange?: (apiLocale: 'EN' | 'ES' | 'CA') => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="ui-field">
      {t('common.language')}
      <select
        className="ui-field__input"
        value={currentLanguage()}
        onChange={(e) => {
          const lang = e.target.value as Language;
          void setLanguage(lang);
          onChange?.(lang.toUpperCase() as 'EN' | 'ES' | 'CA');
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
