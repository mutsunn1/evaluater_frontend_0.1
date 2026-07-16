<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- Auto-stop alert -->
    <div
      v-if="autoStopAlert"
      class="mx-auto mt-2 max-w-2xl rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800"
    >
      <div class="font-semibold">{{ $t("chat.autoStop.title") }}</div>
      <div>{{ autoStopAlert }}</div>
      <div class="mt-1 text-xs text-green-600">
        {{
          $t("chat.autoStop.stats", {
            accuracy: confidence.accuracy,
            confidence: (confidence.confidence * 100).toFixed(0),
          })
        }}
      </div>
    </div>

    <div
      ref="chatContainer"
      class="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6"
    >
      <div class="mx-auto max-w-2xl space-y-4">
        <template v-for="(group, gi) in messageGroups" :key="gi">
          <FeedbackFrame
            v-if="group.type === 'feedback'"
            :messages="group.messages"
            :default-expanded="false"
          />
          <MessageBubble
            v-else
            :message="group.message"
            @answer="handleAnswer"
            @batch-submit="handleBatchSubmit"
          />
        </template>

        <!-- Live thinking steps -->
        <div v-if="liveThinking.length > 0" class="flex justify-start">
          <div class="w-full max-w-full sm:max-w-[80%]">
            <ThinkingFrame
              :steps="liveThinkingSteps"
              :title="t('chat.thinking.title')"
              :auto-scroll="true"
              :default-expanded="false"
            />
          </div>
        </div>

        <!-- Loading spinner -->
        <div v-else-if="sessionStore.isLoading" class="flex justify-start">
          <div class="rounded-2xl bg-gray-200 px-4 py-3 text-sm text-gray-500">
            <span class="inline-block animate-pulse">{{ loadingText }}</span>
          </div>
        </div>

        <div v-if="sessionStore.error" class="flex justify-center">
          <div
            class="flex flex-col gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600"
          >
            <div class="flex items-center gap-3">
              <span>{{ displayErrorMessage }}</span>
              <button
                v-if="canRetryError"
                data-testid="retry-question"
                class="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                @click="retryQuestion"
              >
                {{ $t("common.retry") }}
              </button>
            </div>
            <div
              v-if="sessionStore.streamError?.requestId"
              class="text-xs text-red-400"
            >
              request_id: {{ sessionStore.streamError.requestId }}
            </div>
          </div>
        </div>

        <div
          v-if="networkErrorVisible"
          class="mx-auto mb-2 flex max-w-2xl items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-700"
          data-testid="network-error-toast"
        >
          <span>{{ $t("chat.sseError.network") }}</span>
          <button
            class="text-xs font-medium text-orange-800 hover:underline"
            @click="dismissNetworkError"
          >
            {{ $t("common.close") }}
          </button>
        </div>
      </div>
    </div>

    <div class="border-t border-gray-200 bg-white px-3 py-3 sm:px-4">
      <div class="mx-auto max-w-2xl">
        <!-- Always show input during cold start -->
        <template v-if="isColdStart && !sessionStore.isLoading">
          <div class="flex gap-2">
            <input
              v-model="userInput"
              type="text"
              :placeholder="$t('chat.placeholder.coldStart')"
              class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:px-4"
              @keydown.enter="handleSend"
            />
            <button
              class="btn-primary shrink-0 px-3 sm:px-4"
              :disabled="!userInput.trim()"
              @click="handleSend"
            >
              {{ $t("common.send") }}
            </button>
          </div>
        </template>
        <!-- Normal evaluation input -->
        <template v-else-if="!isColdStart">
          <div
            v-if="!sessionStore.isWaitingAnswer && !sessionStore.isLoading"
            class="flex gap-2"
          >
            <input
              v-model="userInput"
              type="text"
              :placeholder="$t('chat.placeholder.answer')"
              class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:px-4"
              @keydown.enter="handleSend"
            />
            <button
              class="btn-primary shrink-0 px-3 sm:px-4"
              :disabled="!userInput.trim()"
              @click="handleSend"
            >
              {{ $t("common.send") }}
            </button>
          </div>
          <div
            v-else-if="sessionStore.isWaitingAnswer"
            class="text-center text-sm text-gray-500"
          >
            {{ $t("chat.answerInQuestion") }}
          </div>
          <div v-else class="text-center text-sm text-gray-500">
            {{ $t("chat.loading.generating") }}
          </div>
        </template>
        <!-- Loading during cold start -->
        <div v-else class="text-center text-sm text-gray-500">
          {{ $t("chat.loading.coldStart") }}
        </div>
      </div>
    </div>

    <!-- Confidence bar -->
    <ConfidenceBar :stats="confidence" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useSessionStore } from "@/stores/session";
