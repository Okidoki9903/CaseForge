/**
 * Internationalisation : français par défaut, anglais prêt.
 * Ajouter une langue = ajouter un fichier de messages typé `Messages` et l'enregistrer ici.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fr } from './fr';
import { en } from './en';

export const LANGUAGES = { fr: 'Français', en: 'English' } as const;
export type Language = keyof typeof LANGUAGES;

const saved = (() => {
  try {
    return localStorage.getItem('cf.lang');
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: saved === 'en' ? 'en' : 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: Language): void {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem('cf.lang', lang);
  } catch {
    /* préférence non persistée */
  }
}

/** Locale Intl correspondant à la langue courante. */
export const intlLocale = () => (i18n.language === 'en' ? 'en-CA' : 'fr-CA');

export default i18n;
