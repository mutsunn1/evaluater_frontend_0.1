import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SpeechRecorder from "./SpeechRecorder.vue";
import HandwritingResponsePlaceholder from "./HandwritingResponsePlaceholder.vue";
import UploadResponsePlaceholder from "./UploadResponsePlaceholder.vue";

describe("SpeechRecorder", () => {
  it("renders record button in idle state without sessionId", () => {
    const wrapper = mount(SpeechRecorder, {
      props: {},
    });
    expect(wrapper.text()).toContain("Record your spoken answer");
    expect(wrapper.find('[data-testid="speech-record-btn"]').exists()).toBe(
      true
    );
  });
});

describe("HandwritingResponsePlaceholder", () => {
  it("renders handwriting canvas placeholder", () => {
    const wrapper = mount(HandwritingResponsePlaceholder);
    expect(wrapper.text()).toContain("Handwriting");
    const canvas = wrapper.find('[data-testid="handwriting-canvas"]');
    expect(canvas.exists()).toBe(true);
    expect(canvas.attributes("data-hanzi-writer-target")).toBe("true");
  });
});

describe("UploadResponsePlaceholder", () => {
  it("renders upload drop zone", () => {
    const wrapper = mount(UploadResponsePlaceholder);
    expect(wrapper.text()).toContain("Upload");
    expect(wrapper.find('[data-testid="upload-drop-zone"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="upload-btn"]').exists()).toBe(true);
  });
});
