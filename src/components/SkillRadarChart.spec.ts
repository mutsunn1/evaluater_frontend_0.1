import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import SkillRadarChart from "./SkillRadarChart.vue";
import type { UserProfileData } from "@/types";

const mockRender = vi.fn();
const mockUpdate = vi.fn();
const mockDestroy = vi.fn();

vi.mock("vue-chartjs", () => ({
  Radar: defineComponent({
    name: "Radar",
    props: ["data", "options"],
    emits: ["chart:render", "chart:update", "chart:destroy"],
    setup(props, { emit }) {
      return () =>
        h("canvas", {
          class: "chartjs-canvas",
          "data-labels": JSON.stringify(props.data?.labels ?? []),
          "data-values": JSON.stringify(
            props.data?.datasets?.[0]?.data ?? []
          ),
        });
    },
  }),
}));

function makeSkillLevels(
  overrides: Partial<NonNullable<UserProfileData["skill_levels"]>> = {}
): NonNullable<UserProfileData["skill_levels"]> {
  return {
    hsk: 60,
    vocabulary: 55,
    grammar: 45,
    reading: 50,
    listening: 30,
    speaking: 20,
    ...overrides,
  };
}

describe("SkillRadarChart", () => {
  it("renders a canvas with skill labels", () => {
    const wrapper = mount(SkillRadarChart, {
      props: { skillLevels: makeSkillLevels() },
    });

    const canvas = wrapper.find("canvas");
    expect(canvas.exists()).toBe(true);

    const labels = JSON.parse(
      wrapper.find("canvas").attributes("data-labels") ?? "[]"
    );
    expect(labels).toContain("Vocabulary");
    expect(labels).toContain("Grammar");
    expect(labels).toContain("Reading");
    expect(labels).toContain("Listening");
    expect(labels).toContain("Speaking");
  });

  it("passes skill values in dimension order", () => {
    const wrapper = mount(SkillRadarChart, {
      props: {
        skillLevels: makeSkillLevels({
          vocabulary: 10,
          grammar: 20,
          reading: 30,
          listening: 40,
          speaking: 50,
        }),
      },
    });

    const values = JSON.parse(
      wrapper.find("canvas").attributes("data-values") ?? "[]"
    );
    expect(values).toEqual([10, 20, 30, 40, 50]);
  });

  it("does not render when all skill values are zero", () => {
    const wrapper = mount(SkillRadarChart, {
      props: {
        skillLevels: makeSkillLevels({
          vocabulary: 0,
          grammar: 0,
          reading: 0,
          listening: 0,
          speaking: 0,
        }),
      },
    });

    expect(wrapper.find("canvas").exists()).toBe(false);
    expect(wrapper.text()).toContain("No data");
  });

});
