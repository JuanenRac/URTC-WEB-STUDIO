import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  fr: { translation: fr },
  it: { translation: it }
};

const STORAGE_KEY = 'urtc-web-studio-language';
const SUPPORTED_LANGUAGES = ['en', 'es', 'de', 'fr', 'it'];

const getStoredLanguage = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  } catch {
    // localStorage unavailable (e.g. privacy mode) - fall back silently
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getStoredLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
