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

  it("renders chat.feedback.skipModality.listening in English", () => {
    i18n.global.locale.value = "en";
    const wrapper = mount(MessageBubble, {
      props: { message: makeFeedback("chat.feedback.skipModality.listening") },
      global: { plugins: [i18n] },
    });
    const text = wrapper.text();
    expect(text).not.toContain("chat.feedback.skipModality.listening");
    expect(text).toMatch(/Skipped/i);
  });
});
