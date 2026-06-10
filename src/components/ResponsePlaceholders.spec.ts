import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SpeechResponsePlaceholder from "./SpeechResponsePlaceholder.vue";
import HandwritingResponsePlaceholder from "./HandwritingResponsePlaceholder.vue";
import UploadResponsePlaceholder from "./UploadResponsePlaceholder.vue";

describe("SpeechResponsePlaceholder", () => {
  it("渲染录音占位按钮", () => {
    const wrapper = mount(SpeechResponsePlaceholder);
    expect(wrapper.text()).toContain("录音");
    expect(wrapper.find('[data-testid="speech-record-btn"]').exists()).toBe(
      true
    );
  });
});

describe("HandwritingResponsePlaceholder", () => {
  it("渲染手写面板占位", () => {
    const wrapper = mount(HandwritingResponsePlaceholder);
    expect(wrapper.text()).toContain("手写");
    const canvas = wrapper.find('[data-testid="handwriting-canvas"]');
    expect(canvas.exists()).toBe(true);
    expect(canvas.attributes("data-hanzi-writer-target")).toBe("true");
  });
});

describe("UploadResponsePlaceholder", () => {
  it("渲染上传区域占位", () => {
    const wrapper = mount(UploadResponsePlaceholder);
    expect(wrapper.text()).toContain("上传");
    expect(wrapper.find('[data-testid="upload-drop-zone"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="upload-btn"]').exists()).toBe(true);
  });
});
