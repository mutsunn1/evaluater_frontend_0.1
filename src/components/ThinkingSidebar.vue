<template>
  <!-- Overlay backdrop -->
  <div v-if="isOpen" class="fixed inset-0 z-40 bg-black/20" @click="close" />

  <!-- Slide-in sidebar -->
  <div
    :class="[
      'fixed right-0 top-0 z-50 h-full w-full transform bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-80',
      isOpen ? 'translate-x-0' : 'translate-x-full',
    ]"
  >
    <div class="flex h-full flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 class="font-semibold text-gray-800">思考过程</h3>
        <button class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" @click="close">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 18 18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Steps list -->
      <div class="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
        <div v-for="(step, i) in steps" :key="i" class="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div class="mb-2 flex items-center gap-2">
            <svg class="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.36-7.36-1.41 1.41M7.05 16.95l-1.41 1.41m12.72 0-1.41-1.41M7.05 7.05 5.64 5.64"/>
            </svg>
            <span class="text-sm font-semibold text-gray-700">{{ step.agent }}</span>
          </div>
          <p class="whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{{ step.output }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ThinkingStep } from '@/types';

defineProps<{ steps: ThinkingStep[]; isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

function close() {
  emit('close');
}
</script>
