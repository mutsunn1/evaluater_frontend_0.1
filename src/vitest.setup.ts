import { config } from "@vue/test-utils";
import { beforeEach } from "vitest";
import { i18n } from "./i18n";

config.global.plugins = [i18n];

beforeEach(() => {
  i18n.global.locale.value = "en";
  localStorage.clear();
});
