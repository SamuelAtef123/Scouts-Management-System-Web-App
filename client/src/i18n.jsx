import { createContext, Fragment, useContext, useEffect, useState } from 'react';
import { AR } from './i18n-ar.js';

/*
 * App language: English (default) or Arabic. Texts are written in English in the code and
 * wrapped in t('...'); the Arabic dictionary (i18n-ar.js) maps each English text to Arabic.
 * The choice is remembered on this device.
 */

const KEY = 'scouts_lang';

function load() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

let current = load();
applyToDocument(current);

function applyToDocument(lang) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export const getLang = () => current;
export const isArabic = () => current === 'ar';

/** Translate an English text. `{name}` placeholders are filled from `vars`. */
export function t(text, vars) {
  let out = current === 'ar' ? (AR[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/** Locale for dates and numbers (Arabic text with Latin digits, matching phone numbers and inputs). */
export const locale = () => (current === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

const LangContext = createContext({ lang: 'en', setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(current);

  const setLang = (next) => {
    current = next === 'ar' ? 'ar' : 'en';
    try {
      localStorage.setItem(KEY, current);
    } catch {
      /* private mode: choice lasts for this visit */
    }
    applyToDocument(current);
    setLangState(current);
  };

  useEffect(() => applyToDocument(lang), [lang]);

  // Re-mount the app on a language change so every text and date is redrawn.
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangContext.Provider>
  );
}

export const useLanguage = () => useContext(LangContext);

/** Language switch: a small two-option control. */
export function LanguageSwitch({ className = '' }) {
  const { lang, setLang } = useLanguage();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Language / اللغة">
      <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')} lang="en">
        English
      </button>
      <button type="button" className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')} lang="ar">
        العربية
      </button>
    </div>
  );
}
