<template>
  <div>
    <p class="mb-4 text-base font-medium text-gray-800 whitespace-pre-wrap">{{ data.question_text }}</p>
    <div class="space-y-3">
      <div v-if="data.blank_count && data.blank_count > 0" class="space-y-2">
        <label v-for="n in data.blank_count" :key="n" class="block">
          <span class="mb-1 block text-xs text-gray-500">第 {{ n }} 空</span>
          <input
            v-model="answers[n - 1]"
            type="text"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="填入你的答案"
            @keydown.enter="submit"
          />
        </label>
      </div>
      <!-- Single blank fallback -->
      <input
        v-else
        v-model="singleAnswer"
        type="text"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        placeholder="填入你的答案"
        @keydown.enter="submit"
      />
    </div>
    <button
      class="btn-primary mt-4 w-full"
      :disabled="!canSubmit"
      @click="submit"
    >提交答案</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ItemData } from '@/types';

const props = defineProps<{ data: ItemData }>();
const emit = defineEmits<{ submit: [text: string] }>();

const answers = ref<string[]>(new Array(Math.max(props.data.blank_count || 1, 1)).fill(''));
const singleAnswer = ref('');

const canSubmit = computed(() => {
  if (props.data.blank_count && props.data.blank_count > 0) {
    return answers.value.every(a => a.trim() !== '');
  }
  return singleAnswer.value.trim() !== '';
});

function submit() {
  if (!canSubmit.value) return;
  if (props.data.blank_count && props.data.blank_count > 0) {
    emit('submit', answers.value.join(', '));
  } else {
    emit('submit', singleAnswer.value.trim());
  }
}
</script>
