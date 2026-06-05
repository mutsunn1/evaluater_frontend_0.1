import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatView from './ChatView.vue';
import { batchSubmitAnswer, streamQuestion } from '@/api';
import { useSessionStore } from '@/stores/session';

vi.mock('@/api', () => ({
  streamQuestion: vi.fn(),
  getConfidence: vi.fn(),
  streamColdStart: vi.fn(),
  streamColdStartAnswer: vi.fn(),
  streamSubmitAnswer: vi.fn(),
  batchSubmitAnswer: vi.fn(),
  endSession: vi.fn(),
}));

function mountChatView(pinia: ReturnType<typeof createPinia>, messageBubbleStub: unknown = true) {
  return mount(ChatView, {
    global: {
      plugins: [pinia],
      stubs: {
        MessageBubble: messageBubbleStub,
        ThinkingSidebar: true,
        ConfidenceBar: true,
      },
    },
  });
}

describe('ChatView 正式出题重试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    Element.prototype.scrollTo = vi.fn();
  });

  it('正式出题失败后应局部重试并复用同一个 question_request_id', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = 'session-1';
    store.messages = [{
      id: 'welcome',
      role: 'system',
      content: '开始评测',
      timestamp: new Date().toISOString(),
    }];

    vi.mocked(streamQuestion)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        batch_id: 'batch-1',
        questions: [{
          question_type: 'multiple_choice',
          scene: '日常',
          grammar_focus: '问候语',
          target_level: 'HSK1',
          question_text: '你好吗？',
          options: [{ index: 'A', text: '好' }],
          skill_dimension: 'vocabulary',
        }],
      });

    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain('Failed to fetch');
    const retryButton = wrapper.get('button[data-testid="retry-question"]');
    const firstRequestId = vi.mocked(streamQuestion).mock.calls[0][3];

    await retryButton.trigger('click');
    await flushPromises();

    expect(vi.mocked(streamQuestion)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(streamQuestion).mock.calls[1][3]).toBe(firstRequestId);
    expect(store.currentQuestions[0].question_text).toBe('你好吗？');
    expect(store.isWaitingAnswer).toBe(true);
  });
});

describe('ChatView 实时思考气泡', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    Element.prototype.scrollTo = vi.fn();
  });

  it('正式出题过程中应优先显示具体题目摘要', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = 'session-1';
    store.messages = [{
      id: 'welcome',
      role: 'system',
      content: '开始评测',
      timestamp: new Date().toISOString(),
    }];

    vi.mocked(streamQuestion).mockImplementation(async (_sessionId, onThinking) => {
      onThinking({
        agent: 'thinking_coordinator',
        label: '出题规划摘要',
        output: '系统正在选择适合当前水平的语法题。',
      });
      onThinking({
        agent: 'system',
        label: '题目摘要',
        output: '本题围绕把字句的语序、结构和语义是否成立进行辨析。',
      });
      onThinking({
        agent: 'item_qa_agent',
        label: '质检智能体',
        output: '[grammar] 题目质量检查完成。',
      });
      onThinking({
        agent: 'grammar_generator',
        label: 'grammar出题',
        output: '[grammar] 题目生成完成。',
      });

      return new Promise(() => {});
    });

    const wrapper = mountChatView(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain('本题围绕把字句');
    expect(wrapper.text()).not.toContain('[grammar] 题目质量检查完成。');
    expect(wrapper.text()).not.toContain('[grammar] 题目生成完成。');

    wrapper.unmount();
  });
});

describe('ChatView 批量提交幂等标识', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollTo = vi.fn();
  });

  it('批量提交答案时应生成 submission_id 并传给 API', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = 'session-1';
    store.messages = [
      { id: 'welcome', role: 'system', content: '开始评测', timestamp: new Date().toISOString() },
      {
        id: 'question',
        role: 'question',
        content: '',
        timestamp: new Date().toISOString(),
        batch_questions: [{
          question_type: 'multiple_choice',
          scene: '日常',
          grammar_focus: '问候语',
          target_level: 'HSK1',
          question_text: '你好吗？',
          options: [{ index: 'A', text: '好' }],
          skill_dimension: 'vocabulary',
        }],
      },
    ];
    store.currentQuestions = store.messages[1].batch_questions || [];
    store.isWaitingAnswer = true;

    vi.mocked(batchSubmitAnswer).mockResolvedValue({
      results: [{ item_id: 1, is_correct: true, feedback: '回答正确！' }],
      confidence: 0.2,
      accuracy: 100,
      auto_stop: false,
    });

    const wrapper = mountChatView(pinia, {
      template: '<button data-testid="submit-batch" @click="$emit(\'batch-submit\', [{ question_index: 0, answer: \'A\' }])">提交</button>',
      props: ['message'],
      emits: ['batch-submit'],
    });

    await wrapper.get('button[data-testid="submit-batch"]').trigger('click');
    await flushPromises();

    expect(vi.mocked(batchSubmitAnswer)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(batchSubmitAnswer).mock.calls[0][4]).toEqual(expect.any(String));
  });

  it('批量提交答案后应把 thinking 结果保存在反馈消息中', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSessionStore();
    store.sessionId = 'session-1';
    store.messages = [
      { id: 'welcome', role: 'system', content: '开始评测', timestamp: new Date().toISOString() },
      {
        id: 'question',
        role: 'question',
        content: '',
        timestamp: new Date().toISOString(),
        batch_questions: [{
          question_type: 'multiple_choice',
          scene: '日常',
          grammar_focus: '问候语',
          target_level: 'HSK1',
          question_text: '你好吗？',
          options: [{ index: 'A', text: '好' }],
          skill_dimension: 'vocabulary',
        }],
      },
    ];
    store.currentQuestions = store.messages[1].batch_questions || [];
    store.isWaitingAnswer = true;

    vi.mocked(batchSubmitAnswer).mockImplementation(async (_sessionId, _answers, onThinking) => {
      onThinking({
        agent: 'thinking_coordinator',
        label: '智能体分析',
        output: '用户答题后，系统正在综合观察与评分结果。',
      });
      return {
        results: [{ item_id: 1, is_correct: true, feedback: '回答正确！' }],
        confidence: 0.2,
        accuracy: 100,
        auto_stop: false,
      };
    });

    const wrapper = mountChatView(pinia, {
      template: '<button data-testid="submit-batch" @click="$emit(\'batch-submit\', [{ question_index: 0, answer: \'A\' }])">提交</button>',
      props: ['message'],
      emits: ['batch-submit'],
    });

    await wrapper.get('button[data-testid="submit-batch"]').trigger('click');
    await flushPromises();

    const feedback = store.messages.find(msg => msg.role === 'feedback');
    expect(feedback?.thinking_steps).toEqual([{
      agent: '智能体分析',
      agent_key: 'thinking_coordinator',
      output: '用户答题后，系统正在综合观察与评分结果。',
    }]);
  });
});
