import { describe, expect, it } from "vitest";

import { createDefaultConfidence } from "./session";

describe("createDefaultConfidence", () => {
  it("初始化四个评测维度的轮次", () => {
    expect(createDefaultConfidence().dimension_rounds).toEqual({
      vocabulary: 0,
      grammar: 0,
      reading: 0,
      listening: 0,
      speaking: 0,
    });
  });
});
