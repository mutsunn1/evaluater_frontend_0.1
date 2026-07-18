import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import QuestionRenderer from "./QuestionRenderer.vue";
import type { ItemData } from "@/types";

const speechRecorderStub = defineComponent({
  name: "SpeechRecorder",
  props: ["sessionId", "questionItemId"],
  setup() {
    return () => h("div", { class: "speech-recorder-stub" }, "SpeechRecorder");
  },
});

function makeItem(overrides: Partial<ItemData> = {}): ItemData {
  return {
    question_type: "multiple_choice",
    scene: "日常",
    grammar_focus: "名词",
    target_level: "HSK1",
    question_text: "请看图片，选择正确的水果。",
    options: [{ index: "A", text: "苹果" }],
    media: [
      {
        id: "img-1",
        type: "image",
        role: "prompt",
        source: "prepared",
        url: "https://example.com/apple.png",
        alt: "一个苹果",
      },
    ],
    ...overrides,
  };
}

function mountRenderer(item: ItemData) {
  return mount(QuestionRenderer, {
    props: { itemData: item, sessionId: "session-1" },
    global: {
      stubs: {
        SpeechRecorder: speechRecorderStub,
      },
    },
  });
}

describe("QuestionRenderer prompt media", () => {
  it("renders prompt image for multiple_choice questions", async () => {
    const wrapper = mountRenderer(makeItem());
    await flushPromises();

    const img = wrapper.find('img[alt="一个苹果"]');
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("https://example.com/apple.png");
  });

  it("renders prompt image for true_false questions", async () => {
    const wrapper = mountRenderer(
      makeItem({ question_type: "true_false", options: undefined })
    );
    await flushPromises();

    expect(wrapper.find('img[alt="一个苹果"]').exists()).toBe(true);
  });

  it("renders prompt image for fill_in_blank questions", async () => {
    const wrapper = mountRenderer(
      makeItem({ question_type: "fill_in_blank", options: undefined })
    );
    await flushPromises();

    expect(wrapper.find('img[alt="一个苹果"]').exists()).toBe(true);
  });

  it("renders prompt image for reading_comprehension questions", async () => {
    const wrapper = mountRenderer(
      makeItem({
        question_type: "reading_comprehension",
        options: undefined,
        reading_passage: "这是 passage。",
      })
    );
    await flushPromises();

    expect(wrapper.find('img[alt="一个苹果"]').exists()).toBe(true);
  });

  it("renders prompt image for speaking_response questions", async () => {
    const wrapper = mountRenderer(
      makeItem({
        question_type: "speaking_response",
        options: undefined,
      })
    );
    await flushPromises();

    expect(wrapper.find('img[alt="一个苹果"]').exists()).toBe(true);
  });
});

describe("QuestionRenderer response_mode dispatch", () => {
  it("explicit choice mode renders option buttons for bank question types", () => {
    // The v2 question bank uses question types like "listening_choice" that
    // the type-driven dispatch does not know; response_mode must win.
    const wrapper = mountRenderer(
      makeItem({
        question_type: "listening_choice" as ItemData["question_type"],
        response_mode: "choice",
        media: undefined,
        options: [
          { index: "A", text: "苹果" },
          { index: "B", text: "香蕉" },
        ],
      })
    );

    const buttons = wrapper.findAll("button");
    expect(buttons.some((b) => b.text().includes("苹果"))).toBe(true);
    expect(buttons.some((b) => b.text().includes("香蕉"))).toBe(true);
    expect(wrapper.find('input[type="text"]').exists()).toBe(false);
  });

  it("explicit choice mode takes precedence over fill_in_blank's text input", () => {
    const wrapper = mountRenderer(
      makeItem({
        question_type: "fill_in_blank",
        response_mode: "choice",
        media: undefined,
        options: [
          { index: "A", text: "苹果" },
          { index: "B", text: "香蕉" },
        ],
      })
    );

    expect(
      wrapper.findAll("button").some((b) => b.text().includes("香蕉"))
    ).toBe(true);
    expect(wrapper.find('input[type="text"]').exists()).toBe(false);
  });

  it("explicit text mode keeps the text input even when options exist", () => {
    const wrapper = mountRenderer(
      makeItem({
        question_type: "fill_in_blank",
        response_mode: "text",
        media: undefined,
      })
    );

    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
  });

  it("true_false keeps its dedicated renderer", () => {
    const wrapper = mountRenderer(
      makeItem({
        question_type: "true_false",
        response_mode: "choice",
        media: undefined,
        options: undefined,
      })
    );

    expect(wrapper.text()).toContain("True");
    expect(wrapper.text()).toContain("False");
  });
});
