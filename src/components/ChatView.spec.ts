import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatView from "./ChatView.vue";
import { batchSubmitAnswer, streamQuestion } from "@/api";
import { useSessionStore } from "@/stores/session";
import { SseError } from "@/types";

vi.mock("@/api", () => ({
  streamQuestion: vi.fn(),
  getConfidence: vi.fn(),
  streamColdStart: vi.fn(),
  streamColdStartAnswer: vi.fn(),
  streamSubmitAnswer: vi.fn(),
  batchSubmitAnswer: vi.fn(),
  endSession: vi.fn(),
}));

function mountChatView(
  pinia: ReturnType<typeof createPinia>,
  messageBubbleStub: unknown = true
) {
  return mount(ChatView, {
    global: {
      plugins: [pinia],
      stubs: {
        MessageBubble: messageBubbleStub,
        ThinkingFrame: true,
        FeedbackFrame: true,
        ConfidenceBar: true,
      },
    },
  });
}

function mountChatViewWithRealThinking(pinia: ReturnType<typeof createPinia>) {
  return mount(ChatView, {
    global: {
      plugins: [pinia],
      stubs: {
        ConfidenceBar: true,
      },
    },
  });
}

describe("ChatView SSE error display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    Element.prototype.scrollTo = vi.fn();
  });

  function setupFailedQuestion(retryable: boolean) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(streamQuestion).mockRejectedValueOnce(
      new SseError({
        code: "GENERATION_FAILED",
        message: "all generators failed",
        retryable,
      })
    );
    return { pinia, store };
  }

  it("可重试错误显示重试按钮", async () => {
    const { pinia, store } = setupFailedQuestion(true);
    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(store.streamError?.code).toBe("GENERATION_FAILED");
    expect(wrapper.text()).toContain("Question generation failed");
    expect(wrapper.find('button[data-testid="retry-question"]').exists()).toBe(
      true
    );
  });

  it("不可重试错误不显示重试按钮", async () => {
    const { pinia, store } = setupFailedQuestion(false);
    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(store.streamError?.code).toBe("GENERATION_FAILED");
    expect(wrapper.find('button[data-testid="retry-question"]').exists()).toBe(
      false
    );
  });

  it("网络错误显示顶部 Toast", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(streamQuestion).mockRejectedValueOnce(
      new SseError({
        code: "NETWORK_ERROR",
        message: "network interrupted",
        retryable: true,
      })
    );

    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(store.streamError?.code).toBe("NETWORK_ERROR");
    const toast = wrapper.find('[data-testid="network-error-toast"]');
    expect(toast.exists()).toBe(true);
    expect(toast.text()).toContain("Network connection interrupted");
  });

  it("显示 request_id 便于排查", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(streamQuestion).mockRejectedValueOnce(
      new SseError({
        code: "GENERATION_FAILED",
        message: "all generators failed",
        retryable: true,
        request_id: "req-debug-123",
      })
    );

    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("req-debug-123");
  });
});

describe("ChatView 正式出题重试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    Element.prototype.scrollTo = vi.fn();
  });

  it("正式出题失败后应局部重试并复用同一个 question_request_id", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(streamQuestion)
      .mockRejectedValueOnce(
        new SseError({
          code: "NETWORK_ERROR",
          message: "Failed to fetch",
          retryable: true,
        })
      )
      .mockResolvedValueOnce({
        batch_id: "batch-1",
        questions: [
          {
            question_type: "multiple_choice",
            scene: "日常",
            grammar_focus: "问候语",
            target_level: "HSK1",
            question_text: "你好吗？",
            options: [{ index: "A", text: "好" }],
            skill_dimension: "vocabulary",
          },
        ],
      });

    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("Network connection interrupted");
    const retryButton = wrapper.get('button[data-testid="retry-question"]');
    const firstRequestId = vi.mocked(streamQuestion).mock.calls[0][3];

    await retryButton.trigger("click");
    await flushPromises();

    expect(vi.mocked(streamQuestion)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(streamQuestion).mock.calls[1][3]).toBe(firstRequestId);
    expect(store.currentQuestions[0].question_text).toBe("你好吗？");
    expect(store.isWaitingAnswer).toBe(true);
  });

  it("crypto.randomUUID 不存在时仍应能生成 question_request_id", async () => {
    const originalRandomUUID = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });

    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(streamQuestion).mockRejectedValueOnce(
      new SseError({
        code: "NETWORK_ERROR",
        message: "Failed to fetch",
        retryable: true,
      })
    );

    try {
      mountChatView(pinia);
      await flushPromises();
    } finally {
      Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        value: originalRandomUUID,
      });
    }

    expect(vi.mocked(streamQuestion).mock.calls[0][3]).toEqual(
      expect.any(String)
    );
    expect(store.error).toBe("Failed to fetch");
    expect(store.streamError?.code).toBe("NETWORK_ERROR");
  });
});

