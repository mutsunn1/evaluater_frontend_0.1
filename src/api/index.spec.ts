import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  batchSubmitAnswer,
  streamQuestion,
  streamColdStart,
  createSession,
} from "./index";
import { SseError } from "@/types";
import { createPinia, setActivePinia } from "pinia";
import { useLocaleStore } from "@/stores/locale";

function buildSseResponse(
  body: string,
  options?: { status?: number; ok?: boolean }
) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: options?.status ?? 200 }
  );
}

function buildChunkedSseResponse(chunks: string[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    }),
    { status: 200 }
  );
}

function buildErrorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    text: async () => body,
  } as unknown as Response;
}

describe("streamQuestion", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("正式出题时应携带 question_request_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        buildSseResponse(
          [
            "event: question",
            'data: {"item_id":1,"skill_dimension":"vocabulary","question":{"question_type":"multiple_choice","question_text":"你好吗？","options":[]},"batch_id":"batch-1","batch_index":0,"batch_total":1}',
            "",
            "",
          ].join("\n")
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await streamQuestion("session-1", vi.fn(), undefined, "request-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sessions/session-1/question?request_id=request-1&locale=en",
      { signal: undefined }
    );
  });

  it("应在 event 行和 data 行分属不同网络分块时仍解析 thinking 事件", async () => {
    const onThinking = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        buildChunkedSseResponse([
          "event: thinking\n",
          'data: {"agent":"thinking_coordinator","label":"智能体分析","output":"正在分析出题计划"}\n\n',
          "event: question\n",
          'data: {"item_id":1,"skill_dimension":"vocabulary","question":{"question_type":"multiple_choice","question_text":"你好吗？","options":[]},"batch_id":"batch-1","batch_index":0,"batch_total":1}\n\n',
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    await streamQuestion("session-1", onThinking);

    expect(onThinking).toHaveBeenCalledWith({
      agent: "thinking_coordinator",
      label: "智能体分析",
      output: "正在分析出题计划",
    });
  });

  it("收到 question 事件时应立即调用 onQuestion 回调", async () => {
    const onQuestion = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        buildSseResponse(
          [
            "event: question",
            'data: {"item_id":1,"skill_dimension":"vocabulary","question":{"question_type":"multiple_choice","question_text":"你好吗？","options":[]},"batch_id":"batch-1","batch_index":0,"batch_total":1}',
            "",
            "",
          ].join("\n")
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamQuestion(
      "session-1",
      vi.fn(),
      undefined,
      "request-1",
      onQuestion
    );

    expect(onQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ question_text: "你好吗？" })
    );
    expect(result.questions[0].question_text).toBe("你好吗？");
  });

  it("应保留 listening skill_dimension", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        buildSseResponse(
          [
            "event: question",
            'data: {"item_id":1,"skill_dimension":"listening","question":{"question_type":"listening_comprehension","response_mode":"choice","question_text":"请听音频，选择正确答案。","options":[]},"batch_id":"batch-1","batch_index":0,"batch_total":1}',
            "",
            "",
          ].join("\n")
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamQuestion("session-1", vi.fn());

    expect(result.questions[0].skill_dimension).toBe("listening");
    expect(result.questions[0].question_type).toBe("listening_comprehension");
  });
});

describe("batchSubmitAnswer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("批量提交答案时应携带 submission_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        buildSseResponse(
          [
            "event: answer",
            'data: {"results":[],"confidence":0,"accuracy":0}',
            "",
            "",
          ].join("\n")
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await batchSubmitAnswer(
      "session-1",
      [{ question_index: 0, answer: "A" }],
      vi.fn(),
      undefined,
      "submission-1"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sessions/session-1/batch_answer?locale=en",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: "submission-1",
          answers: [{ question_index: 0, answer: "A" }],
        }),
        signal: undefined,
      }
    );
  });
});

