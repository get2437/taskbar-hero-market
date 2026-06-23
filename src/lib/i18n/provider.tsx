"use client";
import { createContext, useContext } from "react";
import { createTranslator, type Translator } from "./index";
import type { Locale } from "./messages";

const TranslatorContext = createContext<Translator>(createTranslator("en"));

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <TranslatorContext.Provider value={createTranslator(locale)}>{children}</TranslatorContext.Provider>;
}

/** クライアントコンポーネント用フック。 */
export function useT(): Translator {
  return useContext(TranslatorContext);
}
