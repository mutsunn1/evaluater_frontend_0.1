<template>
  <div>
    <p class="mb-4 text-base font-medium text-gray-800">{{ data.question_text }}</p>
    <div class="space-y-2">
      <button
        v-for="opt in data.options"
        :key="opt.index"
        :class="[
          'flex w-full items-center rounded-lg border px-4 py-3 text-left transition-all',
          selected === opt.index
            ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
            : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50',
        ]"
        @click="select(opt.index)"
      >
        <span class="mr-3 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold"
          :class="selected === opt.index ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'">
          {{ selected === opt.index ? '✓' : opt.index }}
        </span>
        {{ opt.text }}
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

function select(index: string) {
  selected.value = index;
}

function confirm() {
  if (selected.value) {
    emit('select', selected.value);
  }
}
</script>
