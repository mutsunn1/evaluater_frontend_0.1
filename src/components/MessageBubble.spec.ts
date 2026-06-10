import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MessageBubble from "./MessageBubble.vue";
import type { ChatMessage } from "@/types";

describe("MessageBubble 思考过程位置", () => {
  it("题目消息应在题目正文前显示思考摘要", () => {
    const message: ChatMessage = {
      id: "question-1",
      role: "question",
      content: "",
      timestamp: new Date().toISOString(),
      batch_questions: [
        {
          question_type: "multiple_choice",
          scene: "学习",
          grammar_focus: "把字句",
          target_level: "HSK3",
          question_text: "请选择正确的句子。",
          options: [{ index: "A", text: "我把作业做完了。" }],
          skill_dimension: "grammar",
        },
      ],
      thinking_steps: [
        {
          agent: "题目摘要",
          agent_key: "system",
          output: "本题围绕把字句的语序、结构和语义是否成立进行辨析。",
        },
      ],
    };

    const wrapper = mount(MessageBubble, {
      props: { message },
    });

    const text = wrapper.text();
    expect(text.indexOf("本题围绕把字句")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("本题围绕把字句")).toBeLessThan(
      text.indexOf("请选择正确的句子。")
    );
  });
});
