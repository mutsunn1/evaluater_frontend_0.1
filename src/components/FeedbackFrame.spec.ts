import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { defineComponent, h } from "vue";
import FeedbackFrame from "./FeedbackFrame.vue";
import { i18n } from "@/i18n";
import type { ChatMessage } from "@/types";

const thinkingFrameStub = defineComponent({
  name: "ThinkingFrame",
  props: ["steps", "title"],
  setup() {
    return () => h("div", { class: "thinking-stub" }, "Thinking");
  },
});

function makeMessage(content: string, isCorrect?: boolean): ChatMessage {
  return {
    id: `msg-${content}`,
    role: "feedback",
    source: "llm",
    content,
    is_correct: isCorrect,
    timestamp: new Date().toISOString(),
  };
}

describe("FeedbackFrame i18n", () => {
  beforeEach(() => {
    i18n.global.locale.value = "zh";
  });

  it("translates embedded feedback i18n keys for llm-sourced messages", async () => {
    const wrapper = mount(FeedbackFrame, {
      props: {
        messages: [
          makeMessage("[grammar] Question 1: chat.feedback.incorrectWithAnswer"),
          makeMessage("[speaking] Question 3: chat.feedback.skipModality.speaking"),
          makeMessage("[vocabulary] Question 5: chat.feedback.correct"),
        ],
      },
      global: {
        stubs: {
          ThinkingFrame: thinkingFrameStub,
        },
      },
    });
    await flushPromises();

    const text = wrapper.text();
    expect(text).not.toContain("chat.feedback.incorrectWithAnswer");
    expect(text).not.toContain("chat.feedback.skipModality.speaking");
    expect(text).not.toContain("chat.feedback.correct");
    // 只断言最近两条预览可见（新设计只展示最近两条）
    expect(text).toContain("已跳过本题");
    expect(text).toContain("回答正确");
  });

  it("renders one ordered result slot for each judged question", () => {
    const wrapper = mount(FeedbackFrame, {
      props: {
        messages: [
          makeMessage("第一题", true),
          makeMessage("未评分提示"),
          makeMessage("第二题", false),
          makeMessage("第三题", true),
        ],
      },
      global: {
        stubs: {
          ThinkingFrame: thinkingFrameStub,
        },
      },
    });

    const slots = wrapper.findAll('[data-testid="feedback-outcome-slot"]');
    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.attributes("data-correct"))).toEqual([
      "true",
      "false",
      "true",
    ]);
  });

  it("translates system-sourced feedback keys", () => {
    const wrapper = mount(FeedbackFrame, {
      props: {
        messages: [
          {
            id: "sys-1",
            role: "feedback",
            source: "system",
            content: "chat.feedback.correct",
            timestamp: new Date().toISOString(),
          },
        ],
      },
      global: {
        stubs: {
          ThinkingFrame: thinkingFrameStub,
        },
      },
    });

    expect(wrapper.text()).not.toContain("chat.feedback.correct");
    expect(wrapper.text()).toContain("回答正确");
  });
});
