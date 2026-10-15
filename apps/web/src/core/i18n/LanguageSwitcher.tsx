import { useTranslation } from 'react-i18next';
import { SelectField } from 'ui';
import {
  LANGUAGES,
  currentLanguage,
  setLanguage,
  toApiLocale,
  type Language,
} from './index';

/** Selector de idioma para el menú de perfil. onChange recibe el código de la API para persistirlo. */
export function LanguageSwitcher({
  onChange,
}: {
  onChange?: (apiLocale: 'EN' | 'ES' | 'CA') => void;
}) {
  const { t } = useTranslation();
  return (
    <SelectField
      label={t('common.language')}
      onChange={(event) => {
        const lang = event.target.value as Language;
        void setLanguage(lang);
        onChange?.(toApiLocale(lang));
      }}
      value={currentLanguage()}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {t(`account.preferences.languages.${lang}`)}
        </option>
      ))}
    </SelectField>
  );
}
