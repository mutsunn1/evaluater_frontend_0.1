import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useLocaleStore } from "./locale";
import { i18n } from "@/i18n";

describe("useLocaleStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    i18n.global.locale.value = "en";
    document.documentElement.lang = "en";
  });

  it("localStorage 为空时默认使用 en", () => {
    const store = useLocaleStore();
    expect(store.locale).toBe("en");
  });

  it("初始化时读取 localStorage 中保存的语言", () => {
    localStorage.setItem("evaluater-locale", "zh");
    const store = useLocaleStore();
    expect(store.locale).toBe("zh");
  });

  it("setLocale 更新 store、localStorage、i18n locale 和 document.lang", () => {
    const store = useLocaleStore();
    store.setLocale("zh");

    expect(store.locale).toBe("zh");
    expect(localStorage.getItem("evaluater-locale")).toBe("zh");
    expect(i18n.global.locale.value).toBe("zh");
    expect(document.documentElement.lang).toBe("zh");
  });

  it("setLocale 更新 document.title 为对应语言", () => {
    const store = useLocaleStore();
    store.setLocale("en");
    expect(document.title).toBe("Chinese Proficiency Evaluation");

    store.setLocale("zh");
    expect(document.title).toBe("中文水平评测");
  });

  it("忽略非法语言值，回退到 en", () => {
    localStorage.setItem("evaluater-locale", "fr");
    const store = useLocaleStore();
    expect(store.locale).toBe("en");
  });
});
