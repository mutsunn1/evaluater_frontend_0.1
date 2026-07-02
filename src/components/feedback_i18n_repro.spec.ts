import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MessageBubble from "./MessageBubble.vue";
import { i18n } from "@/i18n";

const makeFeedback = (content: string) => ({
  id: "f-1",
  role: "feedback",
  source: "llm",
  content,
  timestamp: new Date().toISOString(),
});

describe("feedback i18n keys render human-readable text", () => {
  it("renders chat.feedback.correct in English", () => {
    i18n.global.locale.value = "en";
    const wrapper = mount(MessageBubble, {
      props: { message: makeFeedback("chat.feedback.correct") },
      global: { plugins: [i18n] },
    });
    const text = wrapper.text();
    expect(text).not.toContain("chat.feedback.correct");
    expect(text).toMatch(/Correct/i);
  });

  it("renders chat.coldStart.feedback.recorded in English", () => {
    i18n.global.locale.value = "en";
    const wrapper = mount(MessageBubble, {
      props: { message: makeFeedback("chat.coldStart.feedback.recorded") },
      global: { plugins: [i18n] },
    });
    const text = wrapper.text();
    expect(text).not.toContain("chat.coldStart.feedback.recorded");
    expect(text).toMatch(/recorded/i);
  });

  it("renders chat.coldStart.feedback.recorded in Chinese", () => {
    i18n.global.locale.value = "zh";
    const wrapper = mount(MessageBubble, {
      props: { message: makeFeedback("chat.coldStart.feedback.recorded") },
      global: { plugins: [i18n] },
    });
    const text = wrapper.text();
    expect(text).not.toContain("chat.coldStart.feedback.recorded");
    expect(text).toContain("作答已记录");
  });

  it("renders embedded feedback keys in batch answer message", () => {
    i18n.global.locale.value = "zh";
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeFeedback("[grammar] Question 1: chat.feedback.correct"),
      },
      global: { plugins: [i18n] },
    });
    const text = wrapper.text();
    expect(text).not.toContain("chat.feedback.correct");
    expect(text).toContain("[grammar]");
    expect(text).toContain("Question 1");
    expect(text).toContain("回答正确");
  });

  it("renders skip modality feedback key", () => {
    i18n.global.locale.value = "zh";
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeFeedback(
          "[speaking] Question 3: chat.feedback.skipModality.speaking"
        ),
      },
      global: { plugins: [i18n] },
    });
    const text = wrapper.text();
    expect(text).not.toContain("chat.feedback.skipModality.speaking");
    expect(text).toContain("已跳过本题");
  });
});
