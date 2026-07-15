import { config } from "@vue/test-utils";
import { beforeEach } from "vitest";
import { i18n } from "./i18n";

config.global.plugins = [i18n];

if (typeof DataTransfer === "undefined") {
  class FakeDataTransfer {
    items = {
      add: (file: File) => {
        (this as unknown as { _files: File[] })._files.push(file);
      },
    };
    _files: File[] = [];
    get files() {
      return Object.setPrototypeOf(this._files, FileList.prototype);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DataTransfer = FakeDataTransfer;
}

beforeEach(() => {
  i18n.global.locale.value = "en";
  localStorage.clear();
});
