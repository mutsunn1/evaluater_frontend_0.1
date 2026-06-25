import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ThinkingSidebar from "./ThinkingSidebar.vue";
import type { ThinkingStep } from "@/types";

const steps: ThinkingStep[] = [
  {
    agent: "题目摘要",
    agent_key: "thinking_coordinator",
    output: "系统正在选择适合当前水平的语法题。",
  },
  {
    agent: "出题智能体",
    agent_key: "grammar_generator",
    output: "本题围绕把字句的语序、结构和语义是否成立进行辨析。",
  },
];

describe("ThinkingSidebar mobile full-screen", () => {
  it("hides drawer off-screen when closed", () => {
    const wrapper = mount(ThinkingSidebar, {
      props: { steps: [], isOpen: false },
    });

    // Drawer panel is off-screen via translate-x-full
    const drawer = wrapper.find(".fixed.right-0.top-0.z-50");
    expect(drawer.exists()).toBe(true);
    expect(drawer.classes()).toContain("translate-x-full");
    expect(drawer.classes()).not.toContain("translate-x-0");
  });

  it("renders backdrop overlay when open", () => {
    const wrapper = mount(ThinkingSidebar, {
      props: { steps, isOpen: true },
    });

    // Backdrop overlay exists
    const backdrop = wrapper.find(".fixed.inset-0.z-40");
    expect(backdrop.exists()).toBe(true);
  });

  it("renders drawer with full-width on mobile", () => {
    const wrapper = mount(ThinkingSidebar, {
      props: { steps, isOpen: true },
    });

    // The drawer panel uses w-full (full-width on mobile), sm:w-80 on desktop
    const drawer = wrapper.find(".fixed.right-0.top-0.z-50");
    expect(drawer.exists()).toBe(true);
    expect(drawer.classes()).toContain("w-full");
  });

  it("emits close when backdrop is clicked", async () => {
    const wrapper = mount(ThinkingSidebar, {
      props: { steps, isOpen: true },
    });

    const backdrop = wrapper.find(".fixed.inset-0.z-40");
    await backdrop.trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close when close button is clicked", async () => {
    const wrapper = mount(ThinkingSidebar, {
      props: { steps, isOpen: true },
    });

    const buttons = wrapper.findAll("button");
    // The close button is the one in the header
    const closeBtn = buttons.find((b) => b.classes().includes("text-gray-400"));
    expect(closeBtn).toBeTruthy();
    await closeBtn!.trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("renders all thinking step cards with agent names and output", () => {
    const wrapper = mount(ThinkingSidebar, {
      props: { steps, isOpen: true },
    });

    expect(wrapper.text()).toContain("Thinking Process");
    expect(wrapper.text()).toContain("题目摘要");
    expect(wrapper.text()).toContain("出题智能体");
    expect(wrapper.text()).toContain("系统正在选择适合当前水平的语法题。");
    expect(wrapper.text()).toContain(
      "本题围绕把字句的语序、结构和语义是否成立进行辨析。"
    );
  });

  it('title is visible as "思考过程"', () => {
    const wrapper = mount(ThinkingSidebar, {
      props: { steps, isOpen: true },
    });

    expect(wrapper.find("h3").text()).toBe("Thinking Process");
  });
});