describe("streamQuestion error handling", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("收到 error 事件时应抛出 SseError", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        buildSseResponse(
          [
            "event: error",
            'data: {"code":"GENERATION_FAILED","message":"all generators failed","retryable":true,"request_id":"req-1"}',
            "",
            "",
          ].join("\n")
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await streamQuestion("session-1", vi.fn());
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SseError);
    const err = caught as SseError;
    expect(err.code).toBe("GENERATION_FAILED");
    expect(err.message).toBe("all generators failed");
    expect(err.retryable).toBe(true);
    expect(err.requestId).toBe("req-1");
  });

  it("HTTP 错误应被包装为 SseError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(buildErrorResponse(500, "Internal Server Error"));
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await streamQuestion("session-1", vi.fn());
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SseError);
    expect((caught as SseError).code).toBe("HTTP_ERROR");
    expect((caught as SseError).retryable).toBe(true);
  });

  it("HTTP 429 应被包装为可重试的 RATE_LIMITED", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(buildErrorResponse(429, "too many requests"));
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await streamQuestion("session-1", vi.fn());
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SseError);
    expect((caught as SseError).code).toBe("RATE_LIMITED");
    expect((caught as SseError).retryable).toBe(true);
  });

  it("非 JSON 的 error 事件 data 不应被静默吞掉", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        buildSseResponse(
          ["event: error", "data: raw failure log", "", ""].join("\n")
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await streamQuestion("session-1", vi.fn());
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SseError);
    expect((caught as SseError).code).toBe("INTERNAL_ERROR");
    expect((caught as SseError).message).toBe("raw failure log");
  });
});

describe("createSession", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes current locale in query string", async () => {
    const localeStore = useLocaleStore();
    localeStore.setLocale("zh");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "s1", user_id: "u1", hsk_level: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createSession("u1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sessions?user_id=u1&locale=zh",
      expect.anything()
    );
  });

  it("defaults locale to en", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "s2", user_id: "u2", hsk_level: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createSession("u2");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sessions?user_id=u2&locale=en",
      expect.anything()
    );
  });

  it("passes include_listening/include_speaking when options are provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "s3", user_id: "u3", hsk_level: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createSession("u3", {
      includeListening: false,
      includeSpeaking: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sessions?user_id=u3&locale=en&include_listening=false&include_speaking=true",
      expect.anything()
    );
  });
});

describe("streamColdStart", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("应透传冷启动 question 事件的结构化题目字段", async () => {
    const payload = {
      cold_start: true,
      round: 2,
      phase: "diagnostic",
      label: "词汇诊断",
      question: "请选择正确的词语。\nA. 苹果\nB. 香蕉",
      item_id: "item-1",
      question_type: "multiple_choice",
      question_text: "请选择正确的词语。",
      options: [
        { index: "A", text: "苹果" },
        { index: "B", text: "香蕉" },
      ],
      skill_dimension: "vocabulary",
      response_mode: "choice",
      target_level: "HSK 4",
      media: [
        {
          id: "item-1-audio",
          type: "audio",
          role: "prompt",
          source: "prepared",
          url: "/media/item-1.mp3",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      buildSseResponse(
        ["event: question", `data: ${JSON.stringify(payload)}`, "", ""].join(
          "\n"
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamColdStart("session-1", vi.fn());

    expect(result).toMatchObject({
      cold_start: true,
      round: 2,
      label: "词汇诊断",
      question: payload.question,
      item_id: "item-1",
      question_type: "multiple_choice",
      question_text: "请选择正确的词语。",
      options: [
        { index: "A", text: "苹果" },
        { index: "B", text: "香蕉" },
      ],
      skill_dimension: "vocabulary",
      response_mode: "choice",
      target_level: "HSK 4",
      media: [
        expect.objectContaining({
          id: "item-1-audio",
          type: "audio",
          role: "prompt",
        }),
      ],
    });
  });

  it("应透传 cold_start_complete 事件", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildSseResponse(
        [
          "event: question",
          'data: {"cold_start_complete":true,"initial_vector":{"vocabulary":0.5}}',
          "",
          "",
        ].join("\n")
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamColdStart("session-1", vi.fn());

    expect(result).toMatchObject({
      cold_start_complete: true,
      initial_vector: { vocabulary: 0.5 },
    });
  });
});
