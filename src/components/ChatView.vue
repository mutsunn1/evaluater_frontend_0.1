<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- Auto-stop alert -->
    <div v-if="autoStopAlert" class="mx-auto mt-2 max-w-2xl rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
      <div class="font-semibold">评测已自动结束</div>
      <div>{{ autoStopAlert }}</div>
      <div class="mt-1 text-xs text-green-600">准确率 {{ confidence.accuracy }}% · 置信度 {{ (confidence.confidence * 100).toFixed(0) }}%</div>
    </div>

    <div ref="chatContainer" class="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6">
      <div class="mx-auto max-w-2xl space-y-4">
        <MessageBubble
          v-for="msg in sessionStore.messages"
          :key="msg.id"
          :message="msg"
          @answer="handleAnswer"
          @batch-submit="handleBatchSubmit"
          @open-thinking="onOpenThinking"
        />

        <!-- Live thinking steps -->
        <div v-if="liveThinking.length > 0" class="flex justify-start">
          <div class="w-full max-w-full space-y-1.5 sm:max-w-[80%]">
            <div
              v-for="step in visibleLiveThinking"
              :key="step.output"
              class="flex cursor-pointer items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-200"
              @click="openSidebarFromLive()"
            >
              <svg class="h-3.5 w-3.5 flex-shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
              <span class="font-medium text-gray-600">{{ step.label || step.agent }}</span>
              <span class="truncate">{{ step.output.slice(0, 80) }}...</span>
            </div>
            <button
              v-if="liveThinking.length > 2"
              class="text-xs text-blue-500 hover:text-blue-700"
              @click="openSidebarFromLive()"
            >
              查看全部 {{ liveThinking.length }} 条思考过程
            </button>
          </div>
        </div>

        <!-- Loading spinner -->
        <div v-else-if="sessionStore.isLoading" class="flex justify-start">
          <div class="rounded-2xl bg-gray-200 px-4 py-3 text-sm text-gray-500">
            <span class="inline-block animate-pulse">{{ loadingText }}</span>
          </div>
        </div>

        <div v-if="sessionStore.error" class="flex justify-center">
          <div class="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            <span>{{ sessionStore.error }}</span>
            <button
              v-if="questionRetryRequestId"
              data-testid="retry-question"
              class="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
              @click="retryQuestion"
            >
              重试
            </button>
          </div>
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
              placeholder="请简要回答..."
              class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:px-4"
              @keydown.enter="handleSend"
            />
            <button class="btn-primary shrink-0 px-3 sm:px-4" :disabled="!userInput.trim()" @click="handleSend">
              发送
            </button>
          </div>
        </template>
        <!-- Normal evaluation input -->
        <template v-else-if="!isColdStart">
          <div v-if="!sessionStore.isWaitingAnswer && !sessionStore.isLoading" class="flex gap-2">
            <input
              v-model="userInput"
              type="text"
              placeholder="输入你的回答..."
              class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:px-4"
              @keydown.enter="handleSend"
            />
            <button class="btn-primary shrink-0 px-3 sm:px-4" :disabled="!userInput.trim()" @click="handleSend">
              发送
            </button>
          </div>
          <div v-else-if="sessionStore.isWaitingAnswer" class="text-center text-sm text-gray-500">
            请在上方题目中作答
          </div>
          <div v-else class="text-center text-sm text-gray-500">
            正在生成题目，请稍候...
          </div>
        </template>
        <!-- Loading during cold start -->
        <div v-else class="text-center text-sm text-gray-500">
          正在准备冷启动问题...
        </div>
      </div>
    </div>

    <!-- Confidence bar -->
    <ConfidenceBar :stats="confidence" />
  </div>

  <!-- Thinking sidebar -->
  <ThinkingSidebar :steps="sidebarSteps" :is-open="sidebarOpen" @close="closeSidebar" />
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onUnmounted } from 'vue';
import { useSessionStore } from '@/stores/session';
import { streamQuestion, getConfidence, streamColdStart, streamColdStartAnswer, streamSubmitAnswer, batchSubmitAnswer, endSession } from '@/api';
import { toThinkingSteps, createDefaultConfidence, buildSessionResult } from '@/utils/session';
import { selectVisibleThinkingSteps } from '@/utils/thinking';
import type { ThinkingStep, ConfidenceStats } from '@/types';
import MessageBubble from '@/components/MessageBubble.vue';
import ThinkingSidebar from '@/components/ThinkingSidebar.vue';
import ConfidenceBar from '@/components/ConfidenceBar.vue';

