const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

export async function createSession(userId: string): Promise<{ session_id: string; user_id: string; hsk_level: number }> {
  return fetchJson(`${BASE_URL}/api/v1/sessions?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
}

/** SSE stream: calls back on each thinking step and final question. */
export async function streamQuestion(
  sessionId: string,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
): Promise<{ item_id: number; question: Record<string, unknown> }> {
  const resp = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/question`);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = '';
    let dataLine = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        dataLine = line.slice(6);
        const parsed = JSON.parse(dataLine);
        if (eventType === 'thinking') {
          onThinking(parsed);
        } else if (eventType === 'question') {
          return parsed;
        } else if (eventType === 'error') {
          throw new Error(parsed.error || 'Stream error');
        }
      }
    }
  }
  throw new Error('Stream ended without question data');
}

export async function submitAnswer(sessionId: string, answer: string): Promise<Record<string, unknown>> {
  return fetchJson(`${BASE_URL}/api/v1/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

export async function endSession(sessionId: string): Promise<{ session_id: string; summary: Record<string, unknown> }> {
  return fetchJson(`${BASE_URL}/api/v1/sessions/${sessionId}/end`, { method: 'POST' });
}

export async function getEvents(sessionId: string) {
  return fetchJson(`${BASE_URL}/api/v1/sessions/${sessionId}/events`);
}

export async function getThinking(sessionId: string): Promise<{ steps: { agent: string; agent_key: string; output: string }[] }> {
  return fetchJson(`${BASE_URL}/api/v1/sessions/${sessionId}/thinking`);
}

export async function getConfidence(sessionId: string): Promise<{
  accuracy: number; ci_lower: number; ci_upper: number;
  confidence: number; sample_size: number;
  should_stop: boolean; stop_reason: string; remaining: number;
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
): Promise<{ cold_start: boolean; round: number; label: string; question: string } | { cold_start_complete: boolean; initial_vector: unknown }> {
  const resp = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/cold_start`);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const parsed = JSON.parse(line.slice(6));
        if (eventType === 'thinking') {
          onThinking(parsed);
        } else if (eventType === 'question') {
          return parsed;
        } else if (eventType === 'error') {
          throw new Error(parsed.error || 'Stream error');
        }
      }
    }
  }
  throw new Error('Stream ended without question data');
}

/** SSE stream for cold start answer evaluation. */
export async function streamColdStartAnswer(
  sessionId: string,
  answer: string,
  responseTime: number,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
): Promise<{ cold_start_complete: boolean; feedback: string; observer_output: string; grade_output: string; initial_vector?: unknown }> {
  const resp = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/cold_start_answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer, response_time: responseTime }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const parsed = JSON.parse(line.slice(6));
        if (eventType === 'thinking') {
          onThinking(parsed);
        } else if (eventType === 'answer') {
          return parsed;
        } else if (eventType === 'error') {
          throw new Error(parsed.error || 'Stream error');
        }
      }
    }
  }
  throw new Error('Stream ended without answer data');
}
