import type { ItemData } from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  return resp.json();
}

type SsePayload = Record<string, unknown>;

async function readSseEvents(
  resp: Response,
  onEvent: (eventType: string, parsed: SsePayload) => boolean | void,
) {
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = 'message';
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventType = 'message';
      return true;
    }
    const data = dataLines.join('\n');
    dataLines = [];
    const currentType = eventType;
    eventType = 'message';

    let parsed: SsePayload;
    try {
      parsed = JSON.parse(data);
    } catch {
      return true;
    }
    return onEvent(currentType, parsed) !== false;
  };

  const processLine = (rawLine: string) => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') return dispatch();
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
      return true;
    }
    if (line.startsWith('data: ')) {
      dataLines.push(line.slice(6));
      return true;
    }
    return true;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!processLine(line)) return;
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    processLine(buffer);
  }
  dispatch();
}

export async function createSession(userId: string): Promise<{ session_id: string; user_id: string; hsk_level: number }> {
  return fetchJson(`${BASE_URL}/api/v1/sessions?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
}

/** SSE stream: calls back on each thinking step and final question.
 *  Collects all questions from a batch before returning. */
export async function streamQuestion(
  sessionId: string,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal,
  requestId?: string,
): Promise<{ questions: ItemData[]; batch_id: string }> {
  const requestQuery = requestId ? `?request_id=${encodeURIComponent(requestId)}` : '';
  const resp = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/question${requestQuery}`, { signal });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  const questions: ItemData[] = [];
  let batchId = '';

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === 'thinking') {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === 'question') {
      const qData = (parsed.question as Record<string, unknown>) || {};
      questions.push({
        ...qData,
        batch_id: parsed.batch_id as string,
        batch_index: parsed.batch_index as number,
        batch_total: parsed.batch_total as number,
        skill_dimension: parsed.skill_dimension as 'vocabulary' | 'grammar' | 'reading',
      } as ItemData);
      batchId = (parsed.batch_id as string) || batchId;
    } else if (eventType === 'error') {
      throw new Error((parsed.error as string) || 'Stream error');
    }
  });

  if (questions.length === 0) {
    throw new Error('Stream ended without question data');
  }
  return { questions, batch_id: batchId };
}

export async function endSession(sessionId: string): Promise<{ session_id: string; summary: Record<string, unknown> }> {
  return fetchJson(`${BASE_URL}/api/v1/sessions/${sessionId}/end`, { method: 'POST' });
}

/** SSE streaming batch answer evaluation. Streams thinking steps and per-question feedback. */
export async function batchSubmitAnswer(
  sessionId: string,
  answers: Array<{ question_index: number; answer: string }>,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal,
  submissionId?: string,
): Promise<{ results: Array<Record<string, unknown>>; confidence: number; accuracy: number; auto_stop?: boolean; stop_reason?: string }> {
  const resp = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/batch_answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(submissionId ? { submission_id: submissionId } : {}), answers }),
    signal,
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  let answerData: { results: Array<Record<string, unknown>>; confidence: number; accuracy: number; auto_stop?: boolean; stop_reason?: string } | null = null;

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === 'thinking') {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === 'answer') {
      answerData = parsed as { results: Array<Record<string, unknown>>; confidence: number; accuracy: number; auto_stop?: boolean; stop_reason?: string };
      return false;
    } else if (eventType === 'error') {
      throw new Error((parsed.error as string) || 'Stream error');
    }
    return true;
  });

  if (answerData) {
    return answerData;
  }
  throw new Error('Stream ended without answer data');
}

/** SSE stream for answer evaluation with thinking steps. */
export async function streamSubmitAnswer(
  sessionId: string,
  answer: string,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal,
): Promise<{ item_id: number; is_correct: boolean; feedback: string; confidence: number; accuracy: number; auto_stop?: boolean; stop_reason?: string }> {
  const resp = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/stream_answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
    signal,
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  let answerData: { item_id: number; is_correct: boolean; feedback: string; confidence: number; accuracy: number; auto_stop?: boolean; stop_reason?: string } | null = null;

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === 'thinking') {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === 'answer') {
      answerData = parsed as { item_id: number; is_correct: boolean; feedback: string; confidence: number; accuracy: number; auto_stop?: boolean; stop_reason?: string };
      return false;
    } else if (eventType === 'error') {
      throw new Error((parsed.error as string) || 'Stream error');
    }
    return true;
  });

  if (answerData) {
    return answerData;
  }
  throw new Error('Stream ended without answer data');
}

export async function getConfidence(sessionId: string): Promise<{
  accuracy: number; ci_lower: number; ci_upper: number;
  confidence: number; sample_size: number;
  should_stop: boolean; stop_reason: string; remaining: number;
  total_rounds: number; min_rounds: number; max_rounds: number;
  dimension_rounds: { vocabulary: number; grammar: number; reading: number };
}> {
  return fetchJson(`${BASE_URL}/api/v1/sessions/${sessionId}/confidence`);
}

export async function getUserProfile(userId: string) {
  return fetchJson(`${BASE_URL}/api/v1/users/${userId}/profile`);
}

/** SSE stream for cold start questions with thinking steps. */
export async function streamColdStart(
  sessionId: string,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal,
): Promise<{ cold_start: boolean; round: number; label: string; question: string } | { cold_start_complete: boolean; initial_vector: unknown }> {
  const resp = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/cold_start`, { signal });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  let questionData: { cold_start: boolean; round: number; label: string; question: string } | { cold_start_complete: boolean; initial_vector: unknown } | null = null;

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === 'thinking') {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === 'question') {
      questionData = parsed as { cold_start: boolean; round: number; label: string; question: string } | { cold_start_complete: boolean; initial_vector: unknown };
      return false;
    } else if (eventType === 'error') {
      throw new Error((parsed.error as string) || 'Stream error');
    }
    return true;
  });

  if (questionData) {
    return questionData;
  }
  throw new Error('Stream ended without question data');
}

/** SSE stream for cold start answer evaluation. */
export async function streamColdStartAnswer(
  sessionId: string,
  answer: string,
  responseTime: number,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal,
): Promise<{ cold_start_complete: boolean; feedback: string; observer_output: string; grade_output: string; initial_vector?: unknown }> {
  const resp = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/cold_start_answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer, response_time: responseTime }),
    signal,
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  let answerData: { cold_start_complete: boolean; feedback: string; observer_output: string; grade_output: string; initial_vector?: unknown } | null = null;

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === 'thinking') {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === 'answer') {
      answerData = parsed as { cold_start_complete: boolean; feedback: string; observer_output: string; grade_output: string; initial_vector?: unknown };
      return false;
    } else if (eventType === 'error') {
      throw new Error((parsed.error as string) || 'Stream error');
    }
    return true;
  });

  if (answerData) {
    return answerData;
  }
  throw new Error('Stream ended without answer data');
}
