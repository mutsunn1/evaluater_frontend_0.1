<template>
  <div :class="['flex', alignment]">
    <div class="max-w-[80%]">
      <!-- Main bubble -->
      <div :class="['rounded-2xl px-4 py-3 text-sm', bubbleClass]">
        <!-- Role badge -->
        <div v-if="roleLabel" class="mb-1 text-xs font-semibold" :class="badgeClass">{{ roleLabel }}</div>

        <!-- Question rendering -->
        <QuestionRenderer
          v-if="message.role === 'question' && message.item_data"
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
import { computed } from 'vue';
import type { ChatMessage, ThinkingStep } from '@/types';
import QuestionRenderer from '@/components/QuestionRenderer.vue';
import ThinkingProcess from '@/components/ThinkingProcess.vue';

const props = defineProps<{ message: ChatMessage }>();
const emit = defineEmits<{
  answer: [text: string];
  openThinking: [steps: ThinkingStep[]];
}>();

const alignment = computed(() =>
  props.message.role === 'user' ? 'justify-end' : 'justify-start'
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
    case 'question': return '题目';
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
