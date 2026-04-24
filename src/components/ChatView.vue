<template>
  <div class="flex h-full flex-col">
    <!-- Auto-stop alert -->
    <div v-if="autoStopAlert" class="mx-auto mt-2 max-w-2xl rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
      <div class="font-semibold">评测已自动结束</div>
      <div>{{ autoStopAlert }}</div>
      <div class="mt-1 text-xs text-green-600">准确率 {{ confidence.accuracy }}% · 置信度 {{ (confidence.confidence * 100).toFixed(0) }}%</div>
    </div>

    <div ref="chatContainer" class="flex-1 overflow-y-auto px-4 py-6">
      <div class="mx-auto max-w-2xl space-y-4">
        <MessageBubble
          v-for="msg in sessionStore.messages"
          :key="msg.id"
          :message="msg"
          @answer="handleAnswer"
          @open-thinking="onOpenThinking"
        />

        <!-- Live thinking steps -->
        <div v-if="liveThinking.length > 0" class="flex justify-start">
          <div class="max-w-[80%] space-y-1.5">
            <div
              v-for="(step, i) in liveThinking"
              :key="i"
              class="flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1.5 text-xs text-gray-500"
            >
              <svg class="h-3.5 w-3.5 flex-shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
              <span class="font-medium text-gray-600">{{ step.label || step.agent }}</span>
              <span class="truncate">{{ step.output.slice(0, 80) }}...</span>
            </div>
          </div>
        </div>

        <!-- Loading spinner -->
        <div v-else-if="sessionStore.isLoading" class="flex justify-start">
          <div class="rounded-2xl bg-gray-200 px-4 py-3 text-sm text-gray-500">
            <span class="inline-block animate-pulse">{{ loadingText }}</span>
          </div>
        </div>

        <div v-if="sessionStore.error" class="flex justify-center">
          <div class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{{ sessionStore.error }}</div>
        </div>
      </div>
    </div>

    <div class="border-t border-gray-200 bg-white px-4 py-3">
      <div class="mx-auto max-w-2xl">
        <!-- Always show input during cold start -->
        <template v-if="isColdStart && !sessionStore.isLoading">
          <div class="flex gap-2">
            <input
              v-model="userInput"
              type="text"
              placeholder="请简要回答..."
              class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              @keydown.enter="handleSend"
            />
            <button class="btn-primary" :disabled="!userInput.trim()" @click="handleSend">
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
              class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              @keydown.enter="handleSend"
            />
            <button class="btn-primary" :disabled="!userInput.trim()" @click="handleSend">
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
import { ref, watch, computed, nextTick } from 'vue';
import { useSessionStore } from '@/stores/session';
import { streamQuestion, getConfidence, streamColdStart, streamColdStartAnswer, streamSubmitAnswer } from '@/api';
import type { ItemData, ThinkingStep, ConfidenceStats } from '@/types';
import MessageBubble from '@/components/MessageBubble.vue';
import ThinkingSidebar from '@/components/ThinkingSidebar.vue';
import ConfidenceBar from '@/components/ConfidenceBar.vue';

const sessionStore = useSessionStore();
const emit = defineEmits<{ profileUpdate: [] }>();
const chatContainer = ref<HTMLElement | null>(null);
const userInput = ref('');
const sidebarOpen = ref(false);
const sidebarSteps = ref<ThinkingStep[]>([]);

const liveThinking = ref<{ agent: string; label: string; output: string }[]>([]);
const confidence = ref<ConfidenceStats>({
  accuracy: 0, ci_lower: 0, ci_upper: 0,
  confidence: 0, sample_size: 0,
  should_stop: false, stop_reason: '', remaining: 12,
});
const autoStopAlert = ref('');

// Cold start state (synced from store)
const isColdStart = computed(() => sessionStore.isColdStart);
const coldStartRound = ref(0);

const loadingText = computed(() => {
  if (isColdStart.value) return coldStartRound.value > 0 ? '正在分析你的回答...' : '正在准备冷启动问题...';
  return sessionStore.isWaitingAnswer ? '正在收集各智能体的分析结果...' : '正在生成题目，请稍候...';
});

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
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
    });

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
      thinking_steps: [...liveThinking.value.map(s => ({ agent: s.label || s.agent, agent_key: s.agent, output: s.output }))],
    });
    sessionStore.isWaitingAnswer = true;
    questionPushedAt = Date.now();
    liveThinking.value = [];
    scrollToBottom();
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
    });

    sessionStore.addMessage({
      id: crypto.randomUUID(),
      role: 'feedback',
      content: resp.feedback || '作答已记录。',
      timestamp: new Date().toISOString(),
      thinking_steps: liveThinking.value.map(s => ({ agent: s.label || s.agent, agent_key: s.agent, output: s.output })),
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
    sessionStore.error = null;
    liveThinking.value = [];

    const resp = await streamSubmitAnswer(sessionStore.sessionId, answer, (step) => {
      liveThinking.value.push(step);
      scrollToBottom();
    });

    const feedback = (resp.feedback as string) || '';
    const isCorrect = resp.is_correct as boolean | undefined;

    sessionStore.addMessage({
      id: crypto.randomUUID(),
      role: 'feedback',
      content: feedback || (isCorrect !== undefined ? (isCorrect ? '回答正确！' : '回答不正确。') : '回答已记录。'),
      timestamp: new Date().toISOString(),
      thinking_steps: liveThinking.value.map(s => ({ agent: s.label || s.agent, agent_key: s.agent, output: s.output })),
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

async function fetchNextQuestion() {
  if (!sessionStore.sessionId) return;
  sessionStore.isLoading = true;
  sessionStore.error = null;
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
      scrollToBottom();
    });

    const q = resp.question as Partial<ItemData> | undefined;

    if (q && q.question_type && q.question_type !== 'unknown') {
      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'question',
        content: '',
        item_data: q as ItemData,
        timestamp: new Date().toISOString(),
        thinking_steps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
      });
      sessionStore.isWaitingAnswer = true;
    } else {
      const text = q?.question_text || JSON.stringify(q) || '题目生成异常';
      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'question',
        content: text,
        timestamp: new Date().toISOString(),
        thinking_steps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
      });
      sessionStore.isWaitingAnswer = false;
    }

    questionPushedAt = Date.now();
    liveThinking.value = [];
    scrollToBottom();
  } catch (e) {
    sessionStore.error = e instanceof Error ? e.message : '获取题目失败';
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
      setTimeout(() => {
        sessionStore.sessionResult = {
          total_items: resp.sample_size,
          average_score: resp.accuracy,
          improved_areas: [],
          regressed_areas: [],
          next_focus: [],
        };
      }, 3000);
    }
  } catch { /* ignore */ }
}

function onOpenThinking(steps: ThinkingStep[]) {
  sidebarSteps.value = steps;
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
