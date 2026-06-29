import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ThinkingProcess from "./ThinkingProcess.vue";

describe("ThinkingProcess 思考气泡", () => {
  it("应优先显示具体题目摘要，而不是只显示最后两条完成状态", () => {
    const wrapper = mount(ThinkingProcess, {
      props: {
        steps: [
          {
            agent: "Question Planning Summary",
            agent_key: "thinking_coordinator",
            output: "系统正在选择适合当前水平的语法题。",
          },
          {
            agent: "Question Summary",
            agent_key: "system",
            output: "本题围绕把字句的语序、结构和语义是否成立进行辨析。",
          },
          {
            agent: "Quality Check Agent",
            agent_key: "item_qa_agent",
            output: "[grammar] Question quality check complete.",
          },
          {
            agent: "grammar Question",
            agent_key: "grammar_generator",
            output: "[grammar] Question generated.",
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("本题围绕把字句");
    expect(wrapper.text()).not.toContain(
      "[grammar] Question quality check complete."
    );
    expect(wrapper.text()).not.toContain("[grammar] Question generated.");
  });
});
