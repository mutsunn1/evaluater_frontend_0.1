import { createI18n } from "vue-i18n";
import enCommon from "./locales/en/common.json";
import enChat from "./locales/en/chat.json";
import enProfile from "./locales/en/profile.json";
import enReport from "./locales/en/report.json";
import zhCommon from "./locales/zh/common.json";
import zhChat from "./locales/zh/chat.json";
import zhProfile from "./locales/zh/profile.json";
import zhReport from "./locales/zh/report.json";

export const messages = {
  en: {
    common: enCommon,
    chat: enChat,
    profile: enProfile,
    report: enReport,
  },
  zh: {
    common: zhCommon,
    chat: zhChat,
    profile: zhProfile,
    report: zhReport,
  },
};

function getInitialLocale(): string {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem("evaluater-locale");
  if (stored === "en" || stored === "zh") return stored;
  return "en";
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: "en",
  messages,
});

export function setDocumentLang(locale: string): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export function setDocumentTitle(locale: string): void {
  if (typeof document === "undefined") return;
  const t = messages[locale as keyof typeof messages]?.common?.appTitle;
  document.title = (t as string | undefined) || messages.en.common.appTitle;
}

setDocumentLang(getInitialLocale());
setDocumentTitle(getInitialLocale());
