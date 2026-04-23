<template>
  <div v-if="stats.sample_size > 0" class="border-t border-gray-200 bg-white px-4 py-2">
    <div class="mx-auto max-w-2xl">
      <div class="flex items-center justify-between gap-4">
        <!-- Accuracy -->
        <div class="flex-1">
          <div class="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>正确率</span>
            <span class="font-semibold">{{ stats.accuracy }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div class="h-full rounded-full bg-blue-500 transition-all" :style="{ width: stats.accuracy + '%' }" />
          </div>
        </div>

        <!-- Confidence bar -->
        <div class="flex-1">
          <div class="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>置信度</span>
            <span class="font-semibold">{{ (stats.confidence * 100).toFixed(0) }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              class="h-full rounded-full transition-all"
              :class="stats.confidence >= 0.7 ? 'bg-green-500' : stats.confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-400'"
              :style="{ width: (stats.confidence * 100) + '%' }"
            />
          </div>
        </div>

        <!-- Stop indicator -->
        <div v-if="stats.should_stop" class="flex-shrink-0 animate-pulse rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
          ✓ 评测完成
        </div>

        <!-- Remaining -->
        <div class="flex-shrink-0 text-xs text-gray-400">
          已答 {{ stats.sample_size }} / {{ stats.sample_size + stats.remaining }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConfidenceStats } from '@/types';
defineProps<{ stats: ConfidenceStats }>();
</script>
