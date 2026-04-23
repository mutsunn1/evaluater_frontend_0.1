<template>
  <div>
    <p class="mb-4 text-base font-medium text-gray-800">{{ data.question_text }}</p>
    <div class="flex gap-3">
      <button
        :class="[
          'flex-1 rounded-lg border px-6 py-4 text-center font-medium transition-all',
          selected === '正确'
            ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-500/20'
            : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50/50',
        ]"
        @click="selected = '正确'"
      >
        <span class="text-2xl">✓</span>
        <span class="ml-2">正确</span>
      </button>
      <button
        :class="[
          'flex-1 rounded-lg border px-6 py-4 text-center font-medium transition-all',
          selected === '错误'
            ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/20'
            : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/50',
        ]"
        @click="selected = '错误'"
      >
        <span class="text-2xl">✗</span>
        <span class="ml-2">错误</span>
      </button>
    </div>
    <button
      v-if="selected"
      class="btn-primary mt-4 w-full"
      @click="confirm"
    >确认答案</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ItemData } from '@/types';

defineProps<{ data: ItemData }>();
const emit = defineEmits<{ select: [text: string] }>();
const selected = ref<string | null>(null);

function confirm() {
  if (selected.value) {
    emit('select', selected.value);
  }
}
</script>
