<template>
  <div :class="['flex', alignment]">
    <div :class="containerClass">
      <!-- Main bubble -->
      <div :class="['rounded-2xl px-3 py-3 text-sm sm:px-4', bubbleClass]">
        <!-- Role badge -->
        <div v-if="roleLabel" class="mb-1 text-xs font-semibold" :class="badgeClass">{{ roleLabel }}</div>

        <!-- Batch questions rendering -->
        <template v-if="message.batch_questions && message.batch_questions.length">
          <div v-for="(q, qi) in message.batch_questions" :key="qi" class="mb-4 last:mb-0">
            <!-- Question meta: scene, grammar_focus, target_level -->
            <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span class="rounded bg-blue-50 px-1.5 py-0.5 font-medium">{{ q.scene }}</span>
              <span v-if="q.grammar_focus">{{ q.grammar_focus }}</span>
              <span>{{ q.target_level }}</span>
            </div>
            <!-- Single choice -->
            <div v-if="q.question_type === 'multiple_choice' && q.options && q.options.length > 0" class="space-y-2">
              <p class="mb-2 text-base font-medium text-gray-800">{{ q.question_text }}</p>
              <button
                v-for="opt in q.options"
                :key="opt.index"
                :class="[
                  'flex min-h-12 w-full items-center rounded-lg border px-3 py-3 text-left transition-all sm:px-4',
                  batchAnswers[qi] === opt.index
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50',
                ]"
                @click="batchAnswers[qi] = opt.index"
              >
                <span class="mr-3 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold"
                  :class="batchAnswers[qi] === opt.index ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'">
                  {{ batchAnswers[qi] === opt.index ? '✓' : opt.index }}
                </span>
                {{ opt.text }}
              </button>
            </div>
            <!-- Multiple choice (multiple select) -->
            <div v-else-if="q.question_type === 'multiple_select' && q.options && q.options.length > 0" class="space-y-2">
              <p class="mb-2 text-base font-medium text-gray-800">{{ q.question_text }}</p>
              <p class="mb-2 text-xs text-orange-600">（多选题，可选择多个答案）</p>
              <button
                v-for="opt in q.options"
                :key="opt.index"
                :class="[
                  'flex min-h-12 w-full items-center rounded-lg border px-3 py-3 text-left transition-all sm:px-4',
                  (selectedMulti[qi] || []).includes(opt.index)
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50',
                ]"
                @click="toggleMultiSelect(qi, opt.index)"
              >
                <span class="mr-3 flex h-6 w-6 items-center justify-center rounded border-2 text-xs font-bold"
                  :class="(selectedMulti[qi] || []).includes(opt.index) ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'">
                  {{ (selectedMulti[qi] || []).includes(opt.index) ? '✓' : opt.index }}
                </span>
                {{ opt.text }}
              </button>
            </div>
            <!-- Fallback: choice without options → text input -->
            <div v-else-if="q.question_type === 'multiple_choice' || q.question_type === 'multiple_select'" class="space-y-2">
              <p class="mb-2 whitespace-pre-wrap text-base font-medium text-gray-800">{{ q.question_text }}</p>
              <input
                v-model="batchFillAnswers[qi]"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="输入你的答案"
              />
            </div>
            <div v-else-if="q.question_type === 'true_false'" class="flex flex-col gap-3 sm:flex-row">
              <p class="mb-2 w-full text-base font-medium text-gray-800">{{ q.question_text }}</p>
              <button
                :class="[
                  'flex-1 rounded-lg border px-6 py-4 text-center font-medium transition-all',
                  batchAnswers[qi] === '正确'
                    ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-500/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50/50',
                ]"
                @click="batchAnswers[qi] = '正确'"
              >
                <span class="text-2xl">✓</span>
                <span class="ml-2">正确</span>
              </button>
              <button
                :class="[
                  'flex-1 rounded-lg border px-6 py-4 text-center font-medium transition-all',
                  batchAnswers[qi] === '错误'
                    ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/50',
                ]"
                @click="batchAnswers[qi] = '错误'"
              >
                <span class="text-2xl">✗</span>
                <span class="ml-2">错误</span>
              </button>
            </div>
            <div v-else class="space-y-3">
              <p class="whitespace-pre-wrap text-base font-medium text-gray-800">{{ q.question_text }}</p>
              <div v-if="q.blank_count && q.blank_count > 0" class="space-y-2">
                <label v-for="n in q.blank_count" :key="n" class="block">
                  <span class="mb-1 block text-xs text-gray-500">第 {{ n }} 空</span>
                  <input
                    v-model="batchFillAnswers[qi]"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="填入你的答案"
                  />
                </label>
              </div>
              <input
                v-else
                v-model="batchFillAnswers[qi]"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="填入你的答案"
              />
            </div>
          </div>

          <!-- Unified submit button for batch -->
          <button
            v-if="canBatchSubmit"
            class="btn-primary mt-4 w-full"
            @click="submitBatch"
          >提交全部答案</button>
          <div v-else class="mt-2 text-center text-xs text-gray-400">
            请完成所有题目后再提交
          </div>
        </template>

        <!-- Single question rendering (immediate submit for single questions) -->
        <QuestionRenderer
          v-else-if="message.role === 'question' && message.item_data"
          :item-data="message.item_data"
          @answer="onAnswer"
        />

        <!-- Plain text content -->
        <p v-else-if="message.content" class="whitespace-pre-wrap">{{ message.content }}</p>

        <!-- Timestamp -->
        <div class="mt-1 text-xs" :class="timeClass">{{ formatTime(message.timestamp) }}</div>
      </div>

      <!-- Thinking steps (below question/feedback bubbles) -->
      <ThinkingProcess
        v-if="message.thinking_steps && message.thinking_steps.length > 0"
        :steps="message.thinking_steps"
        @open="onOpenThinking"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ChatMessage, ThinkingStep } from '@/types';