describe("ChatView 实时思考气泡", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    Element.prototype.scrollTo = vi.fn();
  });

  it("正式出题过程中思考帧内联显示最近两条，弹窗显示完整链", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(streamQuestion).mockImplementation(
      async (_sessionId, onThinking) => {
        onThinking({
          agent: "thinking_coordinator",
          label: "出题规划摘要",
          output: "系统正在选择适合当前水平的语法题。",
        });
        onThinking({
          agent: "system",
          label: "题目摘要",
          output: "本题围绕把字句的语序、结构和语义是否成立进行辨析。",
        });
        onThinking({
          agent: "item_qa_agent",
          label: "质检智能体",
          output: "[grammar] 题目质量检查完成。",
        });
        onThinking({
          agent: "grammar_generator",
          label: "grammar出题",
          output: "[grammar] 题目生成完成。",
        });

        return new Promise(() => {});
      }
    );

    const wrapper = mountChatViewWithRealThinking(pinia);
    await flushPromises();

    // 头部显示标题与步骤数。
    expect(wrapper.text()).toContain("Thinking Process");
    expect(wrapper.text()).toContain("4 steps");

    // 内联预览只展示最近两条。
    expect(wrapper.text()).toContain("[grammar] 题目质量检查完成。");
    expect(wrapper.text()).toContain("[grammar] 题目生成完成。");

    // 点击头部打开弹窗，完整链在 body 中渲染。
    const toggle = wrapper
      .findComponent({ name: "ThinkingFrame" })
      .find("button");
    expect(toggle.exists()).toBe(true);
    await toggle.trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("本题围绕把字句");
    expect(document.body.textContent).toContain(
      "系统正在选择适合当前水平的语法题。"
    );

    wrapper.unmount();
  });

  it("收到第一道 question 事件时应立即显示题目，不等待 stream 结束", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(streamQuestion).mockImplementation(
      async (_sessionId, _onThinking, _signal, _requestId, onQuestion) => {
        onQuestion?.({
          question_type: "multiple_choice",
          scene: "日常",
          grammar_focus: "问候语",
          target_level: "HSK1",
          question_text: "你好吗？",
          options: [{ index: "A", text: "好" }],
          skill_dimension: "vocabulary",
        });

        return new Promise(() => {});
      }
    );

    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(store.currentQuestions[0].question_text).toBe("你好吗？");
    expect(store.isWaitingAnswer).toBe(true);
    expect(store.isLoading).toBe(false);
    expect(store.messages.some((msg) => msg.role === "question")).toBe(true);

    wrapper.unmount();
  });

  it("拉取下一题时不应把上一轮残留题目混入当前题目", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.currentQuestions = [
      {
        question_type: "multiple_choice",
        scene: "旧场景",
        grammar_focus: "旧词汇",
        target_level: "HSK1",
        question_text: "旧词汇题",
        options: [{ index: "A", text: "旧" }],
        skill_dimension: "vocabulary",
      },
      {
        question_type: "multiple_choice",
        scene: "旧场景",
        grammar_focus: "旧语法",
        target_level: "HSK1",
        question_text: "旧语法题",
        options: [{ index: "A", text: "旧" }],
        skill_dimension: "grammar",
      },
    ];
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(streamQuestion).mockImplementation(
      async (_sessionId, _onThinking, _signal, _requestId, onQuestion) => {
        const question = {
          question_type: "multiple_choice",
          scene: "阅读",
          grammar_focus: "阅读理解",
          target_level: "HSK3",
          question_text: "新阅读题",
          options: [{ index: "A", text: "新" }],
          skill_dimension: "reading",
        } as const;
        onQuestion?.(question);
        return {
          batch_id: "batch-new",
          questions: [question],
        };
      }
    );

    mountChatView(pinia);
    await flushPromises();

    expect(store.currentQuestions).toHaveLength(1);
    expect(store.currentQuestions[0].question_text).toBe("新阅读题");
    expect(store.currentQuestions[0].skill_dimension).toBe("reading");

    const questionMessage = store.messages.find(
      (msg) => msg.role === "question"
    );
    expect(questionMessage?.batch_questions).toHaveLength(1);
    expect(questionMessage?.batch_questions?.[0].question_text).toBe(
      "新阅读题"
    );
  });

  it("历史消息应能打开完整思考过程弹窗", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
      {
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
            agent: "Grammar Question",
            agent_key: "grammar_generator",
            output: "[grammar] Question generated.",
          },
        ],
      },
    ];

    const wrapper = mountChatViewWithRealThinking(pinia);
    await flushPromises();

    // 内联预览只展示最近两条。
    expect(wrapper.text()).toContain("Quality Check Agent");
    expect(wrapper.text()).toContain("Grammar Question");

    // 点击头部打开弹窗。
    const toggle = wrapper
      .findComponent({ name: "ThinkingFrame" })
      .find("button");
    expect(toggle.exists()).toBe(true);
    await toggle.trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("本题围绕把字句");
    expect(document.body.textContent).toContain("Thinking Process");
    expect(document.body.textContent).toContain("Quality Check Agent");
    expect(document.body.textContent).toContain("Grammar Question");
  });
});