import {
  streamQuestion,
  getConfidence,
  streamColdStart,
  streamColdStartAnswer,
  streamSubmitAnswer,
  batchSubmitAnswer,
  endSession,
} from "@/api";
import {
  toThinkingSteps,
  createDefaultConfidence,
  buildSessionResult,
} from "@/utils/session";
import { createClientId } from "@/utils/id";
import type {
  ChatMessage,
  ThinkingStep,
  ConfidenceStats,
  BatchAnswerPayload,
  ItemData,
} from "@/types";
import { SseError } from "@/types";
import MessageBubble from "@/components/MessageBubble.vue";
import ThinkingFrame from "@/components/ThinkingFrame.vue";
import FeedbackFrame from "@/components/FeedbackFrame.vue";
import ConfidenceBar from "@/components/ConfidenceBar.vue";

const sessionStore = useSessionStore();
const { t } = useI18n();
const emit = defineEmits<{ profileUpdate: [] }>();
const chatContainer = ref<HTMLElement | null>(null);
const userInput = ref("");
const activeQuestionRequestId = ref<string | null>(null);
const questionRetryRequestId = ref<string | null>(null);

let abortController: AbortController | null = null;

function getSignal(): AbortSignal {
  abortController = new AbortController();
  return abortController.signal;
}

onUnmounted(() => {
  abortController?.abort();
});

const liveThinking = ref<{ agent: string; label: string; output: string }[]>(
  []
);
const confidence = ref<ConfidenceStats>(createDefaultConfidence());
const autoStopAlert = ref("");
const networkErrorDismissed = ref(false);

const isNetworkError = computed(() => {
  const code = sessionStore.streamError?.code;
  return code === "NETWORK_ERROR" || code === "HTTP_ERROR";
});

const networkErrorVisible = computed(() => {
  return (
    isNetworkError.value &&
    !networkErrorDismissed.value &&
    !sessionStore.isLoading
  );
});

function dismissNetworkError() {
  networkErrorDismissed.value = true;
}

const canRetryError = computed(() => {
  if (!sessionStore.streamError) {
    return !!questionRetryRequestId.value;
  }
  return sessionStore.streamError.retryable;
});

const displayErrorMessage = computed(() => {
  const err = sessionStore.streamError;
  if (!err) return sessionStore.error || "";
  const key = `chat.sseError.${err.code}`;
  const translated = t(key);
  return translated !== key ? translated : err.message;
});

watch(
  () => sessionStore.isLoading,
  (loading) => {
    if (!loading) return;
    networkErrorDismissed.value = false;
  }
);

// Group adjacent feedback messages into a single collapsible frame.
type MessageGroup =
  | { type: "message"; message: ChatMessage }
  | { type: "feedback"; messages: ChatMessage[] };

const messageGroups = computed<MessageGroup[]>(() => {
  const groups: MessageGroup[] = [];
  let feedbackBuffer: ChatMessage[] = [];

  function flushFeedback() {
    if (feedbackBuffer.length > 0) {
      groups.push({ type: "feedback", messages: [...feedbackBuffer] });
      feedbackBuffer = [];
    }
  }

  for (const msg of sessionStore.messages) {
    if (msg.role === "feedback") {
      feedbackBuffer.push(msg);
    } else {
      flushFeedback();
      groups.push({ type: "message", message: msg });
    }
  }
  flushFeedback();
  return groups;
});

