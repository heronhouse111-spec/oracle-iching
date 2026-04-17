"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type Locale = "zh" | "en";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (zh: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");

  const t = useCallback(
    (zh: string, en: string) => (locale === "zh" ? zh : en),
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
