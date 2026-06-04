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