const sessionStore = useSessionStore();
const emit = defineEmits<{ profileUpdate: [] }>();
const chatContainer = ref<HTMLElement | null>(null);
const userInput = ref('');
const sidebarOpen = ref(false);
const sidebarSteps = ref<ThinkingStep[]>([]);

let abortController: AbortController | null = null;
const activeQuestionRequestId = ref<string | null>(null);
const questionRetryRequestId = ref<string | null>(null);

function getSignal(): AbortSignal {
  abortController = new AbortController();
  return abortController.signal;
}

onUnmounted(() => {
  abortController?.abort();
});

const liveThinking = ref<{ agent: string; label: string; output: string }[]>([]);
const confidence = ref<ConfidenceStats>(createDefaultConfidence());
const autoStopAlert = ref('');

// Cold start state (synced from store)
const isColdStart = computed(() => sessionStore.isColdStart);
const coldStartRound = ref(0);

const loadingText = computed(() => {
  if (isColdStart.value) return coldStartRound.value > 0 ? '正在分析你的回答...' : '正在准备冷启动问题...';
  if (sessionStore.loadingPhase === 'judging') return '正在评估作答...';
  return '正在生成下一轮题目...';
});

const visibleLiveThinking = computed(() => selectVisibleThinkingSteps(liveThinking.value));

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
    const inner = container.querySelector('.mx-auto');
    if (!inner) return;
    const messages = Array.from(inner.children);
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1] as HTMLElement;
    // Calculate exact scroll: current scrollTop + distance from message top to container top
    const containerRect = container.getBoundingClientRect();
    const msgRect = lastMsg.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + (msgRect.top - containerRect.top),
      behavior: 'smooth',
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
    const resp = await streamColdStart(sessionStore.sessionId, (step) => {
      liveThinking.value.push(step);
      scrollToBottom();
    }, getSignal());

    if ('cold_start_complete' in resp && resp.cold_start_complete) {
      // Cold start done → transition to normal evaluation
      sessionStore.isColdStart = false;
      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: '冷启动评测完成。根据你的表现，系统已初步了解你的中文水平。接下来进入正式评测。',
        timestamp: new Date().toISOString(),
      });
      scrollToBottom();
      emit('profileUpdate');
      await fetchNextQuestion();
      return;
    }

    const q = resp as { cold_start: boolean; round: number; label: string; question: string };
    coldStartRound.value = q.round;

    sessionStore.addMessage({
      id: crypto.randomUUID(),
      role: 'cold_start',
      content: q.question,
      cold_start_data: { round: q.round, label: q.label },
      timestamp: new Date().toISOString(),
      thinking_steps: [...toThinkingSteps(liveThinking.value)],
    });
    sessionStore.isWaitingAnswer = true;
    questionPushedAt = Date.now();
    liveThinking.value = [];
    scrollToLatest();
  } catch (e) {
    sessionStore.error = e instanceof Error ? e.message : '冷启动问题获取失败';
    liveThinking.value = [];
  } finally {
    sessionStore.isLoading = false;
  }
}