const liveThinkingSteps = computed<ThinkingStep[]>(() =>
  toThinkingSteps(liveThinking.value)
);

// Cold start state (synced from store)
const isColdStart = computed(() => sessionStore.isColdStart);
const coldStartRound = ref(0);

const loadingText = computed(() => {
  if (isColdStart.value)
    return coldStartRound.value > 0
      ? t("chat.loading.analyzing")
      : t("chat.loading.coldStart");
  if (sessionStore.loadingPhase === "judging") return t("chat.loading.judging");
  return t("chat.loading.nextRound");
});

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

/** Scroll so the latest message is at the top of the viewport */
function scrollToLatest() {
  nextTick(() => {
    if (!chatContainer.value) return;
    const container = chatContainer.value;
    const inner = container.querySelector(".mx-auto");
    if (!inner) return;
    const messages = Array.from(inner.children);
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1] as HTMLElement;
    // Calculate exact scroll: current scrollTop + distance from message top to container top
    const containerRect = container.getBoundingClientRect();
    const msgRect = lastMsg.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + (msgRect.top - containerRect.top),
      behavior: "smooth",
    });
  });
}

/** Track answer timing */
let questionPushedAt = 0;

// ========== COLD START ==========

async function startColdStart() {
  if (!sessionStore.sessionId) return;
  sessionStore.isColdStart = true;
  await fetchColdStartRound();
}

async function fetchColdStartRound() {
  if (!sessionStore.sessionId) return;
  sessionStore.isLoading = true;
  sessionStore.error = null;
  liveThinking.value = [];

  try {
    const resp = await streamColdStart(
      sessionStore.sessionId,
      (step) => {
        liveThinking.value.push(step);
        scrollToBottom();
      },
      getSignal()
    );

    if ("cold_start_complete" in resp && resp.cold_start_complete) {
      // Cold start done → transition to normal evaluation
      sessionStore.isColdStart = false;
      sessionStore.addMessage({
        id: createClientId(),
        role: "system",
        source: "system",
        content: "chat.coldStart.complete",
        timestamp: new Date().toISOString(),
      });
      scrollToBottom();
      emit("profileUpdate");
      await fetchNextQuestion();
      return;
    }

    const q = resp as {
      cold_start: boolean;
      round: number;
      label: string;
      question: string;
    };
    coldStartRound.value = q.round;

    sessionStore.addMessage({
      id: createClientId(),
      role: "cold_start",
      content: q.question,
      cold_start_data: {
        round: q.round,
        label: q.label,
        labelKey: q.label,
        questionKey: q.question,
      },
      timestamp: new Date().toISOString(),
      thinking_steps: [...toThinkingSteps(liveThinking.value)],
    });
    sessionStore.isWaitingAnswer = true;
    questionPushedAt = Date.now();
    liveThinking.value = [];
    scrollToLatest();
  } catch (e) {
    const err =
      e instanceof SseError
        ? e
        : new SseError({
            code: "INTERNAL_ERROR",
            message:
              e instanceof Error
                ? e.message
                : t("chat.coldStart.questionFailed"),
            retryable: false,
          });
    sessionStore.setStreamError(err);
    liveThinking.value = [];
  } finally {
    sessionStore.isLoading = false;
  }
}

