import { describe, expect, it, vi, afterEach } from 'vitest';
import { batchSubmitAnswer, streamQuestion } from './index';

function buildSseResponse(body: string) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200 },
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
    { status: 200 },
  );
}

describe('streamQuestion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('正式出题时应携带 question_request_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildSseResponse([
      'event: question',
      'data: {"item_id":1,"skill_dimension":"vocabulary","question":{"question_type":"multiple_choice","question_text":"你好吗？","options":[]},"batch_id":"batch-1","batch_index":0,"batch_total":1}',
      '',
      '',
    ].join('\n')));
    vi.stubGlobal('fetch', fetchMock);

    await streamQuestion('session-1', vi.fn(), undefined, 'request-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/sessions/session-1/question?request_id=request-1',
      { signal: undefined },
    );
  });

  it('应在 event 行和 data 行分属不同网络分块时仍解析 thinking 事件', async () => {
    const onThinking = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(buildChunkedSseResponse([
      'event: thinking\n',
      'data: {"agent":"thinking_coordinator","label":"智能体分析","output":"正在分析出题计划"}\n\n',
      'event: question\n',
      'data: {"item_id":1,"skill_dimension":"vocabulary","question":{"question_type":"multiple_choice","question_text":"你好吗？","options":[]},"batch_id":"batch-1","batch_index":0,"batch_total":1}\n\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);

    await streamQuestion('session-1', onThinking);

    expect(onThinking).toHaveBeenCalledWith({
      agent: 'thinking_coordinator',
      label: '智能体分析',
      output: '正在分析出题计划',
    });
  });
});

describe('batchSubmitAnswer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('批量提交答案时应携带 submission_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildSseResponse([
      'event: answer',
      'data: {"results":[],"confidence":0,"accuracy":0}',
      '',
      '',
    ].join('\n')));
    vi.stubGlobal('fetch', fetchMock);

    await batchSubmitAnswer(
      'session-1',
      [{ question_index: 0, answer: 'A' }],
      vi.fn(),
      undefined,
      'submission-1',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/sessions/session-1/batch_answer',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: 'submission-1',
          answers: [{ question_index: 0, answer: 'A' }],
        }),
        signal: undefined,
      },
    );
  });
});