async function handleColdStartAnswer(answer: string) {
  if (!sessionStore.sessionId) return;

  sessionStore.addMessage({
    id: crypto.randomUUID(),
    role: 'user',
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
    const resp = await streamColdStartAnswer(sessionStore.sessionId, answer, responseTime, (step) => {
      liveThinking.value.push(step);
      scrollToBottom();
    }, getSignal());

    sessionStore.addMessage({
      id: crypto.randomUUID(),
      role: 'feedback',
      content: resp.feedback || '作答已记录。',
      timestamp: new Date().toISOString(),
      thinking_steps: toThinkingSteps(liveThinking.value),
    });
    scrollToBottom();

    if (resp.cold_start_complete) {
      sessionStore.isColdStart = false;
      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: (resp as Record<string, unknown>).message as string || '冷启动评测完成，即将进入正式评测。',
        timestamp: new Date().toISOString(),
      });
      scrollToBottom();
      emit('profileUpdate');
      setTimeout(() => fetchNextQuestion(), 2000);
    } else {
      // Next cold start round
      await fetchColdStartRound();
    }

    liveThinking.value = [];
  } catch (e) {
    sessionStore.error = e instanceof Error ? e.message : '冷启动答案提交失败';
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
    id: crypto.randomUUID(),
    role: 'user',
    content: answer,
    timestamp: new Date().toISOString(),
  });
  scrollToBottom();

  try {
    sessionStore.isWaitingAnswer = false;
    sessionStore.isLoading = true;
    sessionStore.loadingPhase = 'judging';
    sessionStore.error = null;
    liveThinking.value = [];

    const resp = await streamSubmitAnswer(sessionStore.sessionId, answer, (step) => {
      liveThinking.value.push(step);
      scrollToBottom();
    }, getSignal());

    const feedback = (resp.feedback as string) || '';
    const isCorrect = resp.is_correct as boolean | undefined;

    sessionStore.addMessage({
      id: crypto.randomUUID(),
      role: 'feedback',
      content: feedback || (isCorrect !== undefined ? (isCorrect ? '回答正确！' : '回答不正确。') : '回答已记录。'),
      timestamp: new Date().toISOString(),
      thinking_steps: toThinkingSteps(liveThinking.value),
    });
    scrollToBottom();

    confidence.value.confidence = (resp.confidence as number) ?? 0;
    confidence.value.accuracy = (resp.accuracy as number) ?? 0;
    confidence.value.should_stop = resp.auto_stop as boolean;

    await updateConfidence();
    emit('profileUpdate');
    if (!confidence.value.should_stop) {
      await fetchNextQuestion();
    }

    liveThinking.value = [];
  } catch (e) {
    sessionStore.error = e instanceof Error ? e.message : '提交答案失败';
    liveThinking.value = [];
  } finally {
    sessionStore.isLoading = false;
  }
}

async function handleSend() {
  const text = userInput.value.trim();
  if (!text || sessionStore.isLoading) return;
  userInput.value = '';
  await handleAnswer(text);
}

async function fetchNextQuestion(requestId?: string) {
  if (!sessionStore.sessionId) return;
  const questionRequestId = requestId || crypto.randomUUID();
  activeQuestionRequestId.value = questionRequestId;
  sessionStore.isLoading = true;
  sessionStore.loadingPhase = 'generating';
  sessionStore.error = null;
  questionRetryRequestId.value = null;
  liveThinking.value = [];

  try {
    const thinkingSteps: ThinkingStep[] = [];

    const resp = await streamQuestion(sessionStore.sessionId, (step) => {
      liveThinking.value.push(step);
      thinkingSteps.push({
        agent: step.label || step.agent,
        agent_key: step.agent,
        output: step.output,
      });
    }, getSignal(), questionRequestId);

    const questions = resp.questions;

    if (questions.length > 0) {
      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'question',
        content: '',
        batch_questions: questions,
        timestamp: new Date().toISOString(),
        thinking_steps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
      });
      sessionStore.currentQuestions = questions;
      sessionStore.currentQuestionIndex = 0;
      sessionStore.isWaitingAnswer = true;
      scrollToLatest();
    } else {
      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'question',
        content: '题目生成异常',
        timestamp: new Date().toISOString(),
      });
      sessionStore.isWaitingAnswer = false;
    }

    questionPushedAt = Date.now();
    activeQuestionRequestId.value = null;
    questionRetryRequestId.value = null;
    liveThinking.value = [];
  } catch (e) {
    sessionStore.error = e instanceof Error ? e.message : '获取题目失败';
    questionRetryRequestId.value = questionRequestId;
    liveThinking.value = [];
  } finally {
    sessionStore.isLoading = false;
  }
}

