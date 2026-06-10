import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MessageBubble from "./MessageBubble.vue";
import type { ChatMessage } from "@/types";

function makeChoiceQuestion(
  overrides: Partial<
    ChatMessage["batch_questions"] extends (infer T)[] | undefined ? T : never
  > = {}
): ChatMessage {
  return {
    id: "q-1",
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
        ...overrides,
      },
    ],
  };
}

describe("MessageBubble 向后兼容：response_mode 缺失时推断渲染路径", () => {
  it("无 response_mode 的 multiple_choice 题应渲染为选择按钮，而非文本输入", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({ question_type: "multiple_choice" }),
      },
    });
    // 选项按钮应当存在
    const buttons = wrapper.findAll("button");
    const optionButtons = buttons.filter((b) =>
      b.text().includes("我把作业做完了。")
    );
    expect(optionButtons.length).toBeGreaterThanOrEqual(1);
    // 不能出现文本输入框
    expect(wrapper.find('input[type="text"]').exists()).toBe(false);
  });

  it("无 response_mode 的 multiple_select 题应渲染为多选按钮", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({
          question_type: "multiple_select",
          question_text: "选出正确的句子。",
          options: [
            { index: "A", text: "选项一" },
            { index: "B", text: "选项二" },
          ],
        }),
      },
    });
    const text = wrapper.text();
    expect(text).toContain("多选题");
    expect(text).toContain("选项一");
    expect(text).toContain("选项二");
    expect(wrapper.find('input[type="text"]').exists()).toBe(false);
  });

  it("无 response_mode 的 true_false 题应渲染为正确/错误按钮", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({
          question_type: "true_false",
          question_text: "太阳从西边升起。",
          options: undefined,
        }),
      },
    });
    const text = wrapper.text();
    expect(text).toContain("正确");
    expect(text).toContain("错误");
    expect(wrapper.find('input[type="text"]').exists()).toBe(false);
  });

  it("无 response_mode 的 fill_in_blank 题应渲染为文本输入", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({
          question_type: "fill_in_blank",
          question_text: "请填入正确的词语。",
          options: undefined,
        }),
      },
    });
    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
  });
});

describe("MessageBubble 媒体选项渲染", () => {
  it("带 media_id 的选项应渲染媒体图片组件", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({
          question_type: "multiple_choice",
          media: [
            {
              id: "media-001",
              type: "image",
              role: "option",
              source: "prepared",
              url: "https://example.com/dog.jpg",
              alt: "一只狗",
            },
          ],
          options: [
            { index: "A", text: "狗", media_id: "media-001" },
            { index: "B", text: "猫" },
          ],
        }),
      },
    });
    const text = wrapper.text();
    expect(text).toContain("狗");
    expect(text).toContain("猫");
    // 带 media_id 的选项应渲染图片
    const img = wrapper.find('img[src="https://example.com/dog.jpg"]');
    expect(img.exists()).toBe(true);
  });

  it("媒体选项被点击时应记录 option.index 作为答案", async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({
          question_type: "multiple_choice",
          media: [
            {
              id: "media-001",
              type: "image",
              role: "option",
              source: "prepared",
              url: "https://example.com/dog.jpg",
              alt: "一只狗",
            },
          ],
          options: [
            { index: "A", text: "狗", media_id: "media-001" },
            { index: "B", text: "猫" },
          ],
        }),
      },
    });
    // 点击带 media_id 的选项
    const buttons = wrapper.findAll("button");
    const optionA = buttons.find((b) => b.text().includes("狗"));
    expect(optionA).toBeTruthy();
    await optionA!.trigger("click");
    // 确认选项 A 被选中（高亮样式）
    const updatedA = wrapper.find("button.border-blue-500");
    expect(updatedA.exists()).toBe(true);
    expect(updatedA.text()).toContain("狗");
  });

  it("同时有 text 和 media_id 的选项两者都应显示", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({
          question_type: "multiple_choice",
          media: [
            {
              id: "media-001",
              type: "image",
              role: "option",
              source: "prepared",
              url: "https://example.com/dog.jpg",
              alt: "一只狗",
            },
          ],
          options: [{ index: "A", text: "这是一只狗", media_id: "media-001" }],
        }),
      },
    });
    const text = wrapper.text();
    expect(text).toContain("这是一只狗");
    const img = wrapper.find('img[src="https://example.com/dog.jpg"]');
    expect(img.exists()).toBe(true);
  });
  it("media_id 找不到匹配资产时不渲染媒体，不崩溃，保留文本兜底", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({
          question_type: "multiple_choice",
          // 没有提供 media 数组，但选项有 media_id
          options: [
            { index: "A", text: "狗", media_id: "media-001" },
            { index: "B", text: "猫" },
          ],
        }),
      },
    });
    const text = wrapper.text();
    expect(text).toContain("狗");
    expect(text).toContain("猫");
    // 不应该渲染任何媒体组件
    const imgs = wrapper.findAll("img");
    expect(imgs.length).toBe(0);
  });

  it("media_id 指向不存在资产时，多选分支不崩溃并保留文本兜底", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: makeChoiceQuestion({
          question_type: "multiple_select",
          question_text: "选出与图片匹配的词。",
          options: [
            { index: "A", text: "苹果", media_id: "media-missing" },
            { index: "B", text: "香蕉" },
          ],
        }),
      },
    });
    const text = wrapper.text();
    expect(text).toContain("苹果");
    expect(text).toContain("香蕉");
    expect(wrapper.find("img").exists()).toBe(false);
  });
});

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
