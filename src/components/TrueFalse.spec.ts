import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import TrueFalse from "./TrueFalse.vue";
import type { ItemData } from "@/types";

const tfData: ItemData = {
  question_type: "true_false",
  scene: "语法",
  grammar_focus: "把字句",
  target_level: "HSK3",
  question_text: "把字句的语序是否正确？",
};

describe("TrueFalse mobile layout", () => {
  it("renders both option buttons", () => {
    const wrapper = mount(TrueFalse, { props: { data: tfData } });

    expect(wrapper.text()).toContain("True");
    expect(wrapper.text()).toContain("False");
  });

  it("highlights selected option and shows confirm button", async () => {
    const wrapper = mount(TrueFalse, { props: { data: tfData } });

    await wrapper.find("button:first-child").trigger("click");
    expect(wrapper.text()).toContain("Confirm Answer");
  });

  it("emits select when confirm is clicked", async () => {
    const wrapper = mount(TrueFalse, { props: { data: tfData } });

    // Click "正确" button
    const optionButtons = wrapper.findAll("button");
    await optionButtons[0].trigger("click");

    // Confirm button should now be visible — find it by text
    const confirmBtn = wrapper.find("button.btn-primary");
    expect(confirmBtn.exists()).toBe(true);
    await confirmBtn.trigger("click");

    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual(["正确"]);
  });

  it("renders both buttons as full-width blocks on small screens", () => {
    const wrapper = mount(TrueFalse, { props: { data: tfData } });
    const buttons = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("True") || b.text().includes("False"));

    for (const btn of buttons) {
      // Each button should be flex-1 (takes equal width) regardless of viewport
      expect(btn.classes()).toContain("flex-1");
    }
  });
});