describe("ChatView 批量提交幂等标识", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollTo = vi.fn();
  });

  it("批量提交答案时应生成 submission_id 并传给 API", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
      {
        id: "question",
        role: "question",
        content: "",
        timestamp: new Date().toISOString(),
        batch_questions: [
          {
            question_type: "multiple_choice",
            scene: "日常",
            grammar_focus: "问候语",
            target_level: "HSK1",
            question_text: "你好吗？",
            options: [{ index: "A", text: "好" }],
            skill_dimension: "vocabulary",
          },
        ],
      },
    ];
    store.currentQuestions = store.messages[1].batch_questions || [];
    store.isWaitingAnswer = true;

    vi.mocked(batchSubmitAnswer).mockResolvedValue({
      results: [
        { item_id: 1, is_correct: true, feedback: "chat.feedback.correct" },
      ],
      confidence: 0.2,
      accuracy: 100,
      auto_stop: false,
    });

    const wrapper = mountChatView(pinia, {
      template:
        "<button data-testid=\"submit-batch\" @click=\"$emit('batch-submit', [{ question_index: 0, answer: 'A' }])\">提交</button>",
      props: ["message"],
      emits: ["batch-submit"],
    });

    await wrapper.get('button[data-testid="submit-batch"]').trigger("click");
    await flushPromises();

    expect(vi.mocked(batchSubmitAnswer)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(batchSubmitAnswer).mock.calls[0][4]).toEqual(
      expect.any(String)
    );
  });

  it("批量提交答案后应把 thinking 结果保存在反馈消息中", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
      {
        id: "question",
        role: "question",
        content: "",
        timestamp: new Date().toISOString(),
        batch_questions: [
          {
            question_type: "multiple_choice",
            scene: "日常",
            grammar_focus: "问候语",
            target_level: "HSK1",
            question_text: "你好吗？",
            options: [{ index: "A", text: "好" }],
            skill_dimension: "vocabulary",
          },
        ],
      },
    ];
    store.currentQuestions = store.messages[1].batch_questions || [];
    store.isWaitingAnswer = true;

    vi.mocked(batchSubmitAnswer).mockImplementation(
      async (_sessionId, _answers, onThinking) => {
        onThinking({
          agent: "thinking_coordinator",
          label: "智能体分析",
          output: "用户答题后，系统正在综合观察与评分结果。",
        });
        return {
          results: [{ item_id: 1, is_correct: true, feedback: "回答正确！" }],
          confidence: 0.2,
          accuracy: 100,
          auto_stop: false,
        };
      }
    );

    const wrapper = mountChatView(pinia, {
      template:
        "<button data-testid=\"submit-batch\" @click=\"$emit('batch-submit', [{ question_index: 0, answer: 'A' }])\">提交</button>",
      props: ["message"],
      emits: ["batch-submit"],
    });

    await wrapper.get('button[data-testid="submit-batch"]').trigger("click");
    await flushPromises();

    const feedback = store.messages.find((msg) => msg.role === "feedback");
    expect(feedback?.thinking_steps).toEqual([
      {
        agent: "智能体分析",
        agent_key: "thinking_coordinator",
        output: "用户答题后，系统正在综合观察与评分结果。",
      },
    ]);
  });
});

describe("ChatView mobile bottom input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollTo = vi.fn();
  });

  it("renders input and send button when ready for user answer", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.isColdStart = false;
    store.isLoading = false;
    store.isWaitingAnswer = false;
    // Prevent auto-fetch watcher: messages.length > 1
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
      {
        id: "msg2",
        role: "system",
        content: "已准备",
        timestamp: new Date().toISOString(),
      },
    ];

    const wrapper = mountChatView(pinia);
    await flushPromises();

    const text = wrapper.text();
    const input = wrapper.find("input");
    expect(input.exists()).toBe(true);
    expect(input.attributes("placeholder")).toBe("Enter your answer...");

    // Send button should exist
    expect(text).toContain("Send");
  });

  it("shows waiting message when isWaitingAnswer is true", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.isColdStart = false;
    store.isLoading = false;
    store.isWaitingAnswer = true;
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
      {
        id: "msg2",
        role: "system",
        content: "已准备",
        timestamp: new Date().toISOString(),
      },
    ];

    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("Please answer in the question above");
  });

  it("shows loading message when isLoading is true", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.isColdStart = false;
    store.isLoading = true;
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
      {
        id: "msg2",
        role: "system",
        content: "已准备",
        timestamp: new Date().toISOString(),
      },
    ];

    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("Generating questions, please wait...");
  });

  it("renders input for cold start questions", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = "session-1";
    store.isColdStart = true;
    store.isLoading = false;
    store.messages = [
      {
        id: "welcome",
        role: "system",
        content: "开始评测",
        timestamp: new Date().toISOString(),
      },
      {
        id: "msg2",
        role: "system",
        content: "已准备",
        timestamp: new Date().toISOString(),
      },
    ];

    const wrapper = mountChatView(pinia);
    await flushPromises();

    const input = wrapper.find("input");
    expect(input.exists()).toBe(true);
    expect(input.attributes("placeholder")).toBe("Please answer briefly...");
  });
});