async function handleColdStartAnswer(answer: string) {
  if (!sessionStore.sessionId) return;

  sessionStore.addMessage({
    id: createClientId(),
    role: "user",
    content: answer,
    timestamp: new Date().toISOString(),
  });
  scrollToBottom();

  const responseTime = questionPushedAt ? Date.now() - questionPushedAt : 0;
  sessionStore.isWaitingAnswer = false;
  sessionStore.isLoading = true;
  sessionStore.error = null;
  liveThinking.value = [];

  try {
    const resp = await streamColdStartAnswer(
      sessionStore.sessionId,
      answer,
      responseTime,
      (step) => {
        liveThinking.value.push(step);
        scrollToBottom();
      },
      getSignal()
    );

    sessionStore.addMessage({
      id: createClientId(),
      role: "feedback",
      content: resp.feedback || "chat.coldStart.feedback.recorded",
      timestamp: new Date().toISOString(),
      thinking_steps: toThinkingSteps(liveThinking.value),
    });
    scrollToBottom();

    if (resp.cold_start_complete) {
      sessionStore.isColdStart = false;
      sessionStore.addMessage({
        id: createClientId(),
        role: "system",
        source: "system",
        content:
          ((resp as Record<string, unknown>).message as string) ||
          "chat.coldStart.completeFallback",
        timestamp: new Date().toISOString(),
      });
      scrollToBottom();
      emit("profileUpdate");
      setTimeout(() => fetchNextQuestion(), 2000);
    } else {
      // Next cold start round
      await fetchColdStartRound();
    }

    liveThinking.value = [];
  } catch (e) {
    const err =
      e instanceof SseError
        ? e
        : new SseError({
            code: "INTERNAL_ERROR",
            message:
              e instanceof Error ? e.message : t("chat.coldStart.answerFailed"),
            retryable: false,
          });
    sessionStore.setStreamError(err);
    liveThinking.value = [];
  } finally {
    sessionStore.isLoading = false;
  }
}

// ========== NORMAL EVALUATION ==========

async function handleAnswer(answer: string) {
  if (!sessionStore.sessionId) return;

  // Route to cold start or normal
  if (isColdStart.value) {
    await handleColdStartAnswer(answer);
    return;
  }

  sessionStore.addMessage({
    id: createClientId(),
    role: "user",
    content: answer,
    timestamp: new Date().toISOString(),
  });
  scrollToBottom();

  try {
    sessionStore.isWaitingAnswer = false;
    sessionStore.isLoading = true;
    sessionStore.loadingPhase = "judging";
    sessionStore.error = null;
    liveThinking.value = [];

    const resp = await streamSubmitAnswer(
      sessionStore.sessionId,
      answer,
      (step) => {
        liveThinking.value.push(step);
        scrollToBottom();
      },
      getSignal()
    );

    const feedback = (resp.feedback as string) || "";
    const isCorrect = resp.is_correct as boolean | undefined;

    sessionStore.addMessage({
      id: createClientId(),
      role: "feedback",
      content:
        feedback ||
        (isCorrect !== undefined
          ? isCorrect
            ? "chat.feedback.correct"
            : "chat.feedback.incorrect"
          : "chat.feedback.recorded"),
      is_correct: isCorrect,
      timestamp: new Date().toISOString(),
      thinking_steps: toThinkingSteps(liveThinking.value),
    });
    scrollToBottom();

    confidence.value.confidence = (resp.confidence as number) ?? 0;
    confidence.value.accuracy = (resp.accuracy as number) ?? 0;
    confidence.value.should_stop = resp.auto_stop as boolean;

    await updateConfidence();
    emit("profileUpdate");
    if (!confidence.value.should_stop) {
      await fetchNextQuestion();
    }

    liveThinking.value = [];
  } catch (e) {
    const err =
      e instanceof SseError
        ? e
        : new SseError({
            code: "INTERNAL_ERROR",
            message: e instanceof Error ? e.message : t("chat.answer.failed"),
            retryable: false,
          });
    sessionStore.setStreamError(err);
    liveThinking.value = [];
  } finally {
    sessionStore.isLoading = false;
  }
}

async function handleSend() {
  const text = userInput.value.trim();
  if (!text || sessionStore.isLoading) return;
  userInput.value = "";
  await handleAnswer(text);
}

