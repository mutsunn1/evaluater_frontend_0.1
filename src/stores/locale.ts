import { defineStore } from "pinia";
import { ref } from "vue";
import { i18n, setDocumentLang, setDocumentTitle } from "@/i18n";

export type SupportedLocale = "en" | "zh";

const STORAGE_KEY = "evaluater-locale";

function isSupportedLocale(value: string): value is SupportedLocale {
  return value === "en" || value === "zh";
}

function readStoredLocale(): SupportedLocale {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY) ?? "";
  return isSupportedLocale(stored) ? stored : "en";
}

export const useLocaleStore = defineStore("locale", () => {
  const locale = ref<SupportedLocale>(readStoredLocale());

  // Ensure i18n and document state match the persisted choice on store init.
  i18n.global.locale.value = locale.value;
  setDocumentLang(locale.value);
  setDocumentTitle(locale.value);

  function setLocale(next: SupportedLocale) {
    locale.value = next;
    i18n.global.locale.value = next;
    localStorage.setItem(STORAGE_KEY, next);
    setDocumentLang(next);
    setDocumentTitle(next);
  }

  return { locale, setLocale };
});