import QuestionRenderer from '@/components/QuestionRenderer.vue';
import ThinkingProcess from '@/components/ThinkingProcess.vue';

const props = defineProps<{ message: ChatMessage }>();
const emit = defineEmits<{
  answer: [text: string];
  batchSubmit: [answers: Array<{ question_index: number; answer: string }>];
  openThinking: [steps: ThinkingStep[]];
}>();

const alignment = computed(() =>
  props.message.role === 'user' ? 'justify-end' : 'justify-start'
);

const containerClass = computed(() =>
  props.message.role === 'user'
    ? 'max-w-[78%] sm:max-w-[80%]'
    : 'w-full max-w-full sm:max-w-[80%]'
);

const bubbleClass = computed(() => {
  switch (props.message.role) {
    case 'user': return 'bg-blue-600 text-white';
    case 'system': return 'bg-gray-100 text-gray-800';
    case 'question': return 'bg-white border border-gray-200 text-gray-800';
    case 'feedback': return 'bg-green-50 text-green-800 border border-green-200';
    case 'cold_start': return 'bg-indigo-50 text-indigo-800 border border-indigo-200';
    default: return 'bg-gray-100 text-gray-800';
  }
});

const roleLabel = computed(() => {
  switch (props.message.role) {
    case 'system': return '系统';
    case 'question': return props.message.batch_questions?.length
      ? `本轮题目（${props.message.batch_questions.length} 题）`
      : '题目';
    case 'feedback': return '反馈';
    case 'cold_start': return `冷启动第${props.message.cold_start_data?.round || ''}轮`;
    default: return '';
  }
});

const badgeClass = computed(() => {
  switch (props.message.role) {
    case 'system': return 'text-gray-500';
    case 'question': return 'text-blue-600';
    case 'feedback': return 'text-green-600';
    case 'cold_start': return 'text-indigo-600';
    default: return '';
  }
});

const timeClass = computed(() =>
  props.message.role === 'user' ? 'text-blue-200 text-right' : 'text-gray-400'
);

// Batch answer state
const batchAnswers = ref<Record<number, string>>({});
const batchFillAnswers = ref<Record<number, string>>({});
const selectedMulti = ref<Record<number, string[]>>({});

// Reset answers when message changes
watch(() => props.message.id, () => {
  batchAnswers.value = {};
  batchFillAnswers.value = {};
  selectedMulti.value = {};
}, { immediate: true });

function toggleMultiSelect(qi: number, index: string) {
  const selected = selectedMulti.value[qi] || [];
  const idx = selected.indexOf(index);
  if (idx >= 0) {
    selectedMulti.value[qi] = selected.filter(i => i !== index);
  } else {
    selectedMulti.value[qi] = [...selected, index];
  }
}

const canBatchSubmit = computed(() => {
  const questions = props.message.batch_questions || [];
  return questions.every((_q, qi) => {
    // Any answer method counts, regardless of question_type:
    // - click/toggle answers (batchAnswers / selectedMulti)
    // - text input answers (batchFillAnswers)
    return !!batchAnswers.value[qi]
      || (selectedMulti.value[qi] && selectedMulti.value[qi].length > 0)
      || !!batchFillAnswers.value[qi]?.trim();
  });
});

function submitBatch() {
  const questions = props.message.batch_questions || [];
  const answers = questions.map((q, qi) => {
    if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
      return { question_index: qi, answer: batchAnswers.value[qi] };
    }
    if (q.question_type === 'multiple_select') {
      return { question_index: qi, answer: (selectedMulti.value[qi] || []).join(', ') };
    }
    return { question_index: qi, answer: batchFillAnswers.value[qi]?.trim() || '' };
  });
  emit('batchSubmit', answers);
}

function onAnswer(text: string) {
  emit('answer', text);
}

function onOpenThinking(steps: ThinkingStep[]) {
  emit('openThinking', steps);
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
</script>
