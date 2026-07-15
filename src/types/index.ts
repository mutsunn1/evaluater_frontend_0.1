export type QuestionType =
  | "multiple_choice"
  | "multiple_select"
  | "true_false"
  | "fill_in_blank"
  | "reading_comprehension"
  | "listening"
  | "listening_comprehension"
  | "speaking"
  | "speaking_response"
  | "unknown";

export type ResponseMode =
  "choice" | "text" | "speech" | "handwriting" | "upload";

export interface MediaAsset {
  id: string;
  type: "image" | "audio" | "video";
  role: "prompt" | "option" | "reference";
  source: "prepared" | "generated";
  url: string;
  mime_type?: string;
  alt?: string;
  descriptor?: string;
  tags?: string[];
  provider?: string;
  license?: string;
  attribution?: string;
  project_url?: string;
}

export interface QuestionOption {
  index: string;
  text?: string;
  media_id?: string;
  answer_behavior?: "skip_modality" | string;
  modality?: "listening" | "speaking" | string;
}

export interface SubQuestion {
  sub_id: string;
  question_text: string;
  answer_format: string;
}

export interface ItemData {
  question_type: QuestionType;
  scene: string;
  grammar_focus: string;
  target_level: string;
  question_text: string;
  options?: QuestionOption[];
  correct_answer?: string | string[] | boolean;
  reading_passage?: string;
  sub_questions?: SubQuestion[];
  blank_count?: number;
  expected_duration_seconds?: number;
  skill_dimension?:
    "vocabulary" | "grammar" | "reading" | "listening" | "speaking";
  batch_id?: string;
  batch_index?: number;
  batch_total?: number;
  response_mode?: ResponseMode;
  media?: MediaAsset[];
  modality?: "listening" | "speaking" | string;
  question_item_id?: number;
}

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "question" | "feedback" | "cold_start";
  source?: "llm" | "system" | "user";
  content: string;
  item_data?: ItemData;
  batch_questions?: ItemData[];
  session_id?: string;
  cold_start_data?: {
    round: number;
    label: string;
    labelKey?: string;
    questionKey?: string;
  };
  timestamp: string;
  thinking_steps?: ThinkingStep[];
}

export interface ThinkingStep {
  agent: string;
  agent_key: string;
  output: string;
}

export interface ConfidenceStats {
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
}

export interface UserProfileData {
  user_id: string;
  hsk_level: number;
  skill_levels: {
    hsk: number;
    vocabulary: number;
    grammar: number;
    reading: number;
    listening?: number;
    speaking?: number;
  };
  native_language: string | null;
  stubborn_errors: string[];
  strengths: string[];
  next_focus: string[];
  updated_at: string | null;
}

export interface ColdStartQuestion {
  cold_start: true;
  round: number;
  label: string;
  question: string;
}

export type SseErrorCode =
  | "GENERATION_FAILED"
  | "GRADING_FAILED"
  | "STREAM_TIMEOUT"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "SESSION_NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface SseErrorPayload {
  code: SseErrorCode | string;
  message: string;
  retryable?: boolean;
  request_id?: string;
}

export class SseError extends Error {
  code: SseErrorCode | string;
  retryable: boolean;
  requestId?: string;

  constructor(payload: SseErrorPayload) {
    super(payload.message || "Stream error");
    this.name = "SseError";
    this.code = payload.code || "INTERNAL_ERROR";
    this.retryable = !!payload.retryable;
    this.requestId = payload.request_id;
  }
}

export interface SessionResult {
  total_items: number;
  average_score: number;
  improved_areas: string[];
  regressed_areas: string[];
  level_change?: { from: string; to: string; promoted: boolean };
  next_focus: string[];
  notable_sentences?: string[];
  stubborn_errors?: string[];
  interest_areas?: string[];
  hsk_adjustment?: string;
  summary?: string;
  dimension_scores?: {
    vocabulary: number;
    grammar: number;
    reading: number;
    listening: number;
    speaking: number;
  };
}
