import { useLocaleStore } from "@/stores/locale";
import {
  SseError,
  type ItemData,
  type BatchAnswerPayload,
  type SseErrorPayload,
} from "@/types";

const BASE_URL = import.meta.env.VITE_API_URL || "";

function createSseError(payload: SseErrorPayload): SseError {
  return new SseError(payload);
}

function wrapHttpError(resp: Response, body: string): SseError {
  const message = `API ${resp.status}: ${body}`;
  if (resp.status === 401 || resp.status === 403) {
    return createSseError({
      code: "SESSION_NOT_FOUND",
      message,
      retryable: false,
    });
  }
  if (resp.status === 429) {
    return createSseError({
      code: "RATE_LIMITED",
      message,
      retryable: true,
    });
  }
  return createSseError({
    code: "HTTP_ERROR",
    message,
    retryable: resp.status >= 500 || resp.status === 0,
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw wrapHttpError(resp, body);
  }
  return resp.json();
}

function parseSseErrorPayload(data: string): SseErrorPayload {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data);
  } catch {
    return { code: "INTERNAL_ERROR", message: data || "Stream error" };
  }

  if (typeof parsed.error === "string") {
    return {
      code: parsed.code || "INTERNAL_ERROR",
      message: parsed.error,
      retryable: !!parsed.retryable,
      request_id:
        typeof parsed.request_id === "string" ? parsed.request_id : undefined,
    };
  }

  return {
    code: (parsed.code as string) || "INTERNAL_ERROR",
    message: (parsed.message as string) || "Stream error",
    retryable: !!parsed.retryable,
    request_id:
      typeof parsed.request_id === "string" ? parsed.request_id : undefined,
  };
}

type SsePayload = Record<string, unknown>;

async function readSseEvents(
  resp: Response,
  onEvent: (eventType: string, parsed: SsePayload) => boolean | void
) {
  if (!resp.body) {
    throw new SseError({
      code: "NETWORK_ERROR",
      message: "No response body",
      retryable: true,
    });
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "message";
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventType = "message";
      return true;
    }
    const data = dataLines.join("\n");
    dataLines = [];
    const currentType = eventType;
    eventType = "message";

    let parsed: SsePayload;
    try {
      parsed = JSON.parse(data);
    } catch {
      if (currentType === "error") {
        throw new SseError({
          code: "INTERNAL_ERROR",
          message: data || "Stream error",
          retryable: false,
        });
      }
      return true;
    }
    return onEvent(currentType, parsed) !== false;
  };

  const processLine = (rawLine: string) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line === "") return dispatch();
    if (line.startsWith("event: ")) {
      eventType = line.slice(7).trim();
      return true;
    }
    if (line.startsWith("data: ")) {
      dataLines.push(line.slice(6));
      return true;
    }
    return true;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!processLine(line)) return;
      }
    }

    buffer += decoder.decode();
    if (buffer) {
      processLine(buffer);
    }
    dispatch();
  } catch (e) {
    if (e instanceof SseError) throw e;
    throw new SseError({
      code: "NETWORK_ERROR",
      message: e instanceof Error ? e.message : "Stream read failed",
      retryable: true,
    });
  }
}

export async function createSession(
  userId: string
): Promise<{ session_id: string; user_id: string; hsk_level: number }> {
  const locale = useLocaleStore().locale;
  return fetchJson(
    `${BASE_URL}/api/v1/sessions?user_id=${encodeURIComponent(userId)}&locale=${encodeURIComponent(locale)}`,
    { method: "POST" }
  );
}

/** SSE stream: calls back on each thinking step and final question.
 *  Collects all questions from a batch before returning. */
