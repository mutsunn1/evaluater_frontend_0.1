import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ConfidenceBar from "./ConfidenceBar.vue";
import type { ConfidenceStats } from "@/types";

function makeStats(overrides: Partial<ConfidenceStats> = {}): ConfidenceStats {
  return {
    accuracy: 85,
    ci_lower: 0.8,
    ci_upper: 0.9,
    confidence: 0.75,
    sample_size: 12,
    should_stop: false,
    stop_reason: "",
    remaining: 6,
    total_rounds: 8,
    min_rounds: 5,
    max_rounds: 18,
    dimension_rounds: { vocabulary: 3, grammar: 3, reading: 2, speaking: 0 },
    ...overrides,
  };
}

describe("ConfidenceBar mobile layout", () => {
  it("renders all dimension indicators and accuracy text without truncation", () => {
    const wrapper = mount(ConfidenceBar, {
      props: { stats: makeStats() },
    });

    const text = wrapper.text();
    expect(text).toContain("Vocabulary");
    expect(text).toContain("Grammar");
    expect(text).toContain("Reading");
    expect(text).toContain("Listening");
    expect(text).toContain("Speaking");
    expect(text).toContain("Accuracy");
    expect(text).toContain("Confidence");
    expect(text).toContain("85%");
    expect(text).toContain("75%");
  });

  it("renders the listening dimension round count from dimension_rounds", () => {
    const wrapper = mount(ConfidenceBar, {
      props: {
        stats: makeStats({
          dimension_rounds: {
            vocabulary: 3,
            grammar: 3,
            reading: 2,
            listening: 1,
            speaking: 0,
          },
        }),
      },
    });
    const text = wrapper.text();
    expect(text).toContain("Listening");
    expect(text).toContain("1R");
  });

  it("renders round progress", () => {
    const wrapper = mount(ConfidenceBar, {
      props: { stats: makeStats() },
    });

    expect(wrapper.text()).toContain("Round 8 / 18");
  });

  it("shows stop indicator when should_stop is true", () => {
    const wrapper = mount(ConfidenceBar, {
      props: { stats: makeStats({ should_stop: true }) },
    });

    expect(wrapper.text()).toContain("Evaluation complete");
  });

  it("renders nothing visible when no rounds have been played", () => {
    const wrapper = mount(ConfidenceBar, {
      props: {
        stats: makeStats({ total_rounds: 0, sample_size: 0 }),
      },
    });

    expect(wrapper.text()).toBe("");
  });
});
