<template>
  <div>
    <!-- Reading passage -->
    <div class="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div class="mb-2 text-xs font-semibold text-gray-500">阅读材料</div>
      <p class="whitespace-pre-wrap break-words text-base leading-relaxed text-gray-800">{{ data.reading_passage }}</p>
    </div>

    <p class="mb-4 font-medium text-gray-800">{{ data.question_text }}</p>

    <!-- Sub-questions -->
    <div v-if="data.sub_questions && data.sub_questions.length" class="space-y-4">
      <div v-for="sq in data.sub_questions" :key="sq.sub_id" class="rounded-lg border border-gray-200 p-3">
        <div class="mb-2 text-xs font-semibold text-gray-500">问题 {{ sq.sub_id }}</div>
        <p class="mb-2 text-sm text-gray-700">{{ sq.question_text }}</p>
        <input
          v-model="subAnswers[sq.sub_id]"
          type="text"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="输入你的回答"
          @keydown.enter="trySubmitAll"
        />
      </div>
    </div>

    <button
      class="btn-primary mt-4 w-full"
      :disabled="!allAnswered"
      @click="trySubmitAll"
    >提交全部答案</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ItemData } from '@/types';

const props = defineProps<{ data: ItemData }>();
const emit = defineEmits<{ submit: [text: string] }>();

const subAnswers = ref<Record<string, string>>({});

function initAnswers() {
  subAnswers.value = {};
  if (props.data.sub_questions) {
    for (const sq of props.data.sub_questions) {
      subAnswers.value[sq.sub_id] = '';
    }
  }
}

// Initialize on mount and re-init if question changes (HMR-safe)
initAnswers();
watch(() => props.data, initAnswers);

const allAnswered = computed(() => {
  if (!props.data.sub_questions?.length) return false;
  return props.data.sub_questions.every(sq => subAnswers.value[sq.sub_id]?.trim());
});

function trySubmitAll() {
  if (!allAnswered.value) return;
  const combined = props.data.sub_questions!
    .map(sq => `[${sq.sub_id}] ${subAnswers.value[sq.sub_id]}`)
    .join('\n');
  emit('submit', combined);
}
</script>