export async function streamQuestion(
  sessionId: string,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal,
  requestId?: string,
  onQuestion?: (question: ItemData) => void
): Promise<{ questions: ItemData[]; batch_id: string }> {
  const locale = useLocaleStore().locale;
  const requestQuery = requestId
    ? `?request_id=${encodeURIComponent(requestId)}&locale=${encodeURIComponent(locale)}`
    : `?locale=${encodeURIComponent(locale)}`;
  const resp = await fetch(
    `${BASE_URL}/api/v1/sessions/${sessionId}/question${requestQuery}`,
    { signal }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw wrapHttpError(resp, body);
  }
  const questions: ItemData[] = [];
  let batchId = "";

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === "thinking") {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === "question") {
      const qData = (parsed.question as Record<string, unknown>) || {};
      const question = {
        ...qData,
        batch_id: parsed.batch_id as string,
        batch_index: parsed.batch_index as number,
        batch_total: parsed.batch_total as number,
        skill_dimension: parsed.skill_dimension as
          "vocabulary" | "grammar" | "reading" | "listening" | "speaking",
      } as ItemData;
      questions.push(question);
      onQuestion?.(question);
      batchId = (parsed.batch_id as string) || batchId;
    } else if (eventType === "error") {
      throw createSseError(parseSseErrorPayload(JSON.stringify(parsed)));
    }
  });

  if (questions.length === 0) {
    throw createSseError({
      code: "GENERATION_FAILED",
      message: "Stream ended without question data",
      retryable: true,
    });
  }
  return { questions, batch_id: batchId };
}

export async function endSession(
  sessionId: string
): Promise<{ session_id: string; summary: Record<string, unknown> }> {
  return fetchJson(`${BASE_URL}/api/v1/sessions/${sessionId}/end`, {
    method: "POST",
  });
}

/** SSE streaming batch answer evaluation. Streams thinking steps and per-question feedback. */
export async function batchSubmitAnswer(
  sessionId: string,
  answers: BatchAnswerPayload[],
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal,
  submissionId?: string
): Promise<{
  results: Array<Record<string, unknown>>;
  confidence: number;
  accuracy: number;
  auto_stop?: boolean;
  stop_reason?: string;
}> {
  const resp = await fetch(
    `${BASE_URL}/api/v1/sessions/${sessionId}/batch_answer?locale=${encodeURIComponent(useLocaleStore().locale)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(submissionId ? { submission_id: submissionId } : {}),
        answers,
      }),
      signal,
    }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw wrapHttpError(resp, body);
  }
  let answerData: {
    results: Array<Record<string, unknown>>;
    confidence: number;
    accuracy: number;
    auto_stop?: boolean;
    stop_reason?: string;
  } | null = null;

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === "thinking") {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === "answer") {
      answerData = parsed as {
        results: Array<Record<string, unknown>>;
        confidence: number;
        accuracy: number;
        auto_stop?: boolean;
        stop_reason?: string;
      };
      return false;
    } else if (eventType === "error") {
      throw createSseError(parseSseErrorPayload(JSON.stringify(parsed)));
    }
    return true;
  });

  if (answerData) {
    return answerData;
  }
  throw createSseError({
    code: "GRADING_FAILED",
    message: "Stream ended without answer data",
    retryable: true,
  });
}

/** Upload a speech recording for ASR transcription. */
export async function uploadSpeechRecording(
  sessionId: string,
  questionItemId: number,
  blob: Blob,
  durationMs: number,
  filename = "answer.webm"
): Promise<{
  asset_id: string;
  status: string;
  transcript: string;
  error?: string;
}> {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("question_item_id", String(questionItemId));
  form.append("duration_ms", String(durationMs));

  const resp = await fetch(
    `${BASE_URL}/api/v1/sessions/${sessionId}/assets/speech`,
    { method: "POST", body: form }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw wrapHttpError(resp, body);
  }
  return resp.json();
}

/** SSE stream for answer evaluation with thinking steps. */
export async function streamSubmitAnswer(
  sessionId: string,
  answer: string,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal
): Promise<{
  item_id: number;
  is_correct: boolean;
  feedback: string;
  confidence: number;
  accuracy: number;
  auto_stop?: boolean;
  stop_reason?: string;
}> {
  const resp = await fetch(
    `${BASE_URL}/api/v1/sessions/${sessionId}/stream_answer?locale=${encodeURIComponent(useLocaleStore().locale)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
      signal,
    }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw wrapHttpError(resp, body);
  }
  let answerData: {
    item_id: number;
    is_correct: boolean;
    feedback: string;
    confidence: number;
    accuracy: number;
    auto_stop?: boolean;
    stop_reason?: string;
  } | null = null;

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === "thinking") {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === "answer") {
      answerData = parsed as {
        item_id: number;
        is_correct: boolean;
        feedback: string;
        confidence: number;
        accuracy: number;
        auto_stop?: boolean;
        stop_reason?: string;
      };
      return false;
    } else if (eventType === "error") {
      throw createSseError(parseSseErrorPayload(JSON.stringify(parsed)));
    }
    return true;
  });

  if (answerData) {
    return answerData;
  }
  throw createSseError({
    code: "GRADING_FAILED",
    message: "Stream ended without answer data",
    retryable: true,
  });
}

