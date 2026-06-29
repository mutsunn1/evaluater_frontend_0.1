<template>
  <div v-if="steps.length" class="mt-2 space-y-1.5">
    <!-- 优先显示具体摘要，完成状态仍可在侧边栏查看。 -->
    <div
      v-for="(step, i) in visibleSteps"
      :key="i"
      class="flex cursor-pointer items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-200"
      @click="openSidebar(step)"
    >
      <svg
        class="h-3.5 w-3.5 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.36-7.36-1.41 1.41M7.05 16.95l-1.41 1.41m12.72 0-1.41-1.41M7.05 7.05 5.64 5.64"
        />
      </svg>
      <span class="font-medium text-gray-600">{{ displayAgent(step) }}</span>
      <span class="truncate">{{ step.output.slice(0, 60) }}...</span>
    </div>
    <!-- Expand button if more than 2 -->
    <button
      v-if="steps.length > 2"
      class="text-xs text-blue-500 hover:text-blue-700"
      @click="openSidebar()"
    >
      {{ t("chat.thinking.viewAll", { count: steps.length }) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ThinkingStep } from "@/types";
import { selectVisibleThinkingSteps } from "@/utils/thinking";
import { getTranslatedThinkingLabel } from "@/utils/thinking-labels";

const props = defineProps<{ steps: ThinkingStep[] }>();
const emit = defineEmits<{ open: [steps: ThinkingStep[]] }>();
const { t } = useI18n();

const visibleSteps = computed(() => selectVisibleThinkingSteps(props.steps));

function displayAgent(step: ThinkingStep): string {
  return getTranslatedThinkingLabel(step.agent, t);
}

function openSidebar(step?: ThinkingStep) {
  emit("open", step ? [step] : props.steps);
}
</script>