async function fetchNextQuestion(requestId?: string) {
  if (!sessionStore.sessionId) return;
  const questionRequestId = requestId || createClientId();
  activeQuestionRequestId.value = questionRequestId;
  sessionStore.currentQuestions = [];
  sessionStore.currentQuestionIndex = 0;
  sessionStore.isWaitingAnswer = false;
  sessionStore.isLoading = true;
  sessionStore.loadingPhase = "generating";
  sessionStore.error = null;
  questionRetryRequestId.value = null;
  liveThinking.value = [];

  try {
    const thinkingSteps: ThinkingStep[] = [];
    const streamedQuestions: ItemData[] = [];
    let questionMessageId: string | null = null;

    const showQuestions = (questions: ItemData[]) => {
      if (questions.length === 0) return;
      if (!questionMessageId) {
        questionMessageId = createClientId();
        sessionStore.addMessage({
          id: questionMessageId,
          role: "question",
          content: "",
          batch_questions: [...questions],
          session_id: sessionStore.sessionId || "",
          timestamp: new Date().toISOString(),
          thinking_steps:
            thinkingSteps.length > 0 ? [...thinkingSteps] : undefined,
        });
        scrollToLatest();
      } else {
        const message = sessionStore.messages.find(
          (msg) => msg.id === questionMessageId
        );
        if (message) {
          message.batch_questions = [...questions];
          message.session_id = sessionStore.sessionId || "";
          if (thinkingSteps.length > 0) {
            message.thinking_steps = [...thinkingSteps];
          }
        }
      }
      sessionStore.currentQuestions = [...questions];
      sessionStore.currentQuestionIndex = 0;
      sessionStore.isWaitingAnswer = true;
      sessionStore.isLoading = false;
      questionPushedAt = questionPushedAt || Date.now();
    };

    const resp = await streamQuestion(
      sessionStore.sessionId,
      (step) => {
        liveThinking.value.push(step);
        thinkingSteps.push({
          agent: step.label || step.agent,
          agent_key: step.agent,
          output: step.output,
        });
      },
      getSignal(),
      questionRequestId,
      (question) => {
        streamedQuestions.push(question);
        showQuestions(streamedQuestions);
      }
    );

    const questions = resp.questions;

    if (questions.length > 0) {
      showQuestions(questions);
    } else {
      sessionStore.addMessage({
        id: createClientId(),
        role: "question",
        content: t("chat.error.generation"),
        timestamp: new Date().toISOString(),
      });
      sessionStore.isWaitingAnswer = false;
    }

    questionPushedAt = questionPushedAt || Date.now();
    activeQuestionRequestId.value = null;
    questionRetryRequestId.value = null;
    liveThinking.value = [];
  } catch (e) {
    const err =
      e instanceof SseError
        ? e
        : new SseError({
            code: "NETWORK_ERROR",
            message:
              e instanceof Error ? e.message : t("chat.answer.fetchFailed"),
            retryable: true,
          });
    sessionStore.setStreamError(err);
    questionRetryRequestId.value = questionRequestId;
    liveThinking.value = [];
  } finally {
    sessionStore.isLoading = false;
  }
}

async function retryQuestion() {
  networkErrorDismissed.value = false;
  if (!questionRetryRequestId.value || sessionStore.isLoading) return;
  await fetchNextQuestion(questionRetryRequestId.value);
}