export async function adminLogin(
  password: string
): Promise<{ access_token: string }> {
  return fetchJson(`${BASE_URL}/api/v1/admin/v1/login`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function uploadQuestionBankSamples(
  file: File,
  token: string
): Promise<{ task_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(
    `${BASE_URL}/api/v1/admin/question-bank/samples/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw wrapHttpError(resp, body);
  }
  return resp.json();
}

export async function getQuestionBankUploadTask(
  taskId: string,
  token: string
): Promise<{
  task_id: string;
  status: string;
  total: number;
  processed: number;
  failed_count: number;
  errors: Array<{ line: number; reason: string }>;
}> {
  return fetchJson(
    `${BASE_URL}/api/v1/admin/question-bank/samples/upload/tasks/${taskId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export function downloadQuestionBankTemplateUrl(token: string): string {
  return `${BASE_URL}/api/v1/admin/question-bank/samples/template?token=${encodeURIComponent(token)}`;
}

export async function getConfidence(sessionId: string): Promise<{
  accuracy: number;
  ci_lower: number;
  ci_upper: number;
  confidence: number;
  sample_size: number;
  should_stop: boolean;
  stop_reason: string;
  remaining: number;
  total_rounds: number;
  min_rounds: number;
  max_rounds: number;
  dimension_rounds: {
    vocabulary: number;
    grammar: number;
    reading: number;
    listening?: number;
    speaking?: number;
  };
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
  signal?: AbortSignal
): Promise<
  | { cold_start: boolean; round: number; label: string; question: string }
  | { cold_start_complete: boolean; initial_vector: unknown }
> {
  const resp = await fetch(
    `${BASE_URL}/api/v1/sessions/${sessionId}/cold_start?locale=${encodeURIComponent(useLocaleStore().locale)}`,
    { signal }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw wrapHttpError(resp, body);
  }
  let questionData:
    | { cold_start: boolean; round: number; label: string; question: string }
    | { cold_start_complete: boolean; initial_vector: unknown }
    | null = null;

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === "thinking") {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === "question") {
      questionData = parsed as
        | {
            cold_start: boolean;
            round: number;
            label: string;
            question: string;
          }
        | { cold_start_complete: boolean; initial_vector: unknown };
      return false;
    } else if (eventType === "error") {
      throw createSseError(parseSseErrorPayload(JSON.stringify(parsed)));
    }
    return true;
  });

  if (questionData) {
    return questionData;
  }
  throw createSseError({
    code: "GENERATION_FAILED",
    message: "Stream ended without question data",
    retryable: true,
  });
}

/** SSE stream for cold start answer evaluation. */
export async function streamColdStartAnswer(
  sessionId: string,
  answer: string,
  responseTime: number,
  onThinking: (step: { agent: string; label: string; output: string }) => void,
  signal?: AbortSignal
): Promise<{
  cold_start_complete: boolean;
  feedback: string;
  observer_output: string;
  grade_output: string;
  initial_vector?: unknown;
}> {
  const resp = await fetch(
    `${BASE_URL}/api/v1/sessions/${sessionId}/cold_start_answer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, response_time: responseTime }),
      signal,
    }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw wrapHttpError(resp, body);
  }
  let answerData: {
    cold_start_complete: boolean;
    feedback: string;
    observer_output: string;
    grade_output: string;
    initial_vector?: unknown;
  } | null = null;

  await readSseEvents(resp, (eventType, parsed) => {
    if (eventType === "thinking") {
      onThinking(parsed as { agent: string; label: string; output: string });
    } else if (eventType === "answer") {
      answerData = parsed as {
        cold_start_complete: boolean;
        feedback: string;
        observer_output: string;
        grade_output: string;
        initial_vector?: unknown;
      };
      return false;
    } else if (eventType === "error") {
      throw createSseError(parseSseErrorPayload(JSON.stringify(parsed)));
    }
    return true;
  });

  if (answerData) {
    return answerData;
  }
  throw createSseError({
    code: "GRADING_FAILED",
    message: "Stream ended without answer data",
    retryable: true,
  });
}

/** Upload a speech recording for ASR transcription. */