async function retryQuestion() {
  if (!questionRetryRequestId.value || sessionStore.isLoading) return;
  await fetchNextQuestion(questionRetryRequestId.value);
}

/** Handle batch submit: all questions in the current batch */
async function handleBatchSubmit(answers: Array<{ question_index: number; answer: string }>) {
  if (!sessionStore.sessionId) return;
  const submissionId = crypto.randomUUID();

  // Add user answers as a single message
  const answerSummary = answers.map(a => `第${a.question_index + 1}题: ${a.answer}`).join('\n');
  sessionStore.addMessage({
    id: crypto.randomUUID(),
    role: 'user',
    content: answerSummary,
    timestamp: new Date().toISOString(),
  });
  scrollToBottom();

  try {
    sessionStore.isWaitingAnswer = false;
    sessionStore.isLoading = true;
    sessionStore.loadingPhase = 'judging';
    sessionStore.error = null;
    liveThinking.value = [];

    const resp = await batchSubmitAnswer(sessionStore.sessionId, answers, (step) => {
      liveThinking.value.push(step);
      scrollToBottom();
    }, getSignal(), submissionId);
    const results = resp.results as Array<Record<string, unknown>>;
    const thinkingSteps = toThinkingSteps(liveThinking.value);

    // Show feedback for each question
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const feedback = (r.feedback as string) || '';
      const isCorrect = r.is_correct as boolean | undefined;
      const dim = answers[i] ? sessionStore.currentQuestions[answers[i].question_index]?.skill_dimension : '';
      const dimText = dim ? `[${dim}] ` : '';

      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'feedback',
        content: `${dimText}第${answers[i]?.question_index + 1}题: ${feedback || (isCorrect !== undefined ? (isCorrect ? '回答正确！' : '回答不正确。') : '回答已记录。')}`,
        timestamp: new Date().toISOString(),
        thinking_steps: i === 0 && thinkingSteps.length > 0 ? thinkingSteps : undefined,
      });
    }
    scrollToBottom();

    confidence.value.confidence = (resp.confidence as number) ?? 0;
    confidence.value.accuracy = (resp.accuracy as number) ?? 0;
    confidence.value.should_stop = resp.auto_stop as boolean;

    await updateConfidence();
    emit('profileUpdate');
    liveThinking.value = [];

    if (!confidence.value.should_stop) {
      await fetchNextQuestion();
    }
  } catch (e) {
    sessionStore.error = e instanceof Error ? e.message : '提交答案失败';
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
          const summary = endResp.summary as Record<string, unknown> | undefined;
          sessionStore.sessionResult = buildSessionResult(summary, confidence.value);
        } catch {
          sessionStore.sessionResult = buildSessionResult(undefined, confidence.value);
        }
      }, 3000);
    }
  } catch (e) { console.error('Confidence update failed:', e); }
}

function onOpenThinking(steps: ThinkingStep[]) {
  sidebarSteps.value = steps;
  sidebarOpen.value = true;
}

function openSidebarFromLive() {
  sidebarSteps.value = toThinkingSteps(liveThinking.value);
  sidebarOpen.value = true;
}

function closeSidebar() {
  sidebarOpen.value = false;
  sidebarSteps.value = [];
}

// Auto-start: check if cold start is needed
watch(() => sessionStore.sessionId, (id) => {
  if (id && sessionStore.messages.length <= 1) {
    if (isColdStart.value) {
      startColdStart();
    } else {
      fetchNextQuestion();
    }
  }
}, { immediate: true });
</script>
