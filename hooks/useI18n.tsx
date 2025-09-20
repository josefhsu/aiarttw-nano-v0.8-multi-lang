import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';
import { locales, Language, Locale } from '../constants';
import { getLocaleObject } from '../constants-i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const storedLang = window.localStorage.getItem('birdnest-language');
      return (storedLang && locales[storedLang as Language]) ? (storedLang as Language) : 'zh-TW';
    } catch (error) {
      console.error("Failed to read language from localStorage", error);
      return 'zh-TW';
    }
  });

  const setLanguage = useCallback((lang: Language) => {
    try {
      window.localStorage.setItem('birdnest-language', lang);
    } catch (error) {
      console.error("Could not save language to localStorage", error);
    }
    setLanguageState(lang);
  }, []);


  const t = useCallback((key: string, options?: { [key: string]: string | number }): string => {
    const keys = key.split('.');
    
    let translation: any = getLocaleObject(language);
    let fallbackTranslation: any = getLocaleObject('zh-TW');

    let result = translation;
    for(const k of keys) {
        if (result && typeof result === 'object' && k in result) {
            result = result[k];
        } else {
            result = null;
            break;
        }
    }

    if (result === null || typeof result !== 'string') {
        result = fallbackTranslation;
        for(const k of keys) {
            if (result && typeof result === 'object' && k in result) {
                result = result[k];
            } else {
                result = key;
                break;
            }
        }
    }

    if (typeof result !== 'string') {
        return key;
    }
    
    let formattedResult = result;
    if (options) {
      Object.keys(options).forEach(optKey => {
        formattedResult = formattedResult.replace(new RegExp(`{{${optKey}}}`, 'g'), String(options[optKey]));
      });
    }
    return formattedResult;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t]);

  return (
    // Fix: Corrected typo from Language-Context to LanguageContext
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useI18n = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within a LanguageProvider');
  }
  return context;
};