/** Handle batch submit: all questions in the current batch */
async function handleBatchSubmit(answers: BatchAnswerPayload[]) {
  if (!sessionStore.sessionId) return;
  const submissionId = createClientId();

  // Add user answers as a single message
  const answerSummary = answers
    .map((a) => {
      const label = a.response_mode
        ? {
            speech: t("chat.responseMode.speech"),
            handwriting: t("chat.responseMode.handwriting"),
            upload: t("chat.responseMode.upload"),
          }[a.response_mode] ||
          t("chat.question.number", { n: a.question_index + 1 }) +
            ` (${a.response_mode}): ${a.answer}`
        : t("chat.question.number", { n: a.question_index + 1 }) +
          `: ${a.answer}`;
      return a.answer
        ? t("chat.question.number", { n: a.question_index + 1 }) +
            `: ${a.answer}`
        : label;
    })
    .join("\n");
  sessionStore.addMessage({
    id: createClientId(),
    role: "user",
    content: answerSummary,
    timestamp: new Date().toISOString(),
  });
  scrollToBottom();

  try {
    sessionStore.isWaitingAnswer = false;
    sessionStore.isLoading = true;
    sessionStore.loadingPhase = "judging";
    sessionStore.error = null;
    liveThinking.value = [];

    const resp = await batchSubmitAnswer(
      sessionStore.sessionId,
      answers,
      (step) => {
        liveThinking.value.push(step);
        scrollToBottom();
      },
      getSignal(),
      submissionId
    );
    const results = resp.results as Array<Record<string, unknown>>;
    const thinkingSteps = toThinkingSteps(liveThinking.value);

    // Show feedback for each question
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const feedback = (r.feedback as string) || "";
      const isCorrect = r.is_correct as boolean | undefined;
      const dim = answers[i]
        ? sessionStore.currentQuestions[answers[i].question_index]
            ?.skill_dimension
        : "";
      const dimText = dim ? `[${dim}] ` : "";

      const fallbackKey =
        isCorrect !== undefined
          ? isCorrect
            ? "chat.feedback.correct"
            : "chat.feedback.incorrect"
          : "chat.feedback.recorded";

      sessionStore.addMessage({
        id: createClientId(),
        role: "feedback",
        content: `${dimText}${t("chat.question.number", { n: answers[i]?.question_index + 1 })}: ${feedback || fallbackKey}`,
        is_correct: isCorrect,
        timestamp: new Date().toISOString(),
        thinking_steps:
          i === 0 && thinkingSteps.length > 0 ? thinkingSteps : undefined,
      });
    }
    scrollToBottom();

    confidence.value.confidence = (resp.confidence as number) ?? 0;
    confidence.value.accuracy = (resp.accuracy as number) ?? 0;
    confidence.value.should_stop = resp.auto_stop as boolean;

    await updateConfidence();
    emit("profileUpdate");
    liveThinking.value = [];

    if (!confidence.value.should_stop) {
      await fetchNextQuestion();
    }
  } catch (e) {
    const err =
      e instanceof SseError
        ? e
        : new SseError({
            code: "INTERNAL_ERROR",
            message: e instanceof Error ? e.message : t("chat.answer.failed"),
            retryable: false,
          });
    sessionStore.setStreamError(err);
    liveThinking.value = [];
  } finally {
    sessionStore.isLoading = false;
  }
}

async function updateConfidence() {
  if (!sessionStore.sessionId) return;
  try {
    const resp = await getConfidence(sessionStore.sessionId);
    confidence.value = resp;
    if (resp.should_stop) {
      autoStopAlert.value = resp.stop_reason;
      setTimeout(async () => {
        try {
          const endResp = await endSession(sessionStore.sessionId!);
          const summary = endResp.summary as
            Record<string, unknown> | undefined;
          sessionStore.sessionResult = buildSessionResult(
            summary,
            confidence.value
          );
        } catch {
          sessionStore.sessionResult = buildSessionResult(
            undefined,
            confidence.value
          );
        }
      }, 3000);
    }
  } catch (e) {
    console.error("Confidence update failed:", e);
  }
}

// Auto-start: check if cold start is needed
watch(
  () => sessionStore.sessionId,
  (id) => {
    if (id && sessionStore.messages.length <= 1) {
      if (isColdStart.value) {
        startColdStart();
      } else {
        fetchNextQuestion();
      }
    }
  },
  { immediate: true }
);
</script>
